import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CompanyService } from '../../service/company.service';

@Component({
  selector: 'app-company-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './company-detail.component.html',
  styleUrl: './company-detail.component.scss'
})
export class CompanyDetailComponent implements OnInit {
  private fb = inject(FormBuilder);
  private companyService = inject(CompanyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form!: FormGroup;
  isEdit = false;
  companyId: number | null = null;

  ngOnInit(): void {
    this.initForm();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.companyId = +id;
      this.loadCompany(this.companyId);
    }
  }

  initForm(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      is_active: [true, Validators.required]
    });
  }

  loadCompany(id: number): void {
    this.companyService.getById(id).subscribe({
      next: (company) => {
        this.form.patchValue({
          name: company.name,
          is_active: company.is_active
        });
      },
      error: (err) => console.error('Erro ao carregar empresa:', err)
    });
  }

  save(): void {
    if (this.form.invalid) return;

    const data = this.form.value;

    if (this.isEdit && this.companyId) {
      this.companyService.patch(this.companyId, data).subscribe({
        next: () => this.router.navigate(['/company']),
        error: (err) => console.error('Erro ao atualizar empresa:', err)
      });
    } else {
      this.companyService.create(data).subscribe({
        // Empresa nova: já emenda no cadastro do gestor dela (o gerente faz os dois de uma vez).
        next: (company) => this.router.navigate(['/gestores/novo'], { queryParams: { company_id: company.id } }),
        error: (err) => console.error('Erro ao criar empresa:', err)
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/company']);
  }
}
