import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import {
  AttendanceDetail,
  AttendanceReport,
  DriversReport,
  EventsReport,
  ReportFilter,
  ReportKind,
  ReportOptions,
  RoutesReport,
} from '../../models/report';
import { ReportService } from '../../service/report.service';

const OPERATION_TZ = 'America/Manaus';
const TAB_KEY = 'rotacerta.reports.tab';

type Preset = 'this_month' | 'last_month' | '7' | '30' | '90';
type Format = 'num' | 'pct' | 'min' | 'text' | 'date';

/** Coluna de tabela: chave da linha, rótulo, formato e se ordena como número. */
interface Column {
  key: string;
  label: string;
  format: Format;
  hint?: string;
}

const COLUMNS: Record<ReportKind, Column[]> = {
  attendance: [
    { key: 'name', label: 'Colaborador', format: 'text' },
    { key: 'code', label: 'Matrícula', format: 'text' },
    { key: 'routes', label: 'Rotas', format: 'text' },
    { key: 'expected', label: 'Dias previstos', format: 'num' },
    { key: 'confirmed', label: 'Embarques', format: 'num' },
    { key: 'absent', label: 'Ausências', format: 'num' },
    { key: 'no_record', label: 'Sem registro', format: 'num', hint: 'Dias previstos sem embarque nem ausência marcados' },
    { key: 'presence_rate', label: 'Presença', format: 'pct' },
  ],
  routes: [
    { key: 'name', label: 'Rota', format: 'text' },
    { key: 'time', label: 'Turno', format: 'text' },
    { key: 'driver', label: 'Motorista', format: 'text' },
    { key: 'planned', label: 'Previstas', format: 'num', hint: 'Viagens previstas no período' },
    { key: 'done', label: 'Realizadas', format: 'num', hint: 'Viagens com partida registrada' },
    { key: 'punctuality_rate', label: 'Pontualidade', format: 'pct' },
    { key: 'avg_late_minutes', label: 'Atraso médio', format: 'min', hint: 'Média de minutos após o horário do turno' },
    { key: 'avg_occupancy', label: 'Ocupação', format: 'pct', hint: 'Embarques ÷ lugares, média das viagens realizadas' },
    { key: 'absent', label: 'Ausências', format: 'num' },
    { key: 'delays', label: 'Atrasos', format: 'num' },
    { key: 'incidents', label: 'Incidentes', format: 'num' },
  ],
  drivers: [
    { key: 'driver', label: 'Motorista', format: 'text' },
    { key: 'vehicle', label: 'Veículo', format: 'text' },
    { key: 'routes', label: 'Rotas', format: 'num' },
    { key: 'planned', label: 'Previstas', format: 'num' },
    { key: 'done', label: 'Realizadas', format: 'num' },
    { key: 'completion_rate', label: 'Realização', format: 'pct' },
    { key: 'punctuality_rate', label: 'Pontualidade', format: 'pct' },
    { key: 'avg_late_minutes', label: 'Atraso médio', format: 'min' },
    { key: 'delays', label: 'Atrasos', format: 'num' },
    { key: 'incidents', label: 'Incidentes', format: 'num' },
  ],
  events: [
    { key: 'date', label: 'Data', format: 'date' },
    { key: 'time', label: 'Hora', format: 'text' },
    { key: 'type', label: 'Tipo', format: 'text' },
    { key: 'route_name', label: 'Rota', format: 'text' },
    { key: 'driver', label: 'Motorista', format: 'text' },
    { key: 'vehicle', label: 'Veículo', format: 'text' },
    { key: 'description', label: 'Descrição', format: 'text' },
  ],
};

const TABS: { kind: ReportKind; label: string; icon: string }[] = [
  { kind: 'attendance', label: 'Frequência', icon: 'how_to_reg' },
  { kind: 'routes', label: 'Rotas', icon: 'alt_route' },
  { kind: 'drivers', label: 'Motoristas', icon: 'badge' },
  { kind: 'events', label: 'Ocorrências', icon: 'report' },
];

function isoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: OPERATION_TZ }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function readTab(): ReportKind {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (TABS.some((t) => t.kind === saved)) return saved as ReportKind;
  } catch {
    // Sem storage: abre na primeira aba.
  }
  return 'attendance';
}

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss',
})
export class ReportsPageComponent implements OnInit {
  private readonly service = inject(ReportService);

  readonly tabs = TABS;
  readonly presets: { id: Preset; label: string }[] = [
    { id: 'this_month', label: 'Este mês' },
    { id: 'last_month', label: 'Mês passado' },
    { id: '7', label: '7 dias' },
    { id: '30', label: '30 dias' },
    { id: '90', label: '90 dias' },
  ];

  readonly tab = signal<ReportKind>(readTab());
  readonly options = signal<ReportOptions | null>(null);
  readonly preset = signal<Preset | null>('30');
  readonly from = signal(addDays(isoToday(), -29));
  readonly to = signal(isoToday());
  readonly schedule = signal<number | null>(null);
  readonly route = signal<number | null>(null);
  readonly driver = signal<number | null>(null);
  readonly eventType = signal<'delay' | 'incident' | null>(null);
  readonly search = signal('');

  readonly attendance = signal<AttendanceReport | null>(null);
  readonly routesData = signal<RoutesReport | null>(null);
  readonly driversData = signal<DriversReport | null>(null);
  readonly eventsData = signal<EventsReport | null>(null);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);

  readonly sortKey = signal<string | null>(null);
  readonly sortDesc = signal(true);

  readonly detail = signal<AttendanceDetail | null>(null);
  readonly detailLoading = signal(false);

  readonly columns = computed(() => COLUMNS[this.tab()]);
  readonly routeOptions = computed(() => {
    const all = this.options()?.routes ?? [];
    const schedule = this.schedule();
    return schedule ? all.filter((r) => r.schedule_id === schedule) : all;
  });
  readonly filter = computed<ReportFilter>(() => ({
    from: this.from(),
    to: this.to(),
    schedule: this.schedule(),
    route: this.route(),
    driver: this.driver(),
    type: this.tab() === 'events' ? this.eventType() : null,
  }));
  readonly periodDays = computed(() =>
    Math.round((new Date(`${this.to()}T12:00:00Z`).getTime() - new Date(`${this.from()}T12:00:00Z`).getTime()) / 86_400_000) + 1,
  );

  /** Linhas da aba atual, já filtradas pela busca e ordenadas. */
  readonly rows = computed<Record<string, unknown>[]>(() => {
    const data = { attendance: this.attendance(), routes: this.routesData(), drivers: this.driversData(), events: this.eventsData() }[this.tab()];
    let rows = (data?.rows ?? []) as unknown as Record<string, unknown>[];
    const term = this.search().trim().toLowerCase();
    if (term) {
      rows = rows.filter((row) => Object.values(row).some((v) => String(Array.isArray(v) ? v.join(' ') : v ?? '').toLowerCase().includes(term)));
    }
    const key = this.sortKey();
    if (key) {
      const dir = this.sortDesc() ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        const x = a[key];
        const y = b[key];
        if (x == null && y == null) return 0;
        if (x == null) return 1; // vazios sempre no fim
        if (y == null) return -1;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * dir;
      });
    }
    return rows;
  });

  ngOnInit(): void {
    this.service.options().subscribe({ next: (options) => this.options.set(options) });
    this.load();
  }

  // ---------- filtros ----------
  setTab(kind: ReportKind): void {
    if (kind === this.tab()) return;
    this.tab.set(kind);
    this.sortKey.set(null);
    this.search.set('');
    this.detail.set(null);
    try {
      localStorage.setItem(TAB_KEY, kind);
    } catch {
      // Sem storage: a aba vale só nesta visita.
    }
    this.load();
  }

  applyPreset(preset: Preset): void {
    const today = isoToday();
    const [year, month] = today.split('-').map(Number);
    if (preset === 'this_month') {
      this.from.set(`${today.slice(0, 7)}-01`);
      this.to.set(today);
    } else if (preset === 'last_month') {
      const first = new Date(Date.UTC(year, month - 2, 1));
      const last = new Date(Date.UTC(year, month - 1, 0));
      this.from.set(first.toISOString().slice(0, 10));
      this.to.set(last.toISOString().slice(0, 10));
    } else {
      this.from.set(addDays(today, -(Number(preset) - 1)));
      this.to.set(today);
    }
    this.preset.set(preset);
    this.reload();
  }

  setDate(which: 'from' | 'to', value: string): void {
    if (!value) return;
    (which === 'from' ? this.from : this.to).set(value);
    this.preset.set(null);
    this.reload();
  }

  setSchedule(value: string): void {
    this.schedule.set(value ? Number(value) : null);
    if (this.route() && !this.routeOptions().some((r) => r.id === this.route())) this.route.set(null);
    this.reload();
  }

  setRoute(value: string): void {
    this.route.set(value ? Number(value) : null);
    this.reload();
  }

  setDriver(value: string): void {
    this.driver.set(value ? Number(value) : null);
    this.reload();
  }

  setEventType(value: 'delay' | 'incident' | null): void {
    this.eventType.set(value);
    this.reload();
  }

  clearFilters(): void {
    this.schedule.set(null);
    this.route.set(null);
    this.driver.set(null);
    this.eventType.set(null);
    this.search.set('');
    this.reload();
  }

  hasFilters(): boolean {
    return !!(this.schedule() || this.route() || this.driver() || this.eventType());
  }

  // ---------- dados ----------
  private reload(): void {
    this.attendance.set(null);
    this.routesData.set(null);
    this.driversData.set(null);
    this.eventsData.set(null);
    this.detail.set(null);
    this.load();
  }

  load(): void {
    const max = this.options()?.max_days ?? 90;
    if (this.from() > this.to()) {
      this.error.set('A data inicial é depois da final.');
      return;
    }
    if (this.periodDays() > max) {
      this.error.set(`O período pode ter no máximo ${max} dias.`);
      return;
    }
    const kind = this.tab();
    this.loading.set(true);
    this.error.set(null);
    const done = () => this.loading.set(false);
    const fail = (err: unknown) => {
      this.error.set(extractErrorMessage(err, 'Não foi possível carregar o relatório.'));
      done();
    };
    const filter = this.filter();
    if (kind === 'attendance') this.service.load('attendance', filter).subscribe({ next: (d) => (this.attendance.set(d), done()), error: fail });
    if (kind === 'routes') this.service.load('routes', filter).subscribe({ next: (d) => (this.routesData.set(d), done()), error: fail });
    if (kind === 'drivers') this.service.load('drivers', filter).subscribe({ next: (d) => (this.driversData.set(d), done()), error: fail });
    if (kind === 'events') this.service.load('events', filter).subscribe({ next: (d) => (this.eventsData.set(d), done()), error: fail });
  }

  exportCsv(): void {
    this.exporting.set(true);
    this.service.exportCsv(this.tab(), this.filter()).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rotacerta-${this.tab()}-${this.from()}-a-${this.to()}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.exporting.set(false);
      },
      error: (err) => {
        this.error.set(extractErrorMessage(err, 'Não foi possível exportar.'));
        this.exporting.set(false);
      },
    });
  }

  openDetail(row: Record<string, unknown>): void {
    if (this.tab() !== 'attendance') return;
    this.detailLoading.set(true);
    this.service.attendanceDetail(Number(row['person_id']), this.filter()).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false),
    });
  }

  sortBy(key: string): void {
    if (this.sortKey() === key) this.sortDesc.set(!this.sortDesc());
    else {
      this.sortKey.set(key);
      this.sortDesc.set(true);
    }
  }

  // ---------- formatação ----------
  cell(row: Record<string, unknown>, column: Column): string {
    const value = row[column.key];
    if (value == null || value === '') return '—';
    if (Array.isArray(value)) return value.join(', ');
    switch (column.format) {
      case 'pct':
        return this.percent(value as number);
      case 'min':
        return `${String(value).replace('.', ',')} min`;
      case 'num':
        return (value as number).toLocaleString('pt-BR');
      case 'date':
        return this.dateBr(String(value));
      default:
        if (column.key === 'type') return value === 'delay' ? 'Atraso' : 'Incidente';
        return String(value);
    }
  }

  isNumeric(column: Column): boolean {
    return column.format !== 'text' && column.format !== 'date';
  }

  percent(rate: number | null | undefined): string {
    if (rate == null) return '—';
    const value = rate * 100;
    if (value > 0 && value < 0.1) return '<0,1%';
    return value > 0 && value < 10 ? `${value.toFixed(1).replace('.', ',')}%` : `${Math.round(value)}%`;
  }

  dateBr(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  weekday(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
  }

  format(n: number): string {
    return n.toLocaleString('pt-BR');
  }
}
