import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { CompanyService } from '../../../company/service/company.service';
import { Company } from '../../../company/models/company';
import { EmployeeService } from '../../../employee/services/employee.service';
import { Person } from '../../../employee/models/person';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';

type Mode = 'new' | 'existing';

/**
 * Cadastro de gestor: pode ser uma pessoa nova ou a promoção de um funcionário já
 * existente da empresa. Aceita ?company_id= na URL para vir com a empresa pré-selecionada
 * (é como a lista de empresas e a criação de empresa chegam aqui).
 */
@Component({
  selector: 'app-manager-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule
  ],
  templateUrl: './manager-form.component.html',
  styleUrl: './manager-form.component.scss'
})
export class ManagerFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private companyService = inject(CompanyService);
  private employeeService = inject(EmployeeService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  managerId: number | null = null;
  isSubmitting = false;
  errorMessage = '';

  mode: Mode = 'new';
  editCompanyName = '';

  readonly companyControl = new FormControl('', { nonNullable: true, validators: Validators.required });
  filteredCompanyOptions$!: Observable<string[]>;
  private companyOptions$ = new BehaviorSubject<string[]>([]);
  private companyNamesById = new Map<number, string>();
  private companyIdsByName = new Map<string, number>();
  selectedCompanyId: number | null = null;

  existingCandidates: Person[] = [];
  readonly existingPersonId = this.fb.control<number | null>(null, Validators.required);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    employee_code: ['', Validators.required]
  });

  ngOnInit(): void {
    this.initCompanyAutocomplete();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.managerId = +id;
      this.loadManager(this.managerId);
      return;
    }

    const companyIdParam = this.route.snapshot.queryParamMap.get('company_id');
    this.loadCompanyOptions(() => {
      const preselected = companyIdParam ? this.companyNamesById.get(Number(companyIdParam)) : null;
      if (preselected) {
        this.companyControl.setValue(preselected);
      }
    });
  }

  private initCompanyAutocomplete(): void {
    this.filteredCompanyOptions$ = combineLatest([
      this.companyControl.valueChanges.pipe(startWith(this.companyControl.value)),
      this.companyOptions$
    ]).pipe(map(([value, companies]) => this.filterCompanies(value, companies)));

    this.companyControl.valueChanges.subscribe(value => {
      const key = value.trim().toLowerCase();
      this.selectedCompanyId = this.companyIdsByName.get(key) ?? null;

      if (this.selectedCompanyId && this.mode === 'existing') {
        this.loadExistingCandidates(this.selectedCompanyId);
      } else {
        this.existingCandidates = [];
        this.existingPersonId.setValue(null);
      }
    });
  }

  private loadCompanyOptions(onLoaded?: () => void): void {
    this.companyService.getAll().subscribe({
      next: (response) => {
        const list = extractPaginatedItems<Company>(response as any);
        this.companyNamesById = new Map(list.map(c => [c.id, c.name]));

        const nameToId = new Map<string, number>();
        for (const c of list) {
          const key = String(c.name ?? '').trim().toLowerCase();
          if (key && !nameToId.has(key)) nameToId.set(key, c.id);
        }
        this.companyIdsByName = nameToId;

        const names = list.map(c => c.name).filter((name): name is string => !!name?.trim());
        this.companyOptions$.next([...new Set(names)].sort((a, b) => a.localeCompare(b)));
        onLoaded?.();
      },
      error: (err) => console.error('Erro ao carregar empresas:', err)
    });
  }

  private filterCompanies(value: string, companies: string[]): string[] {
    const search = value.trim().toLowerCase();
    if (!search) return companies;
    return companies.filter(company => company.toLowerCase().includes(search));
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.existingPersonId.setValue(null);
    if (mode === 'existing' && this.selectedCompanyId) {
      this.loadExistingCandidates(this.selectedCompanyId);
    }
  }

  private loadExistingCandidates(companyId: number): void {
    this.employeeService.getAll({ company_id: companyId, type: 'EMPLOYEE', role: 'EMPLOYEE' }).subscribe({
      next: (response) => (this.existingCandidates = extractPaginatedItems<Person>(response as any)),
      error: (err) => {
        console.error('Erro ao carregar funcionários da empresa:', err);
        this.existingCandidates = [];
      }
    });
  }

  private loadManager(id: number): void {
    this.employeeService.getById(id).subscribe({
      next: (person) => {
        this.form.patchValue(person);
        this.editCompanyName = person.company_name ?? '';
      },
      error: (err) => console.error('Erro ao carregar gestor:', err)
    });
  }

  get canSubmit(): boolean {
    if (this.isSubmitting) return false;
    if (this.isEdit) return this.form.valid;
    if (this.mode === 'existing') return this.existingPersonId.valid && this.selectedCompanyId != null;
    return this.form.valid && this.selectedCompanyId != null;
  }

  save(): void {
    if (!this.canSubmit) return;
    this.errorMessage = '';
    this.isSubmitting = true;

    if (this.isEdit && this.managerId) {
      this.employeeService.patch(this.managerId, this.form.value).subscribe({
        next: () => this.router.navigate(['/gestores']),
        error: (err) => this.onError(err, 'Não foi possível atualizar o gestor.')
      });
      return;
    }

    if (this.mode === 'existing') {
      this.employeeService.setAccessRole(this.existingPersonId.value!, 'MANAGER').subscribe({
        next: () => this.router.navigate(['/gestores']),
        error: (err) => this.onError(err, 'Não foi possível promover a gestor.')
      });
      return;
    }

    const { name, phone, employee_code } = this.form.getRawValue();
    this.employeeService
      .create({
        company: this.selectedCompanyId!,
        name: name ?? '',
        phone: phone ?? '',
        employee_code: employee_code ?? '',
        type: 'EMPLOYEE',
        license_number: null,
        is_active: true
      })
      .pipe(switchMap(person => this.employeeService.setAccessRole(person.id!, 'MANAGER')))
      .subscribe({
        next: () => this.router.navigate(['/gestores']),
        error: (err) => this.onError(err, 'Não foi possível cadastrar o gestor.')
      });
  }

  demote(): void {
    if (!this.managerId) return;
    if (!confirm('Remover o perfil de gestor desta pessoa? Ela volta a ser funcionária comum.')) return;

    this.employeeService.setAccessRole(this.managerId, 'EMPLOYEE').subscribe({
      next: () => this.router.navigate(['/gestores']),
      error: (err) => alert(extractErrorMessage(err, 'Não foi possível remover o perfil de gestor.'))
    });
  }

  cancel(): void {
    this.router.navigate(['/gestores']);
  }

  private onError(err: unknown, fallback: string): void {
    this.isSubmitting = false;
    this.errorMessage = extractErrorMessage(err, fallback);
  }
}
