import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { EmployeeService } from '../../services/employee.service';
import { Person } from '../../models/person';
import { ROLE_LABELS } from '../../../../core/models/auth.model';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { extractPaginatedCount, extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatPaginatorModule
  ],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss'
})
export class EmployeeListComponent implements OnInit, OnDestroy {
  private employeeService = inject(EmployeeService);

  employees: Person[] = [];
  totalCount = 0;
  displayedColumns: string[] = ['name', 'company', 'phone', 'type', 'role', 'code', 'is_active', 'actions'];
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];

  private destroy$ = new Subject<void>();
  private pageChange$ = new Subject<PageEvent>();

  ngOnInit(): void {
    this.loadEmployees();

    this.pageChange$
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(event => {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadEmployees(this.pageIndex, this.pageSize);
      });
  }

  loadEmployees(pageIndex: number = this.pageIndex, pageSize: number = this.pageSize): void {
    this.employeeService.getAll({ page: pageIndex + 1, page_size: pageSize }).subscribe({
      next: (response) => {
        console.log('Resposta da API:', response); // ← útil para debug
        const items = this.getEmployeesFromResponse(response);
        this.employees = items;
        this.totalCount = this.getTotalCountFromResponse(response, items.length);
      },
      error: (err) => {
        console.error('Erro ao carregar funcionários:', err);
        this.totalCount = 0;
        this.employees = [];
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageChange$.next(event);
  }



  deleteEmployee(id: number): void {
    if (confirm('Tem certeza que deseja excluir este funcionário?')) {
      this.employeeService.delete(id).subscribe({
        next: () => this.loadEmployees(),
        error: (err) => console.error('Erro ao excluir:', err)
      });
    }
  }

  getTypeLabel(type: Person['type'] | string | null | undefined): string {
    const normalizedType = String(type ?? '').trim().toUpperCase();
    const labels: Record<string, string> = {
      EMPLOYEE: 'Funcionário',
      DRIVER: 'Motorista'
    };

    return labels[normalizedType] ?? '-';
  }

  getRoleLabel(role: Person['role']): string {
    return role ? ROLE_LABELS[role] : '-';
  }

  isEmployeeType(type: Person['type'] | string | null | undefined): boolean {
    return String(type ?? '').trim().toUpperCase() === 'EMPLOYEE';
  }

  getCompanyLabel(employee: Person): string {
    if (employee.company_name) return employee.company_name;

    const company = employee.company;
    if (!company) return '-';
    if (typeof company === 'object') return company.name || company.company_name || '-';
    return '-';
  }

  private getEmployeesFromResponse(response: any): Person[] {
    return extractPaginatedItems<Person>(response);
  }

  private getTotalCountFromResponse(response: any, fallbackLength: number): number {
    return extractPaginatedCount(response, fallbackLength);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
