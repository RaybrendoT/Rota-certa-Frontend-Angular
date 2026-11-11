import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Schedule, ScheduleListResponse } from '../../models/schedule';
import { formatWeekdays, sortWeekdays, WEEKDAYS, WeekdayCode } from '../../models/weekdays';
import { ScheduleService } from '../../service/schedule.service';
import { extractPaginatedCount, extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';

type StatusFilter = 'all' | 'active' | 'inactive';
type PeriodFilter = '' | 'morning' | 'afternoon' | 'night';

interface ScheduleFilters {
  status: StatusFilter;
  weekday: WeekdayCode | '';
  period: PeriodFilter;
}

const EMPTY_FILTERS: ScheduleFilters = { status: 'all', weekday: '', period: '' };

@Component({
  selector: 'app-schedule-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './schedule-list.component.html',
  styleUrl: './schedule-list.component.scss'
})
export class ScheduleListComponent implements OnInit {
  private scheduleService = inject(ScheduleService);

  schedules: Schedule[] = [];
  totalCount = 0;
  // Sem coluna de empresa: o gestor só vê os turnos da própria empresa.
  displayedColumns: string[] = ['weekdays', 'time', 'is_active', 'actions'];
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
  loading = false;

  readonly weekdays = WEEKDAYS;
  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Ativo' },
    { value: 'inactive', label: 'Inativo' },
  ];
  readonly periodOptions: { value: PeriodFilter; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'morning', label: 'Manhã (antes das 12h)' },
    { value: 'afternoon', label: 'Tarde (12h às 18h)' },
    { value: 'night', label: 'Noite (a partir das 18h)' },
  ];
  /** O que está nos campos; só vale para a lista depois de "Aplicar". */
  filters: ScheduleFilters = { ...EMPTY_FILTERS };
  private applied: ScheduleFilters = { ...EMPTY_FILTERS };

  ngOnInit(): void {
    this.loadSchedules();
  }

  loadSchedules(pageIndex: number = this.pageIndex, pageSize: number = this.pageSize): void {
    this.loading = true;
    this.scheduleService.getAll({
      page: pageIndex + 1,
      page_size: pageSize,
      status: this.applied.status,
      weekday: this.applied.weekday,
      period: this.applied.period,
    }).subscribe({
      next: (response) => {
        this.loading = false;
        const items = this.getSchedulesFromResponse(response);
        this.schedules = items;
        this.totalCount = this.getTotalCountFromResponse(response, items.length);
      },
      error: (err) => {
        console.error('Erro ao carregar horários:', err);
        this.loading = false;
        this.totalCount = 0;
        this.schedules = [];
      }
    });
  }

  /** Aplica os filtros escolhidos e volta para a primeira página. */
  applyFilters(): void {
    this.applied = { ...this.filters };
    this.pageIndex = 0;
    this.loadSchedules(0, this.pageSize);
  }

  clearFilters(): void {
    this.filters = { ...EMPTY_FILTERS };
    this.applyFilters();
  }

  get hasFilters(): boolean {
    const { status, weekday, period } = this.applied;
    return status !== EMPTY_FILTERS.status || !!weekday || !!period;
  }

  get filtersPending(): boolean {
    return (
      this.filters.status !== this.applied.status ||
      this.filters.weekday !== this.applied.weekday ||
      this.filters.period !== this.applied.period
    );
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadSchedules(this.pageIndex, this.pageSize);
  }

  deleteSchedule(id: number): void {
    if (confirm('Tem certeza que deseja excluir este horário?')) {
      this.scheduleService.delete(id).subscribe({
        next: () => this.loadSchedules(),
        error: (err) => console.error('Erro ao excluir horário:', err)
      });
    }
  }

  /** ["MON", …, "FRI"] → "Seg a Sex". */
  getWeekdaysLabel(weekdays: string[]): string {
    return formatWeekdays(weekdays);
  }

  /** Nomes completos, para o tooltip: "Segunda-feira, Terça-feira, …". */
  getWeekdaysTooltip(weekdays: string[]): string {
    return sortWeekdays(weekdays).map(code => WEEKDAYS.find(day => day.code === code)?.long).join(', ');
  }

  /** "06:30:00" → "06:30". */
  getTimeLabel(time: string): string {
    return (time ?? '').slice(0, 5) || '-';
  }

  private getSchedulesFromResponse(response: ScheduleListResponse | Schedule[]): Schedule[] {
    return extractPaginatedItems<Schedule>(response);
  }

  private getTotalCountFromResponse(response: any, fallbackLength: number): number {
    return extractPaginatedCount(response, fallbackLength);
  }
}
