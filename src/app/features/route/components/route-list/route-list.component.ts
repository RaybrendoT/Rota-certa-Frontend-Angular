import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { Vehicle, VehicleListResponse } from '../../../vehicle/models/vehicle';
import { VehicleService } from '../../../vehicle/service/vehicle.service';
import { Route, RouteKindFilter, RouteListResponse } from '../../models/route';
import { RouteService } from '../../service/route.service';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { extractPaginatedCount, extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';

@Component({
  selector: 'app-route-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatButtonToggleModule, MatCardModule, MatIconModule, MatPaginatorModule, MatTableModule],
  templateUrl: './route-list.component.html',
  styleUrl: './route-list.component.scss'
})
export class RouteListComponent implements OnInit, OnDestroy {
  private routeService = inject(RouteService);
  private vehicleService = inject(VehicleService);

  routes: Route[] = [];
  totalCount = 0;
  // Sem coluna de empresa: o gestor só vê as rotas da própria empresa.
  displayedColumns: string[] = ['name', 'kind', 'vehicle', 'is_active', 'actions'];
  kindFilter: RouteKindFilter = 'all';
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
  private vehiclePlatesById = new Map<number, string>();

  private destroy$ = new Subject<void>();
  private pageChange$ = new Subject<PageEvent>();

  ngOnInit(): void {
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
    const params: Record<string, string | number> = { page: pageIndex + 1, page_size: pageSize };
    if (this.kindFilter !== 'all') {
      params['kind'] = this.kindFilter;
    }
    this.routeService.getAll(params).subscribe({
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

  onKindChange(kind: RouteKindFilter): void {
    this.kindFilter = kind;
    this.pageIndex = 0;
    this.loadRoutes(0, this.pageSize);
  }

  /** "Fixa" para rota diária; "Avulsa · 10/11/2026" para rota montada para um dia. */
  getKindLabel(route: Route): string {
    if (!route.service_date) {
      return 'Fixa (diária)';
    }
    const [year, month, day] = route.service_date.split('-');
    return `Avulsa · ${day}/${month}/${year}`;
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

  getVehicleLabel(vehicleId: number | null): string {
    if (vehicleId == null) {
      return 'Sem veículo';
    }
    return this.vehiclePlatesById.get(vehicleId) ?? String(vehicleId);
  }

  private getRoutesFromResponse(response: RouteListResponse | Route[]): Route[] {
    return extractPaginatedItems<Route>(response);
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
