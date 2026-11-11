import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { Schedule, ScheduleListResponse } from '../../models/schedule';
import { formatWeekdays } from '../../models/weekdays';
import { ScheduleService } from '../../service/schedule.service';
import { extractPaginatedCount, extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';

@Component({
  selector: 'app-schedule-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatPaginatorModule, MatTableModule],
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

  ngOnInit(): void {
    this.loadSchedules();
  }

  loadSchedules(pageIndex: number = this.pageIndex, pageSize: number = this.pageSize): void {
    this.scheduleService.getAll({ page: pageIndex + 1, page_size: pageSize }).subscribe({
      next: (response) => {
        const items = this.getSchedulesFromResponse(response);
        this.schedules = items;
        this.totalCount = this.getTotalCountFromResponse(response, items.length);
      },
      error: (err) => {
        console.error('Erro ao carregar horários:', err);
        this.totalCount = 0;
        this.schedules = [];
      }
    });
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
