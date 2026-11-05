import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { DashboardAlerts, DashboardShift, DashboardSummary } from '../../models/dashboard-summary';
import { DashboardService } from '../../service/dashboard.service';
import { DashboardAlertsComponent } from '../dashboard-alerts/dashboard-alerts.component';
import { DashboardFeedComponent } from '../dashboard-feed/dashboard-feed.component';
import { DashboardTrendsComponent } from '../dashboard-trends/dashboard-trends.component';

/** Fuso da operação: o "hoje" do painel é o de Manaus, igual ao backend. */
const OPERATION_TZ = 'America/Manaus';
const AUTO_REFRESH_MS = 60_000;
/** Espera depois de um evento ao vivo antes de recarregar os números (agrupa rajadas). */
const LIVE_REFRESH_DELAY_MS = 3_000;

/** Turno escolhido no filtro: conveniência do navegador, some sem problema se o storage falhar. */
const SHIFT_KEY = 'rotacerta.dashboard.shift';

function readShift(): number | null {
  try {
    const saved = Number(localStorage.getItem(SHIFT_KEY));
    return Number.isInteger(saved) && saved > 0 ? saved : null;
  } catch {
    return null;
  }
}

function todayInOperation(): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: OPERATION_TZ }).format(new Date());
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [DashboardAlertsComponent, DashboardFeedComponent, DashboardTrendsComponent, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, RouterLink],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent implements OnInit {
  private readonly service = inject(DashboardService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly date = signal(todayInOperation());
  readonly shift = signal<number | null>(readShift());
  readonly exporting = signal(false);
  /** Rotas do turno filtrado (null = todas): o feed ao vivo descarta mensagens de outras rotas. */
  readonly routeFilter = computed(() => (this.shift() ? new Set(this.summary()?.route_ids ?? []) : null));
  readonly summary = signal<DashboardSummary | null>(null);
  readonly alerts = signal<DashboardAlerts | null>(null);
  readonly alertsError = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isToday = computed(() => this.date() === todayInOperation());
  readonly firstName = computed(() => (this.auth.person()?.name ?? '').split(' ')[0]);
  readonly greeting = computed(() => {
    const hour = Number(
      new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: OPERATION_TZ }).format(new Date()),
    );
    return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  });
  readonly dateLabel = computed(() =>
    new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      new Date(`${this.date()}T00:00:00Z`),
    ),
  );
  readonly updatedAt = computed(() => {
    const generated = this.summary()?.generated_at;
    return generated
      ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: OPERATION_TZ }).format(new Date(generated))
      : null;
  });

  ngOnInit(): void {
    this.load();
    const timer = setInterval(() => {
      if (this.isToday() && !this.loading()) this.load(true);
    }, AUTO_REFRESH_MS);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      if (this.liveRefresh) clearTimeout(this.liveRefresh);
    });
  }

  load(silent = false): void {
    if (!silent) this.loading.set(true);
    // Alertas vêm à parte: se falharem, o resumo continua aparecendo.
    const filter = { date: this.date(), schedule: this.shift() };
    this.service.alerts(filter).subscribe({
      next: (data) => {
        this.alerts.set(data);
        this.alertsError.set(false);
      },
      error: () => this.alertsError.set(true),
    });
    this.service.summary(filter).subscribe({
      next: (data) => {
        // Turno salvo que não roda neste dia: volta para "todos" em vez de mostrar tudo zerado.
        if (this.shift() && !data.available_shifts.some((s) => s.id === this.shift())) {
          this.setShift(null);
          return;
        }
        this.summary.set(data);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(extractErrorMessage(err, 'Não foi possível carregar o resumo do dia.'));
        this.loading.set(false);
      },
    });
  }

  private liveRefresh: ReturnType<typeof setTimeout> | null = null;

  /** Evento novo pelo WebSocket: atualiza resumo e alertas sem esperar o próximo minuto. */
  onLiveActivity(): void {
    if (this.liveRefresh) return;
    this.liveRefresh = setTimeout(() => {
      this.liveRefresh = null;
      this.load(true);
    }, LIVE_REFRESH_DELAY_MS);
  }

  setShift(id: number | null): void {
    this.shift.set(id);
    try {
      if (id) localStorage.setItem(SHIFT_KEY, String(id));
      else localStorage.removeItem(SHIFT_KEY);
    } catch {
      // Sem storage: o filtro vale só nesta visita.
    }
    // Mantém o resumo anterior na tela enquanto recarrega (as tendências não são recriadas).
    this.load();
  }

  /** Baixa o CSV do dia (e do turno filtrado) para abrir no Excel. */
  exportCsv(): void {
    this.exporting.set(true);
    this.service.exportCsv({ date: this.date(), schedule: this.shift() }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rotacerta-resumo-${this.date()}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.exporting.set(false);
      },
      error: (err) => {
        this.error.set(extractErrorMessage(err, 'Não foi possível exportar o resumo.'));
        this.exporting.set(false);
      },
    });
  }

  changeDate(value: string): void {
    if (!value || value === this.date()) return;
    this.date.set(value);
    this.summary.set(null);
    this.alerts.set(null);
    this.load();
  }

  shiftDay(days: number): void {
    const next = new Date(`${this.date()}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    this.changeDate(next.toISOString().slice(0, 10));
  }

  goToday(): void {
    this.changeDate(todayInOperation());
  }

  percent(rate: number | null | undefined): string {
    if (rate == null) return '—';
    const value = rate * 100;
    // Abaixo de 1% mostra uma casa decimal, para 1 ausência em 1.000 não virar "0%".
    return value > 0 && value < 1 ? `${value.toFixed(1).replace('.', ',')}%` : `${Math.round(value)}%`;
  }

  /** "1 rota" / "2 rotas"; `plural` só quando não é só acrescentar "s". */
  count(n: number, singular: string, plural = `${singular}s`): string {
    return `${n} ${n === 1 ? singular : plural}`;
  }

  share(part: number, whole: number): number {
    return whole ? Math.min(100, (part / whole) * 100) : 0;
  }

  occupancyLevel(rate: number | null): 'low' | 'ok' | 'high' {
    if (rate == null || rate < 0.5) return 'low';
    return rate > 0.95 ? 'high' : 'ok';
  }

  shiftLabel(shift: DashboardShift): string {
    return shift.time ?? 'Avulsas';
  }
}
