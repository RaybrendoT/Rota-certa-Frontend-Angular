import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { EmployeeService } from '../../services/employee.service';
import { AuthService } from '../../../../core/services/auth.service';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule
  ],
  templateUrl: './employee-detail.component.html',
  styleUrl: './employee-detail.component.scss'
})
export class EmployeeDetailComponent implements OnInit {
  private fb = inject(FormBuilder);
  private employeeService = inject(EmployeeService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form!: FormGroup;
  isEdit = false;
  employeeId: number | null = null;

  /**
   * O gestor só cadastra/edita gente da própria empresa (o backend rejeita qualquer outra),
   * então a empresa nem é um campo editável aqui: é sempre a de quem está logado.
   */
  private readonly companyId = this.auth.person()?.company_id ?? null;

  ngOnInit(): void {
    this.initForm();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.employeeId = +id;
      this.loadEmployee(this.employeeId);
    }
  }

  initForm(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      phone: ['', Validators.required],
      type: ['EMPLOYEE', Validators.required],
      license_number: [null],
      employee_code: [null],
      is_active: [true]
    });

    this.form.get('type')?.valueChanges.subscribe(type => {
      this.updateValidators(type);
    });
  }

  updateValidators(type: string): void {
    const license = this.form.get('license_number');
    const code = this.form.get('employee_code');

    if (type === 'DRIVER') {
      license?.setValidators([Validators.required]);
      code?.clearValidators();
      code?.setValue(null);
    } else {
      code?.setValidators([Validators.required]);
      license?.clearValidators();
      license?.setValue(null);
    }
    license?.updateValueAndValidity();
    code?.updateValueAndValidity();
  }

  loadEmployee(id: number): void {
    this.employeeService.getById(id).subscribe({
      next: (employee) => {
        this.form.patchValue(employee);
        this.updateValidators(employee.type);
      },
      error: (err) => console.error('Erro ao carregar funcionário:', err)
    });
  }

  save(): void {
    if (this.form.invalid || this.companyId == null) return;

    const data = this.form.value;
    const type = String(data.type ?? '').toUpperCase();
    const payload = {
      ...data,
      type,
      company: this.companyId
    } as any;

    if (type === 'EMPLOYEE') {
      payload.license_number = null;
    } else if (type === 'DRIVER') {
      payload.employee_code = null;
    }

    if (this.isEdit && this.employeeId) {
      this.employeeService.patch(this.employeeId, payload).subscribe({
        next: () => this.router.navigate(['/funcionarios']),
        error: (err) => {
          console.error('Erro ao atualizar:', err?.error ?? err);
          alert(extractErrorMessage(err, 'Não foi possível atualizar o funcionário.'));
        }
      });
    } else {
      this.employeeService.create(payload).subscribe({
        next: () => this.router.navigate(['/funcionarios']),
        error: (err) => {
          console.error('Erro ao criar:', err?.error ?? err);
          alert(extractErrorMessage(err, 'Não foi possível criar o funcionário.'));
        }
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/funcionarios']);
  }
}
