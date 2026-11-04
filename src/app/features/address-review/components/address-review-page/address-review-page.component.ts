import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { HomeAddress } from '../../../employee/models/person';
import { AddressReviewRequest, RouteSuggestion } from '../../models/address-review';
import { AddressReviewService } from '../../service/address-review.service';

/** Escolhas do gestor em cada pedido antes de aprovar ou recusar. */
interface Decision {
  routeId: number | null;
  updateCurrentStops: boolean;
  rejecting: boolean;
  reason: string;
  busy: boolean;
}

const WEEKDAY_NAMES: Record<string, string> = { MON: 'Seg', TUE: 'Ter', WED: 'Qua', THU: 'Qui', FRI: 'Sex', SAT: 'Sáb', SUN: 'Dom' };

@Component({
  selector: 'app-address-review-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  templateUrl: './address-review-page.component.html',
  styleUrl: './address-review-page.component.scss',
})
export class AddressReviewPageComponent implements OnInit {
  private readonly reviews = inject(AddressReviewService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly pending = signal<AddressReviewRequest[]>([]);
  readonly reviewed = signal<AddressReviewRequest[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly decisions: Record<number, Decision> = {};

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.reviews.pending().subscribe({
      next: (items) => {
        for (const item of items) this.decisions[item.id] ??= this.defaultDecision(item);
        this.pending.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(extractErrorMessage(err, 'Não foi possível carregar os endereços.'));
      },
    });
    this.reviews.reviewed().subscribe({ next: (items) => this.reviewed.set(items) });
  }

  approve(item: AddressReviewRequest): void {
    const decision = this.decisions[item.id];
    decision.busy = true;
    this.reviews
      .approve(item.id, { route_id: decision.routeId, update_current_stops: decision.updateCurrentStops })
      .subscribe({
        next: (result) => {
          const changes = result.changes?.length ? ` ${result.changes.join(' ')}` : '';
          this.snackBar.open(`Endereço de ${item.person.name} aprovado.${changes}`, 'OK', { duration: 7000 });
          this.done(item, result);
        },
        error: (err) => {
          decision.busy = false;
          this.snackBar.open(extractErrorMessage(err, 'Não foi possível aprovar.'), 'OK', { duration: 6000 });
        },
      });
  }

  reject(item: AddressReviewRequest): void {
    const decision = this.decisions[item.id];
    if (!decision.reason.trim()) return;
    decision.busy = true;
    this.reviews.reject(item.id, decision.reason).subscribe({
      next: (result) => {
        this.snackBar.open(`Endereço de ${item.person.name} recusado; ele(a) foi avisado(a) no app.`, 'OK', { duration: 5000 });
        this.done(item, result);
      },
      error: (err) => {
        decision.busy = false;
        this.snackBar.open(extractErrorMessage(err, 'Não foi possível recusar.'), 'OK', { duration: 6000 });
      },
    });
  }

  /** Abre o assistente de planejamento já com a pergunta sobre a melhor rota para a pessoa. */
  askAssistant(item: AddressReviewRequest): void {
    const who = item.person.code ? `${item.person.name} (matrícula ${item.person.code})` : item.person.name;
    const prompt =
      `${who} enviou um novo endereço pelo app: ${this.addressLine(item.address)}. ` +
      'Em qual rota fixa ele(a) deve entrar? Compare a distância até a parada, o horário e os lugares livres.';
    this.router.navigate(['/planejamento'], { queryParams: { prompt } });
  }

  addressLine(address: HomeAddress): string {
    const street = [`${address.street}, ${address.number}`, address.complement].filter(Boolean).join(' - ');
    return [street, address.neighborhood, `${address.city}/${address.state}`].filter(Boolean).join(' · ');
  }

  origin(address: HomeAddress): string {
    const when = new Date(address.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    if (address.source === 'gps') {
      const accuracy = address.accuracy_m != null ? ` (±${Math.round(address.accuracy_m)} m)` : '';
      return `Localização atual do celular${accuracy} · ${when}`;
    }
    const approximate = address.precision === 'approximate' ? ' · posição ajustada no mapa' : '';
    return `Digitado no app${approximate} · ${when}`;
  }

  mapsLink(address: HomeAddress): string {
    return `https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`;
  }

  distance(meters: number | null): string {
    if (meters == null) return '-';
    return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} km` : `${meters} m`;
  }

  suggestionLabel(suggestion: RouteSuggestion): string {
    const days = suggestion.weekdays.map((day) => WEEKDAY_NAMES[day] ?? day).join(', ');
    const when = suggestion.arrival ? `chegada ${suggestion.arrival}${days ? ' · ' + days : ''}` : 'sem horário';
    return `${suggestion.name} · ${when}`;
  }

  statusLabel(item: AddressReviewRequest): string {
    return item.status === 'approved' ? 'Aprovado' : item.status === 'rejected' ? 'Recusado' : 'Pendente';
  }

  private done(item: AddressReviewRequest, result: AddressReviewRequest): void {
    this.pending.update((items) => items.filter((other) => other.id !== item.id));
    this.reviews.pendingCount.set(this.pending().length);
    this.reviewed.update((items) => [result, ...items]);
    delete this.decisions[item.id];
  }

  private defaultDecision(item: AddressReviewRequest): Decision {
    return { routeId: null, updateCurrentStops: item.current_routes.length > 0, rejecting: false, reason: '', busy: false };
  }
}
