import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { DashboardTrendDay, DashboardTrends } from '../../models/dashboard-summary';
import { DashboardService } from '../../service/dashboard.service';

type Range = 7 | 14 | 30;

interface Hover {
  index: number;
  /** Posição horizontal do tooltip, em % da largura do gráfico. */
  left: number;
}

/**
 * Tendências dos últimos dias na tela inicial: embarques × ausências (colunas empilhadas),
 * pontualidade (linha) e rotas com mais ausências (barras). Gráficos em HTML/SVG, sem biblioteca.
 */
@Component({
  selector: 'app-dashboard-trends',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './dashboard-trends.component.html',
  styleUrl: './dashboard-trends.component.scss',
})
export class DashboardTrendsComponent implements OnInit {
  private readonly service = inject(DashboardService);

  readonly ranges: Range[] = [7, 14, 30];
  readonly range = signal<Range>(7);
  readonly data = signal<DashboardTrends | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showTable = signal(false);
  readonly boardingHover = signal<Hover | null>(null);
  readonly punctualityHover = signal<Hover | null>(null);

  readonly days = computed(() => this.data()?.daily ?? []);
  /** Escala das colunas: o maior total de passageiros previstos no período, arredondado. */
  readonly boardingMax = computed(() => niceMax(Math.max(0, ...this.days().map((d) => d.expected))));
  readonly boardingTicks = computed(() => ticks(this.boardingMax()));
  readonly hasBoardingData = computed(() => this.days().some((d) => d.confirmed + d.absent > 0));
  readonly hasPunctuality = computed(() => this.days().some((d) => d.punctuality_rate != null));

  /** Segmentos da linha de pontualidade (SVG 0–100 × 0–100); dias sem rota finalizada quebram a linha. */
  readonly punctualityPaths = computed(() => {
    const days = this.days();
    const paths: string[] = [];
    let current = '';
    days.forEach((day, i) => {
      if (day.punctuality_rate == null) {
        if (current) paths.push(current);
        current = '';
        return;
      }
      const point = `${this.x(i)},${100 - day.punctuality_rate * 100}`;
      current = current ? `${current} L ${point}` : `M ${point}`;
    });
    if (current) paths.push(current);
    return paths;
  });

  readonly topRoutes = computed(() => this.data()?.routes ?? []);
  readonly routeMax = computed(() => Math.max(0.01, ...this.topRoutes().map((r) => r.rate ?? 0)));

  readonly totals = computed(() => {
    const days = this.days();
    const sum = (key: keyof DashboardTrendDay) => days.reduce((acc, d) => acc + (d[key] as number), 0);
    const expected = sum('expected');
    const absent = sum('absent');
    const finished = sum('on_time') + sum('late');
    return {
      confirmed: sum('confirmed'),
      absent,
      absentRate: expected ? absent / expected : null,
      punctuality: finished ? sum('on_time') / finished : null,
      incidents: sum('incidents'),
      delays: sum('delays'),
    };
  });

  ngOnInit(): void {
    this.load();
  }

  setRange(range: Range): void {
    if (range === this.range()) return;
    this.range.set(range);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.trends(this.range()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(extractErrorMessage(err, 'Não foi possível carregar as tendências.'));
        this.loading.set(false);
      },
    });
  }

  // ---------- geometria ----------
  /** Centro da coluna/ponto do dia `i`, em % da largura. */
  x(i: number): number {
    const n = this.days().length || 1;
    return ((i + 0.5) / n) * 100;
  }

  pct(part: number, whole: number): number {
    return whole ? (part / whole) * 100 : 0;
  }

  hover(kind: 'boarding' | 'punctuality', index: number | null): void {
    const target = kind === 'boarding' ? this.boardingHover : this.punctualityHover;
    if (index == null) {
      target.set(null);
      return;
    }
    target.set({ index, left: Math.min(82, Math.max(18, this.x(index))) });
  }

  // ---------- rótulos ----------
  dayLabel(iso: string, long = false): string {
    const date = new Date(`${iso}T12:00:00Z`);
    return new Intl.DateTimeFormat('pt-BR', long
      ? { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }
      : { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(date);
  }

  /** Em 30 dias mostra só alguns rótulos no eixo, para não encavalar. */
  showTick(i: number): boolean {
    const n = this.days().length;
    const step = n > 14 ? 5 : n > 7 ? 2 : 1;
    return (n - 1 - i) % step === 0;
  }

  percent(rate: number | null | undefined): string {
    if (rate == null) return '—';
    const value = rate * 100;
    if (value > 0 && value < 0.1) return '<0,1%';
    return value > 0 && value < 1 ? `${value.toFixed(1).replace('.', ',')}%` : `${Math.round(value)}%`;
  }

  format(n: number): string {
    return n.toLocaleString('pt-BR');
  }
}

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

function ticks(max: number): number[] {
  return [0, max / 2, max];
}
