import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { Company, CompanyListResponse } from '../../../company/models/company';
import { CompanyService } from '../../../company/service/company.service';
import { Vehicle, VehicleListResponse } from '../../../vehicle/models/vehicle';
import { VehicleService } from '../../../vehicle/service/vehicle.service';
import { Route, RouteListResponse } from '../../models/route';
import { RouteService } from '../../service/route.service';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { extractPaginatedCount, extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';

@Component({
  selector: 'app-route-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatPaginatorModule, MatTableModule],
  templateUrl: './route-list.component.html',
  styleUrl: './route-list.component.scss'
})
export class RouteListComponent implements OnInit, OnDestroy {
  private routeService = inject(RouteService);
  private companyService = inject(CompanyService);
  private vehicleService = inject(VehicleService);

  routes: Route[] = [];
  totalCount = 0;
  displayedColumns: string[] = ['name', 'company', 'vehicle', 'is_active', 'actions'];
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
  private companyNamesById = new Map<number, string>();
  private vehiclePlatesById = new Map<number, string>();

  private destroy$ = new Subject<void>();
  private pageChange$ = new Subject<PageEvent>();

  ngOnInit(): void {
    this.loadCompanies();
    this.loadVehicles();
    this.loadRoutes();

    this.pageChange$
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(event => {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadRoutes(this.pageIndex, this.pageSize);
      });
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

  loadVehicles(): void {
    this.vehicleService.getAll({ page_size: 500 }).subscribe({
      next: (response) => {
        this.vehiclePlatesById = new Map(
          this.getVehiclesFromResponse(response).map(vehicle => [vehicle.id!, vehicle.plate_number])
        );
      },
      error: (err) => console.error('Erro ao carregar veículos:', err)
    });
  }

  loadRoutes(pageIndex: number = this.pageIndex, pageSize: number = this.pageSize): void {
    this.routeService.getAll({ page: pageIndex + 1, page_size: pageSize }).subscribe({
      next: (response) => {
        const items = this.getRoutesFromResponse(response);
        this.routes = items;
        this.totalCount = this.getTotalCountFromResponse(response, items.length);
      },
      error: (err) => {
        console.error('Erro ao carregar rotas:', err);
        this.totalCount = 0;
        this.routes = [];
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageChange$.next(event);
  }

  deleteRoute(id: number): void {
    if (confirm('Tem certeza que deseja excluir esta rota?')) {
      this.routeService.delete(id).subscribe({
        next: () => this.loadRoutes(),
        error: (err) => console.error('Erro ao excluir rota:', err)
      });
    }
  }

  getCompanyLabel(companyId: number): string {
    return this.companyNamesById.get(companyId) ?? String(companyId);
  }

  getVehicleLabel(vehicleId: number): string {
    return this.vehiclePlatesById.get(vehicleId) ?? String(vehicleId);
  }

  private getRoutesFromResponse(response: RouteListResponse | Route[]): Route[] {
    return extractPaginatedItems<Route>(response);
  }

  private getCompaniesFromResponse(response: CompanyListResponse | Company[]): Company[] {
    return extractPaginatedItems<Company>(response);
  }

  private getVehiclesFromResponse(response: VehicleListResponse | Vehicle[]): Vehicle[] {
    return extractPaginatedItems<Vehicle>(response);
  }

  private getTotalCountFromResponse(response: any, fallbackLength: number): number {
    return extractPaginatedCount(response, fallbackLength);
  }

    ngOnDestroy(): void {
      this.destroy$.next();
      this.destroy$.complete();
    }
}
