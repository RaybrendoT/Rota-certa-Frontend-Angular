import { Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthService} from '../../core/services/auth.service';
import {ConfigService} from '../../core/services/config.service';
import {ROLE_LABELS} from '../../core/models/auth.model';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {catchError, EMPTY, filter, map, startWith, switchMap, timer} from 'rxjs';
import {AddressReviewService} from '../../features/address-review/service/address-review.service';
import {ThemeService} from '../../core/services/theme.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {extractErrorMessage} from '../../shared/utils/http-error.util';

/** Lado da foto enviada (quadrada, recortada no centro). */
const PHOTO_SIZE = 256;

const SIDEBAR_COLLAPSED_KEY = 'rotacerta.sidebarCollapsed';
/** Abaixo desta largura o menu vira gaveta sobre o conteúdo (fechada por padrão). */
const MOBILE_QUERY = '(max-width: 900px)';

/** Título da página e trilha de navegação, lidos do `data` da rota (page, section, newTitle, editTitle). */
interface PageHeading {
  title: string;
  section: string | null;
  /** Lista à qual a página pertence (link do penúltimo item da trilha), quando é um formulário. */
  listTitle: string | null;
  listUrl: string | null;
}

@Component({
  selector: 'app-app-menu',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule
  ],
  templateUrl: './app-menu.component.html',
  styleUrl: './app-menu.component.scss'
})
export class AppMenuComponent {
  readonly auth = inject(AuthService);
  /** Modo claro/escuro (botão de lua/sol na barra azul). */
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  /** Django admin (login próprio, de superusuário/staff) — aberto em nova aba pelo gerente. */
  readonly adminUrl = inject(ConfigService).getAdminUrl();

  /** Recolhido = barra estreita só com os ícones (continuam clicáveis, nome no tooltip). */
  readonly collapsed = signal(readCollapsedPreference());
  /** Celular/tela estreita: menu aberto como gaveta sobre o conteúdo. */
  readonly mobileOpen = signal(false);

  /** Contador de endereços enviados pelo app aguardando aprovação (só gestor), atualizado a cada minuto. */
  readonly addressReviews = inject(AddressReviewService);

  readonly heading = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.readHeading()),
    ),
    { initialValue: null },
  );

  constructor() {
    // Na tela estreita, escolher uma página fecha a gaveta.
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.mobileOpen.set(false));

    if (!this.auth.isManager()) return;
    timer(0, 60_000)
      .pipe(
        switchMap(() => this.addressReviews.pending().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  toggleSidebar(): void {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      this.mobileOpen.update(value => !value);
      return;
    }
    this.collapsed.update(value => !value);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(this.collapsed()));
    } catch {
      // Sem storage (aba anônima/bloqueado): o estado vale só nesta sessão.
    }
  }

  readonly userName = computed(() => this.auth.person()?.name ?? '');
  readonly userRole = computed(() => {
    const person = this.auth.person();
    if (!person) return '';
    // Gerente é global: não faz sentido anexar o nome da empresa "sede" da conta dele.
    const companyName = person.role === 'GERENTE' ? null : person.company_name;
    return [ROLE_LABELS[person.role], companyName].filter(Boolean).join(' · ');
  });
  readonly userEmail = computed(() => this.auth.person()?.email ?? '');
  readonly userPhoto = computed(() => this.auth.person()?.photo ?? null);

  /** Menu do perfil: abre ao passar o mouse (CSS) e também por clique/teclado (toque e acessibilidade). */
  readonly profileOpen = signal(false);
  readonly photoBusy = signal(false);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly snackBar = inject(MatSnackBar);

  toggleProfile(): void {
    this.profileOpen.update(open => !open);
  }

  @HostListener('document:click', ['$event'])
  closeProfileOutside(event: MouseEvent): void {
    if (!this.profileOpen()) return;
    const menu = this.host.nativeElement.querySelector('.user-menu');
    if (menu && !menu.contains(event.target as Node)) this.profileOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeProfile(): void {
    this.profileOpen.set(false);
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Escolha um arquivo de imagem.', 'OK', { duration: 4000 });
      return;
    }
    this.photoBusy.set(true);
    let blob: Blob;
    try {
      blob = await squarePhoto(file);
    } catch {
      this.photoBusy.set(false);
      this.snackBar.open('Não foi possível ler essa imagem.', 'OK', { duration: 4000 });
      return;
    }
    this.auth.uploadPhoto(blob).subscribe({
      next: () => {
        this.photoBusy.set(false);
        this.snackBar.open('Foto atualizada.', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.photoBusy.set(false);
        this.snackBar.open(extractErrorMessage(err, 'Não foi possível enviar a foto.'), 'OK', { duration: 5000 });
      },
    });
  }

  removePhoto(): void {
    this.photoBusy.set(true);
    this.auth.removePhoto().subscribe({
      next: () => this.photoBusy.set(false),
      error: (err) => {
        this.photoBusy.set(false);
        this.snackBar.open(extractErrorMessage(err, 'Não foi possível remover a foto.'), 'OK', { duration: 5000 });
      },
    });
  }

  readonly userInitials = computed(() =>
    this.userName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('')
  );

  /**
   * A rota de primeiro nível (filha deste layout) diz o nome da página e a seção do menu; nos
   * formulários (`novo` e `:id/editar`) o título vem de newTitle/editTitle e a lista vira link.
   */
  private readHeading(): PageHeading | null {
    // Estado já resolvido do roteador (o ActivatedRoute filho ainda não tem snapshot no 1º evento).
    let top: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (top && !top.data?.['page']) top = top.firstChild;
    if (!top) return null;
    const data = top.data;

    let deepest = top;
    while (deepest.firstChild) deepest = deepest.firstChild;
    const childPath = deepest.routeConfig?.path ?? '';
    const listUrl = '/' + (top.routeConfig?.path ?? '');
    if (childPath === 'novo' && data['newTitle']) {
      return { title: data['newTitle'], section: data['section'] ?? null, listTitle: data['page'], listUrl };
    }
    if (childPath.endsWith('editar') && data['editTitle']) {
      return { title: data['editTitle'], section: data['section'] ?? null, listTitle: data['page'], listUrl };
    }
    return { title: data['page'], section: data['section'] ?? null, listTitle: null, listUrl: null };
  }
}

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Recorta o centro da imagem num quadrado de PHOTO_SIZE e devolve um JPEG (uns 20–40 KB). */
async function squarePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/jpeg', 0.85),
  );
}
