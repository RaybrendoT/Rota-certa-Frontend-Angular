import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { Company, CompanyListResponse } from '../../../company/models/company';
import { CompanyService } from '../../../company/service/company.service';
import { Schedule, ScheduleListResponse } from '../../models/schedule';
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
  private companyService = inject(CompanyService);

  schedules: Schedule[] = [];
  totalCount = 0;
  displayedColumns: string[] = ['company', 'weekdays', 'time', 'is_active', 'actions'];
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
  private companyNamesById = new Map<number, string>();

  ngOnInit(): void {
    this.loadCompanies();
    this.loadSchedules();
  }

  loadCompanies(): void {
    this.companyService.options().subscribe({
      next: (response) => {
        this.companyNamesById = new Map(
          this.getCompaniesFromResponse(response).map(company => [company.id, company.name])
        );
      },
      error: (err) => console.error('Erro ao carregar empresas:', err)
    });
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

  getWeekdaysLabel(weekdays: string[]): string {
    return weekdays?.join(', ') || '-';
  }

  getCompanyLabel(companyId: number): string {
    return this.companyNamesById.get(companyId) ?? String(companyId);
  }

  private getSchedulesFromResponse(response: ScheduleListResponse | Schedule[]): Schedule[] {
    return extractPaginatedItems<Schedule>(response);
  }

  private getCompaniesFromResponse(response: CompanyListResponse | Company[]): Company[] {
    return extractPaginatedItems<Company>(response);
  }

  private getTotalCountFromResponse(response: any, fallbackLength: number): number {
    return extractPaginatedCount(response, fallbackLength);
  }
}
