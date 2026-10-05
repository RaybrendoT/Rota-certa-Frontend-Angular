import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { EmployeeService } from '../../../employee/services/employee.service';
import { Person } from '../../../employee/models/person';
import { extractPaginatedCount, extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';

/** Tela do gerente: todos os gestores já designados, de qualquer empresa. */
@Component({
  selector: 'app-manager-list',
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
  templateUrl: './manager-list.component.html',
  styleUrl: './manager-list.component.scss'
})
export class ManagerListComponent implements OnInit {
  private employeeService = inject(EmployeeService);

  managers: Person[] = [];
  totalCount = 0;
  displayedColumns: string[] = ['name', 'company', 'phone', 'code', 'is_active', 'actions'];
  errorMessage = '';
  isLoading = false;
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];

  ngOnInit(): void {
    this.loadManagers();
  }

  loadManagers(pageIndex: number = this.pageIndex, pageSize: number = this.pageSize): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.employeeService.getAll({ role: 'MANAGER', page: pageIndex + 1, page_size: pageSize }).subscribe({
      next: (response) => {
        const items = extractPaginatedItems<Person>(response);
        this.managers = items;
        this.totalCount = extractPaginatedCount(response, items.length);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erro ao carregar gestores:', err);
        this.errorMessage = 'Não foi possível carregar os gestores.';
        this.totalCount = 0;
        this.managers = [];
        this.isLoading = false;
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadManagers(this.pageIndex, this.pageSize);
  }

  getCompanyLabel(manager: Person): string {
    if (manager.company_name) return manager.company_name;
    const company = manager.company;
    if (company && typeof company === 'object') return company.name ?? company.company_name ?? '-';
    return '-';
  }

  demote(manager: Person): void {
    if (!manager.id) return;
    if (!confirm(`Remover o perfil de gestor de "${manager.name}"?`)) return;

    this.employeeService.setAccessRole(manager.id, 'EMPLOYEE').subscribe({
      next: () => this.loadManagers(),
      error: (err) => {
        console.error('Erro ao rebaixar gestor:', err);
        alert('Não foi possível remover o perfil de gestor.');
      }
    });
  }
}
