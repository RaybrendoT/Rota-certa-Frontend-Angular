import { Component, HostListener, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EmployeeService } from '../../services/employee.service';
import { HomeAddress, Person, PersonOverview, PersonRoute } from '../../models/person';
import { ROLE_LABELS } from '../../../../core/models/auth.model';
import { AuthService } from '../../../../core/services/auth.service';
import { DialogComponent } from '../../../../shared/dialog/dialog.component';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { extractPaginatedCount, extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';

/** Tipo de acesso no filtro: o tipo da pessoa (motorista) ou o perfil da conta (gestor, gerente). */
export type AccessFilter = '' | 'DRIVER' | 'EMPLOYEE' | 'MANAGER' | 'GERENTE';
export type StatusFilter = 'all' | 'active' | 'inactive';

interface EmployeeFilters {
  access: AccessFilter;
  status: StatusFilter;
  search: string;
}

const EMPTY_FILTERS: EmployeeFilters = { access: '', status: 'all', search: '' };

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTooltipModule
  ],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss'
})
export class EmployeeListComponent implements OnInit, OnDestroy {
  private employeeService = inject(EmployeeService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  readonly auth = inject(AuthService);

  employees: Person[] = [];
  totalCount = 0;
  // Tipo, acesso e telefone ficam como badges sob o nome e no painel lateral. Empresa só para o
  // gerente: para o gestor é sempre a mesma.
  displayedColumns: string[] = this.auth.isGerente()
    ? ['name', 'company', 'code', 'is_active', 'actions']
    : ['name', 'code', 'is_active', 'actions'];

  /** Pessoa aberta no painel lateral. */
  selected: Person | null = null;
  overview: PersonOverview | null = null;
  overviewLoading = false;
  overviewError: string | null = null;
  pageIndex = 0;
  pageSize = 10;

  readonly accessOptions: { value: AccessFilter; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'DRIVER', label: 'Motorista' },
    { value: 'EMPLOYEE', label: 'Funcionário' },
    { value: 'MANAGER', label: 'Gestor' },
    { value: 'GERENTE', label: 'Gerente' },
  ];
  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Ativo' },
    { value: 'inactive', label: 'Inativo' },
  ];
  /** O que está nos campos do filtro; só vale para a lista depois de "Aplicar" (ou Enter na busca). */
  filters: EmployeeFilters = { ...EMPTY_FILTERS };
  /** Filtros da lista exibida (vão para a API em cada página). */
  private applied: EmployeeFilters = { ...EMPTY_FILTERS };
  loading = false;
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
    this.loading = true;
    this.employeeService.getAll({
      page: pageIndex + 1,
      page_size: pageSize,
      access: this.applied.access,
      status: this.applied.status,
      search: this.applied.search.trim(),
    }).subscribe({
      next: (response) => {
        this.loading = false;
        const items = this.getEmployeesFromResponse(response);
        this.employees = items;
        this.totalCount = this.getTotalCountFromResponse(response, items.length);
      },
      error: (err) => {
        console.error('Erro ao carregar funcionários:', err);
        this.loading = false;
        this.totalCount = 0;
        this.employees = [];
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageChange$.next(event);
  }

  /** Aplica os filtros escolhidos e volta para a primeira página. */
  applyFilters(): void {
    this.applied = { ...this.filters, search: this.filters.search.trim() };
    this.pageIndex = 0;
    this.loadEmployees(0, this.pageSize);
  }

  clearFilters(): void {
    this.filters = { ...EMPTY_FILTERS };
    this.applyFilters();
  }

  get hasFilters(): boolean {
    const { access, status, search } = this.applied;
    return !!access || status !== EMPTY_FILTERS.status || !!search;
  }

  /** Os campos mudaram e ainda não foram aplicados. */
  get filtersPending(): boolean {
    return (
      this.filters.access !== this.applied.access ||
      this.filters.status !== this.applied.status ||
      this.filters.search.trim() !== this.applied.search
    );
  }



  openDetails(employee: Person): void {
    this.selected = employee;
    this.overview = null;
    this.overviewError = null;
    if (!employee.id) return;
    this.overviewLoading = true;
    this.employeeService.overview(employee.id).subscribe({
      next: (overview) => {
        // Ignora respostas atrasadas de quem já não está selecionado.
        if (this.selected?.id !== employee.id) return;
        this.overview = overview;
        this.overviewLoading = false;
      },
      error: (err) => {
        if (this.selected?.id !== employee.id) return;
        this.overviewLoading = false;
        this.overviewError = extractErrorMessage(err, 'Não foi possível carregar os detalhes.');
      }
    });
  }

  /** Abre outro cadastro da mesma pessoa (ex.: o vínculo de motorista) no painel. */
  openLinked(id: number): void {
    const inPage = this.employees.find(employee => employee.id === id);
    if (inPage) {
      this.openDetails(inPage);
      return;
    }
    this.employeeService.getById(id).subscribe({
      next: (person) => this.openDetails(person),
      error: (err) => this.overviewError = extractErrorMessage(err, 'Não foi possível abrir o outro cadastro.')
    });
  }

  @HostListener('document:keydown.escape')
  closeDetails(): void {
    this.selected = null;
    this.overview = null;
  }

  deleteEmployee(employee: Person): void {
    this.dialog
      .open(DialogComponent, {
        data: {
          message: `Excluir ${employee.name}?`,
          description:
            `${this.getTypeLabel(employee.type)} ${employee.employee_code || employee.license_number || ''}`.trim() +
            '. A pessoa sai das rotas e perde o acesso ao app. Esta ação não pode ser desfeita.'
        }
      })
      .afterClosed()
      .subscribe(confirmed => {
        if (!confirmed || !employee.id) return;
        this.employeeService.delete(employee.id).subscribe({
          next: () => {
            if (this.selected?.id === employee.id) this.closeDetails();
            this.snackBar.open(`${employee.name} foi excluído(a).`, 'OK', { duration: 4000 });
            this.loadEmployees();
          },
          error: (err) => this.snackBar.open(extractErrorMessage(err, 'Não foi possível excluir.'), 'OK', { duration: 6000 })
        });
      });
  }

  linkedRecords(): PersonOverview['linked_records'] {
    return this.overview?.linked_records ?? [];
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  getCode(person: Pick<Person, 'employee_code' | 'license_number'>): string {
    return person.employee_code || person.license_number || '-';
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '-';
    return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR');
  }

  /** "Seg a Sáb", "Seg, Qua e Sex" ou "-". */
  weekdaysLabel(codes: string[]): string {
    const order = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const names = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const days = codes.map(code => order.indexOf(code)).filter(index => index >= 0).sort((a, b) => a - b);
    if (!days.length) return '-';
    if (days.length === 7) return 'Todos os dias';
    const contiguous = days.every((day, i) => i === 0 || day === days[i - 1] + 1);
    if (contiguous && days.length > 2) return `${names[days[0]]} a ${names[days[days.length - 1]]}`;
    const labels = days.map(day => names[day]);
    return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
  }

  routeWhen(route: PersonRoute): string {
    if (route.service_date) return `Rota extra · ${this.formatDate(route.service_date)}`;
    if (!route.arrival) return 'Rota fixa sem horário definido';
    return `Chegada às ${route.arrival ?? '--:--'} · ${this.weekdaysLabel(route.weekdays)}`;
  }

  addressLine(address: HomeAddress): string {
    const street = [`${address.street}, ${address.number}`, address.complement].filter(Boolean).join(' - ');
    return [street, address.neighborhood, `${address.city}/${address.state}`].filter(Boolean).join(' · ');
  }

  /** "Informado pelo colaborador via GPS (±12 m) em 03/11/2026" ou "Cadastrado no painel em ...". */
  addressOrigin(address: HomeAddress): string {
    const when = this.formatDate(address.created_at);
    const review = { pending: ' · aguardando aprovação', approved: ' · aprovado', rejected: ' · recusado', '': '' }[address.review_status ?? ''];
    if (address.source === 'gps') {
      const accuracy = address.accuracy_m != null ? ` (±${Math.round(address.accuracy_m)} m)` : '';
      return `Informado pelo colaborador via GPS${accuracy} em ${when}${review}`;
    }
    if (address.source === 'typed') {
      const approximate = address.precision === 'approximate' ? ', posição ajustada no mapa' : '';
      return `Digitado pelo colaborador${approximate} em ${when}${review}`;
    }
    return `Cadastrado no painel em ${when}`;
  }

  mapsLink(address: HomeAddress): string {
    return `https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`;
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
