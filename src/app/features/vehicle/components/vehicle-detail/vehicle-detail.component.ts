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
import { EmployeeService } from '../../../employee/services/employee.service';
import { PaginatedPeople, Person } from '../../../employee/models/person';
import { VehicleService } from '../../service/vehicle.service';
import { Vehicle } from '../../models/vehicle';

@Component({
  selector: 'app-vehicle-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './vehicle-detail.component.html',
  styleUrl: './vehicle-detail.component.scss'
})
export class VehicleDetailComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vehicleService = inject(VehicleService);
  private companyService = inject(CompanyService);
  private employeeService = inject(EmployeeService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form!: FormGroup;
  isEdit = false;
  vehicleId: number | null = null;
  companyList: Company[] = [];
  driverList: Person[] = [];

  ngOnInit(): void {
    this.form = this.fb.group({
      company: [null, Validators.required],
      driver: [null, Validators.required],
      plate_number: ['', Validators.required],
      model: ['', Validators.required],
      capacity: [0, Validators.required],
      is_active: [true]
    });
    this.loadCompanies();
    this.loadDrivers();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.vehicleId = +id;
      this.loadVehicle(this.vehicleId);
    }
  }

  loadVehicle(id: number): void {
    this.vehicleService.getById(id).subscribe({
      next: (vehicle) => this.form.patchValue({
        ...vehicle,
        driver: this.getRefId(vehicle.driver)
      }),
      error: (err) => console.error('Erro ao carregar veículo:', err)
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

  loadDrivers(): void {
    this.employeeService.getAll({ type: 'DRIVER', page_size: 500 }).subscribe({
      next: (response) => {
        this.driverList = this.getPeopleFromResponse(response)
          .filter(person => person.type === 'DRIVER');
      },
      error: (err) => console.error('Erro ao carregar motoristas:', err)
    });
  }

  save(): void {
    if (this.form.invalid) return;

    const data: Partial<Vehicle> = {
      ...this.form.value,
      company: Number(this.form.value.company),
      driver: Number(this.form.value.driver),
      capacity: Number(this.form.value.capacity)
    };

    const request$ = this.isEdit && this.vehicleId
      ? this.vehicleService.patch(this.vehicleId, data)
      : this.vehicleService.create(data);

    request$.subscribe({
      next: () => this.router.navigate(['/veiculos']),
      error: (err) => console.error('Erro ao salvar veículo:', err)
    });
  }

  cancel(): void {
    this.router.navigate(['/veiculos']);
  }

  getDriverLabel(driver: Person): string {
    return driver.license_number ? `${driver.license_number} - ${driver.name}` : driver.name;
  }

  private getRefId(value: number | { id?: number } | null | undefined): number | null {
    if (!value) return null;
    return typeof value === 'object' ? value.id ?? null : value;
  }

  private getCompaniesFromResponse(response: CompanyListResponse | Company[]): Company[] {
    if (Array.isArray(response)) return response;
    return response.value ?? response.results ?? [];
  }

  private getPeopleFromResponse(response: PaginatedPeople | Person[]): Person[] {
    if (Array.isArray(response)) return response;
    return response?.results ?? [];
  }
}
