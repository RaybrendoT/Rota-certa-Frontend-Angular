import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Company, CompanyListResponse } from '../../../company/models/company';
import { CompanyService } from '../../../company/service/company.service';
import { Vehicle, VehicleListResponse } from '../../../vehicle/models/vehicle';
import { VehicleService } from '../../../vehicle/service/vehicle.service';
import { RouteService } from '../../service/route.service';
import { Route } from '../../models/route';

@Component({
  selector: 'app-route-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './route-detail.component.html',
  styleUrl: './route-detail.component.scss'
})
export class RouteDetailComponent implements OnInit {
  private fb = inject(FormBuilder);
  private routeService = inject(RouteService);
  private companyService = inject(CompanyService);
  private vehicleService = inject(VehicleService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form!: FormGroup;
  isEdit = false;
  routeId: number | null = null;
  companyList: Company[] = [];
  vehicleList: Vehicle[] = [];

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      company: [null, Validators.required],
      vehicle: [null, Validators.required],
      is_active: [true]
    });
    this.loadCompanies();
    this.loadVehicles();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.routeId = +id;
      this.loadRoute(this.routeId);
    }
  }

  loadRoute(id: number): void {
    this.routeService.getById(id).subscribe({
      next: (route) => this.form.patchValue(route),
      error: (err) => console.error('Erro ao carregar rota:', err)
    });
  }

  loadCompanies(): void {
    this.companyService.options().subscribe({
      next: (response) => {
        this.companyList = this.getCompaniesFromResponse(response);
        // Gestor: a única opção é a própria empresa; já deixa escolhida no cadastro novo.
        if (this.companyList.length === 1 && !this.form.value.company) {
          this.form.patchValue({ company: this.companyList[0].id });
        }
      },
      error: (err) => console.error('Erro ao carregar empresas:', err)
    });
  }

  loadVehicles(): void {
    this.vehicleService.getAll({ page_size: 500 }).subscribe({
      next: (response) => {
        this.vehicleList = this.getVehiclesFromResponse(response);
      },
      error: (err) => console.error('Erro ao carregar veículos:', err)
    });
  }

  save(): void {
    if (this.form.invalid) return;

    const data: Partial<Route> = {
      ...this.form.value,
      company: Number(this.form.value.company),
      vehicle: Number(this.form.value.vehicle)
    };
    const request$ = this.isEdit && this.routeId
      ? this.routeService.patch(this.routeId, data)
      : this.routeService.create(data);

    request$.subscribe({
      next: () => this.router.navigate(['/rotas']),
      error: (err) => console.error('Erro ao salvar rota:', err)
    });
  }

  cancel(): void {
    this.router.navigate(['/rotas']);
  }

  getVehicleLabel(vehicle: Vehicle): string {
    return `${vehicle.plate_number} - ${vehicle.model}`;
  }

  private getCompaniesFromResponse(response: CompanyListResponse | Company[]): Company[] {
    if (Array.isArray(response)) return response;
    return response.value ?? response.results ?? [];
  }

  private getVehiclesFromResponse(response: VehicleListResponse | Vehicle[]): Vehicle[] {
    if (Array.isArray(response)) return response;
    return response.value ?? response.results ?? [];
  }
}
