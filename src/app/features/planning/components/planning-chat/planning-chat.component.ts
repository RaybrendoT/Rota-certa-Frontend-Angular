import { CommonModule } from '@angular/common';
import { Component, ElementRef, effect, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { DialogComponent } from '../../../../shared/dialog/dialog.component';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { EmployeeListResult, ListLine, PlanningConversation, PlanningSummary, PlanStop } from '../../models/planning';
import { PlanningService } from '../../service/planning.service';
import { PickupSuggestionsComponent } from '../pickup-suggestions/pickup-suggestions.component';

const EXAMPLE_PROMPT =
  'Amanhã preciso de rotas para os colaboradores abaixo, chegada na empresa às 10:30, usando até 5 rotas:\n';
const LIST_PROMPT = 'Monte as rotas para os colaboradores da lista anexada.';
const LIST_TEMPLATE = 'matricula;nome\n1001;Nome Sobrenome\n';

@Component({
  selector: 'app-planning-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    PickupSuggestionsComponent,
  ],
  templateUrl: './planning-chat.component.html',
  styleUrl: './planning-chat.component.scss',
})
export class PlanningChatComponent implements OnInit {
  private readonly planning = inject(PlanningService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);

  readonly conversations = signal<PlanningSummary[]>([]);
  readonly current = signal<PlanningConversation | null>(null);
  /** Mensagem do gestor exibida enquanto o assistente ainda não respondeu. */
  readonly pending = signal<string | null>(null);
  readonly sending = signal(false);
  readonly approving = signal(false);
  readonly error = signal<string | null>(null);
  /** Lista de colaboradores anexada (já conferida com o cadastro), enviada junto da próxima mensagem. */
  readonly attachment = signal<EmployeeListResult | null>(null);
  readonly uploading = signal(false);
  draft = '';

  private readonly messagesEnd = viewChild<ElementRef<HTMLElement>>('messagesEnd');

  constructor() {
    // Rola o chat até a última mensagem sempre que a conversa muda.
    effect(() => {
      this.current();
      this.pending();
      queueMicrotask(() => this.messagesEnd()?.nativeElement.scrollIntoView({ behavior: 'smooth' }));
    });
  }

  ngOnInit(): void {
    // Pergunta pronta vinda de outra tela (ex.: Endereços → "Perguntar ao assistente").
    const prompt = this.route.snapshot.queryParamMap.get('prompt');
    if (prompt) this.draft = prompt;
    this.planning.list().subscribe({
      next: (items) => {
        this.conversations.set(items);
        const open = items.find((item) => item.status === 'draft');
        if (open) this.open(open.id);
      },
      error: (err) => this.error.set(extractErrorMessage(err, 'Não foi possível carregar os planejamentos.')),
    });
  }

  open(id: number): void {
    this.error.set(null);
    this.planning.get(id).subscribe({
      next: (conversation) => this.current.set(conversation),
      error: (err) => this.error.set(extractErrorMessage(err, 'Não foi possível abrir o planejamento.')),
    });
  }

  startNew(): void {
    this.error.set(null);
    this.planning.create().subscribe({
      next: (conversation) => {
        this.current.set(conversation);
        this.conversations.update((items) => [this.summary(conversation), ...items]);
      },
      error: (err) => this.error.set(extractErrorMessage(err, 'Não foi possível iniciar um planejamento.')),
    });
  }

  useExample(): void {
    this.draft = EXAMPLE_PROMPT + this.draft;
  }

  canSend(): boolean {
    return !this.sending() && !this.uploading() && (!!this.draft.trim() || !!this.attachment()?.matched.length);
  }

  send(): void {
    if (!this.canSend()) return;
    const typed = this.draft.trim();
    const text = this.withAttachment(typed);
    const conversation = this.current();
    if (!conversation || conversation.status !== 'draft') {
      // Primeira mensagem (ou plano já aprovado): abre um planejamento novo e envia nele.
      this.planning.create().subscribe({
        next: (created) => {
          this.current.set(created);
          this.conversations.update((items) => [this.summary(created), ...items]);
          this.deliver(created.id, text, typed);
        },
        error: (err) => this.error.set(extractErrorMessage(err, 'Não foi possível iniciar um planejamento.')),
      });
      return;
    }
    this.deliver(conversation.id, text, typed);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo depois de corrigir
    if (!file) return;
    this.uploading.set(true);
    this.error.set(null);
    this.planning.uploadEmployeeList(file).subscribe({
      next: (result) => {
        this.uploading.set(false);
        this.attachment.set(result);
        if (!result.matched.length) this.error.set('Nenhum colaborador da lista foi encontrado no cadastro.');
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(extractErrorMessage(err, 'Não foi possível ler a lista.'));
      },
    });
  }

  removeAttachment(): void {
    this.attachment.set(null);
  }

  downloadTemplate(): void {
    const url = URL.createObjectURL(new Blob(['﻿' + LIST_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo-lista-colaboradores.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Linhas que o gestor deve conferir: não achadas, ambíguas, achadas só pelo nome ou com nome diferente. */
  listIssues(list: EmployeeListResult): string[] {
    const label = (line: ListLine) => [line.code, line.name].filter(Boolean).join(' – ');
    return [
      ...list.not_found.map((line) => `Linha ${line.row}: ${label(line)} — não encontrado no cadastro`),
      ...list.ambiguous.map(
        (line) => `Linha ${line.row}: ${label(line)} — pode ser ${line.candidates.map((c) => c.name).join(' ou ')}`,
      ),
      ...list.matched
        .filter((line) => line.matched_by === 'name' && line.code)
        .map((line) => `Linha ${line.row}: matrícula ${line.code} não existe; achado pelo nome (${line.person.name})`),
      ...list.matched
        .filter((line) => line.name_differs)
        .map((line) => `Linha ${line.row}: matrícula ${line.code} é de ${line.person.name}, não de ${line.name}`),
    ];
  }

  onKeydown(event: KeyboardEvent): void {
    // Enter envia; Shift+Enter quebra linha (listas coladas costumam ter várias linhas).
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  approve(): void {
    const conversation = this.current();
    const plan = conversation?.plan;
    if (!conversation || !plan || plan.error) return;
    this.dialog
      .open(DialogComponent, {
        data: {
          message: `Aprovar o plano de ${this.formatDate(plan.date)}?`,
          description:
            `Serão criadas ${plan.routes.length} rota(s) avulsa(s) para ${plan.total_passengers} colaboradores, ` +
            'e motoristas e passageiros serão avisados no app.',
          confirmLabel: 'Aprovar plano',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.approving.set(true);
        this.planning.approve(conversation.id).subscribe({
          next: (updated) => {
            this.approving.set(false);
            this.current.set(updated);
            this.conversations.update((items) =>
              items.map((item) => (item.id === updated.id ? this.summary(updated) : item)),
            );
            this.snackBar.open(`${updated.routes.length} rota(s) criada(s) e avisos enviados.`, 'OK', { duration: 5000 });
          },
          error: (err) => {
            this.approving.set(false);
            this.error.set(extractErrorMessage(err, 'Não foi possível aprovar o plano.'));
          },
        });
      });
  }

  /** Texto do assistente com quebras de linha e **negrito** (o restante é escapado). */
  formatMessage(text: string): string {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  passengerNames(stop: PlanStop): string {
    return stop.passengers.map((passenger) => passenger.name).join(', ');
  }

  formatDate(iso: string): string {
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
  }

  conversationLabel(item: PlanningSummary): string {
    const when = new Date(item.updated_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    return `#${item.id} · ${when} · ${item.status === 'approved' ? 'aprovado' : item.has_plan ? 'com plano' : 'em conversa'}`;
  }

  /** Junta à mensagem as matrículas encontradas na lista anexada (o assistente as busca com find_employees). */
  private withAttachment(typed: string): string {
    const list = this.attachment();
    if (!list?.matched.length) return typed;
    const ids = list.matched.map((line) => line.person.code || line.person.email || line.person.name);
    const lines = [typed || LIST_PROMPT, '', `Lista anexada (${list.file_name}, ${ids.length} colaboradores): ${ids.join(', ')}`];
    const missing = [...list.not_found, ...list.ambiguous].map((line) => [line.code, line.name].filter(Boolean).join(' – '));
    if (missing.length) lines.push(`Linhas da lista não localizadas no cadastro: ${missing.join('; ')}`);
    return lines.join('\n');
  }

  private deliver(id: number, text: string, typed: string): void {
    this.sending.set(true);
    this.error.set(null);
    this.pending.set(text);
    this.draft = '';
    this.planning.sendMessage(id, text).subscribe({
      next: (conversation) => {
        this.sending.set(false);
        this.pending.set(null);
        this.attachment.set(null);
        this.current.set(conversation);
        this.conversations.update((items) =>
          items.map((item) => (item.id === conversation.id ? this.summary(conversation) : item)),
        );
      },
      error: (err) => {
        this.sending.set(false);
        this.pending.set(null);
        this.draft = typed; // devolve o texto (e a lista anexada continua) para não perder nada
        this.error.set(extractErrorMessage(err, 'O assistente não respondeu. Tente de novo.'));
      },
    });
  }

  private summary(conversation: PlanningConversation): PlanningSummary {
    return {
      id: conversation.id,
      status: conversation.status,
      updated_at: conversation.updated_at,
      has_plan: !!conversation.plan,
    };
  }
}
