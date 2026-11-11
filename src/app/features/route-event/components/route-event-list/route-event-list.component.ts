import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { extractPaginatedCount, extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';
import {
  OCCURRENCE_SOURCE_LABELS,
  OCCURRENCE_STATUS_LABELS,
  OccurrenceSource,
  OccurrenceType,
  RouteEvent,
} from '../../models/route-event';
import { RouteEventService } from '../../service/route-event.service';
import { ResolveDialogComponent } from '../resolve-dialog/resolve-dialog.component';

type PeriodFilter = 'today' | '7d' | '30d' | 'all';
type StatusFilter = 'pending' | 'open' | 'in_progress' | 'resolved' | 'all';

interface OccurrenceFilters {
  period: PeriodFilter;
  type: OccurrenceType | '';
  status: StatusFilter;
  source: OccurrenceSource | '';
  search: string;
}

/** Padrão: o que ainda pede ação (abertas e em andamento) dos últimos 7 dias. */
const DEFAULT_FILTERS: OccurrenceFilters = { period: '7d', type: '', status: 'pending', source: '', search: '' };

const AUTO_CODE_LABELS: Record<string, string> = {
  not_started: 'Não iniciada no horário',
  overdue: 'Passou do horário',
  late_arrival: 'Chegou atrasada',
};

/**
 * Ocorrências do dia a dia (atrasos e incidentes) enviadas pelo motorista, registradas pelo gestor
 * ou detectadas pelo sistema, com o ciclo aberta → em andamento → resolvida.
 */
@Component({
  selector: 'app-route-event-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './route-event-list.component.html',
  styleUrl: './route-event-list.component.scss'
})
export class RouteEventListComponent implements OnInit, OnDestroy {
  private routeEventService = inject(RouteEventService);
  private activatedRoute = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  readonly periodOptions: { value: PeriodFilter; label: string }[] = [
    { value: 'today', label: 'Hoje' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: 'all', label: 'Tudo' },
  ];
  readonly typeOptions: { value: OccurrenceType | ''; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'delay', label: 'Atraso' },
    { value: 'incident', label: 'Incidente' },
  ];
  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'pending', label: 'Em aberto (aberta ou em andamento)' },
    { value: 'open', label: OCCURRENCE_STATUS_LABELS.open },
    { value: 'in_progress', label: OCCURRENCE_STATUS_LABELS.in_progress },
    { value: 'resolved', label: OCCURRENCE_STATUS_LABELS.resolved },
    { value: 'all', label: 'Todos' },
  ];
  readonly sourceOptions: { value: OccurrenceSource | ''; label: string }[] = [
    { value: '', label: 'Todas' },
    { value: 'driver', label: OCCURRENCE_SOURCE_LABELS.driver },
    { value: 'system', label: OCCURRENCE_SOURCE_LABELS.system },
    { value: 'manager', label: OCCURRENCE_SOURCE_LABELS.manager },
  ];

  filters: OccurrenceFilters = { ...DEFAULT_FILTERS };
  private applied: OccurrenceFilters = { ...DEFAULT_FILTERS };

  events: RouteEvent[] = [];
  totalCount = 0;
  loading = false;
  busyId: number | null = null;
  displayedColumns: string[] = ['when', 'route', 'occurrence', 'description', 'source', 'status', 'actions'];
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];

  private destroy$ = new Subject<void>();
  private pageChange$ = new Subject<PageEvent>();

  ngOnInit(): void {
    // Atalhos da tela inicial: ?tipo=delay ou ?tipo=incident (em aberto).
    this.activatedRoute.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const type = params.get('tipo');
      if (type === 'delay' || type === 'incident') {
        this.filters = { ...DEFAULT_FILTERS, type };
      }
      this.applyFilters();
    });

    this.pageChange$
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(event => {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadEvents(this.pageIndex, this.pageSize);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadEvents(pageIndex: number = this.pageIndex, pageSize: number = this.pageSize): void {
    const { period, type, status, source, search } = this.applied;
    this.loading = true;
    this.routeEventService.getAll({
      page: pageIndex + 1,
      page_size: pageSize,
      occurrence: true,
      event_type: type,
      status: status === 'pending' ? 'open,in_progress' : status === 'all' ? '' : status,
      source,
      search: search.trim(),
      date_from: this.periodStart(period),
    }).subscribe({
      next: (response) => {
        this.loading = false;
        this.events = extractPaginatedItems<RouteEvent>(response);
        this.totalCount = extractPaginatedCount(response, this.events.length);
      },
      error: (err) => {
        this.loading = false;
        this.events = [];
        this.totalCount = 0;
        this.snackBar.open(extractErrorMessage(err, 'Não foi possível carregar as ocorrências.'), 'Fechar', { duration: 6000 });
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageChange$.next(event);
  }

  applyFilters(): void {
    this.applied = { ...this.filters, search: this.filters.search.trim() };
    this.pageIndex = 0;
    this.loadEvents(0, this.pageSize);
  }

  clearFilters(): void {
    this.filters = { ...DEFAULT_FILTERS };
    this.applyFilters();
  }

  get filtersChanged(): boolean {
    return JSON.stringify(this.applied) !== JSON.stringify(DEFAULT_FILTERS)
      || JSON.stringify(this.filters) !== JSON.stringify(this.applied);
  }

  // ------------------------------------------------------------------ ações

  start(event: RouteEvent): void {
    this.run(event, this.routeEventService.start(event.id!), 'Ocorrência assumida.');
  }

  resolve(event: RouteEvent): void {
    this.dialog
      .open(ResolveDialogComponent, { data: event, width: '520px', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((resolution: string | null) => {
        if (resolution) this.run(event, this.routeEventService.resolve(event.id!, resolution), 'Ocorrência resolvida.');
      });
  }

  reopen(event: RouteEvent): void {
    this.run(event, this.routeEventService.reopen(event.id!), 'Ocorrência reaberta.');
  }

  private run(event: RouteEvent, request$: ReturnType<RouteEventService['start']>, message: string): void {
    this.busyId = event.id!;
    request$.subscribe({
      next: () => {
        this.busyId = null;
        this.snackBar.open(message, 'OK', { duration: 3000 });
        this.loadEvents();
      },
      error: (err) => {
        this.busyId = null;
        this.snackBar.open(extractErrorMessage(err, 'Não foi possível atualizar a ocorrência.'), 'Fechar', { duration: 6000 });
      }
    });
  }

  // ------------------------------------------------------------------ exibição

  typeLabel(event: RouteEvent): string {
    return event.event_type === 'delay' ? 'Atraso' : 'Incidente';
  }

  detailLabel(event: RouteEvent): string {
    const parts = [
      event.auto_code ? AUTO_CODE_LABELS[event.auto_code] : event.category_label,
      event.delay_minutes ? `${event.delay_minutes} min` : '',
    ];
    return parts.filter(Boolean).join(' · ');
  }

  sourceIcon(source?: OccurrenceSource): string {
    return source === 'system' ? 'smart_toy' : source === 'manager' ? 'support_agent' : 'directions_bus';
  }

  private periodStart(period: PeriodFilter): string {
    if (period === 'all') return '';
    const days = period === 'today' ? 0 : period === '7d' ? 6 : 29;
    const date = new Date();
    date.setDate(date.getDate() - days);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
