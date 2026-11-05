import { Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { RealtimeService } from '../../../../core/services/realtime.service';
import { DashboardFeedItem } from '../../models/dashboard-summary';
import { DashboardService } from '../../service/dashboard.service';

const MAX_ITEMS = 40;

const EVENT_VIEW: Record<string, { icon: string; label: string; tone: string }> = {
  departure: { icon: 'play_circle', label: 'Rota iniciada', tone: 'run' },
  arrival: { icon: 'flag', label: 'Rota finalizada', tone: 'ok' },
  stop: { icon: 'location_on', label: 'Parada no ponto', tone: 'idle' },
  delay: { icon: 'schedule', label: 'Atraso informado', tone: 'warn' },
  incident: { icon: 'report', label: 'Incidente', tone: 'bad' },
};

/**
 * Feed "Acontecendo agora" da tela inicial: abre com os eventos do dia (GET dashboard/feed/)
 * e, quando o dia é hoje, segue ao vivo pelo WebSocket. Avisa o pai (`activity`) a cada
 * evento novo, para o resumo e os alertas se atualizarem.
 */
@Component({
  selector: 'app-dashboard-feed',
  standalone: true,
  imports: [MatIconModule, RouterLink],
  templateUrl: './dashboard-feed.component.html',
  styleUrl: './dashboard-feed.component.scss',
})
export class DashboardFeedComponent {
  private readonly service = inject(DashboardService);
  readonly realtime = inject(RealtimeService);

  readonly date = input.required<string>();
  /** Turno filtrado no painel (null = todos). */
  readonly schedule = input<number | null>(null);
  /** Rotas do turno filtrado: mensagens ao vivo de outras rotas são ignoradas. */
  readonly routeFilter = input<Set<number> | null>(null);
  readonly live = input.required<boolean>();
  readonly activity = output<void>();

  readonly items = signal<DashboardFeedItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  /** Chaves dos itens que chegaram ao vivo, para destacar por alguns segundos. */
  readonly fresh = signal(new Set<string>());

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const date = this.date();
      const schedule = this.schedule();
      untracked(() => this.load(date, schedule));
    });

    effect((onCleanup) => {
      if (!this.live()) return;
      untracked(() => this.realtime.connect());
      onCleanup(() => this.realtime.release());
    });

    this.realtime.messages
      .pipe(
        filter((m) => m.type === 'route_event' || m.type === 'boarding_status'),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((message) => {
        if (!this.live()) return;
        const item = message as unknown as DashboardFeedItem;
        const allowed = this.routeFilter();
        if (allowed && !allowed.has(item.route_id)) return;
        if (item.type === 'boarding_status' && item.status === 'pending') return;
        this.add({ ...item, timestamp: item.timestamp ?? new Date().toISOString() });
        this.activity.emit();
      });
  }

  load(date: string, schedule: number | null = null): void {
    this.loading.set(true);
    this.service.feed({ date, schedule }).subscribe({
      next: (data) => {
        this.items.set(data.items);
        this.error.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  key(item: DashboardFeedItem): string {
    return item.type === 'route_event' ? `e${item.id}` : `b${item.route_passenger_id}-${item.status}-${item.timestamp}`;
  }

  icon(item: DashboardFeedItem): string {
    if (item.type === 'boarding_status') return item.status === 'absent' ? 'person_off' : 'how_to_reg';
    return EVENT_VIEW[item.event_type ?? '']?.icon ?? 'info';
  }

  tone(item: DashboardFeedItem): string {
    if (item.type === 'boarding_status') return item.status === 'absent' ? 'bad' : 'ok';
    return EVENT_VIEW[item.event_type ?? '']?.tone ?? 'idle';
  }

  title(item: DashboardFeedItem): string {
    if (item.type === 'boarding_status') {
      const who = item.person_name ?? 'Passageiro';
      return item.status === 'absent' ? `${who} informou ausência` : `${who} confirmou embarque`;
    }
    return EVENT_VIEW[item.event_type ?? '']?.label ?? 'Evento';
  }

  time(item: DashboardFeedItem): string {
    return item.timestamp
      ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Manaus' }).format(new Date(item.timestamp))
      : '';
  }

  private add(item: DashboardFeedItem): void {
    const key = this.key(item);
    if (this.items().some((existing) => this.key(existing) === key)) return;
    this.items.update((list) => [item, ...list].slice(0, MAX_ITEMS));
    this.fresh.update((set) => new Set(set).add(key));
    setTimeout(() => this.fresh.update((set) => {
      const next = new Set(set);
      next.delete(key);
      return next;
    }), 4000);
  }
}
