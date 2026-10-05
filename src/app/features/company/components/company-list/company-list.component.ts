import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { Subject } from 'rxjs';
import { Company } from '../../models/company';
import { CompanyService } from '../../service/company.service';
import { EmployeeService } from '../../../employee/services/employee.service';
import { Person } from '../../../employee/models/person';
import { extractPaginatedCount, extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';

@Component({
  selector: 'app-company-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatTableModule
  ],
  templateUrl: './company-list.component.html',
  styleUrl: './company-list.component.scss'
})
export class CompanyListComponent implements OnInit, OnDestroy {
  private companyService = inject(CompanyService);
  private employeeService = inject(EmployeeService);
  private router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  companies: Company[] = [];
  totalCount = 0;
  displayedColumns: string[] = ['name', 'is_active', 'actions'];
  errorMessage = '';
  isLoading = false;
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(pageIndex: number = this.pageIndex, pageSize: number = this.pageSize): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.companyService.getAll({ page: pageIndex + 1, page_size: pageSize }).subscribe({
      next: (response) => {
        const items = extractPaginatedItems<Company>(response);
        this.companies = items;
        this.totalCount = extractPaginatedCount(response, items.length);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erro ao carregar empresas:', err);
        this.errorMessage = 'Não foi possível carregar as empresas.';
        this.totalCount = 0;
        this.companies = [];
        this.isLoading = false;
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadCompanies(this.pageIndex, this.pageSize);
  }

  /** Já tem gestor? edita quem já existe. Senão, abre a criação com a empresa pré-selecionada. */
  manageGestor(company: Company): void {
    this.employeeService.getAll({ company_id: company.id, role: 'MANAGER' }).subscribe({
      next: (response) => {
        const [existing] = extractPaginatedItems<Person>(response);
        if (existing?.id) {
          this.router.navigate(['/gestores', existing.id, 'editar']);
        } else {
          this.router.navigate(['/gestores/novo'], { queryParams: { company_id: company.id } });
        }
      },
      error: (err) => {
        console.error('Erro ao verificar gestor da empresa:', err);
        this.router.navigate(['/gestores/novo'], { queryParams: { company_id: company.id } });
      }
    });
  }

  deleteCompany(id: number): void {
    if (confirm('Tem certeza que deseja excluir esta empresa?')) {
      this.companyService.delete(id).subscribe({
        next: () => this.loadCompanies(),
        error: (err) => console.error('Erro ao excluir empresa:', err)
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
