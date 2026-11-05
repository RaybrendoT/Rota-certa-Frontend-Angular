import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { Route, RouteListResponse } from '../../../route/models/route';
import { RouteService } from '../../../route/service/route.service';
import { RouteEvent, RouteEventListResponse } from '../../models/route-event';
import { RouteEventService } from '../../service/route-event.service';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { extractPaginatedCount, extractPaginatedItems } from '../../../../shared/utils/paginated-response.util';

@Component({
  selector: 'app-route-event-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatPaginatorModule, MatTableModule],
  templateUrl: './route-event-list.component.html',
  styleUrl: './route-event-list.component.scss'
})
export class RouteEventListComponent implements OnInit, OnDestroy {
  private routeEventService = inject(RouteEventService);
  private routeService = inject(RouteService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);

  /** Filtro por tipo vindo da URL (?tipo=incident,delay), usado pelos alertas da tela inicial. */
  typeFilter: string[] = [];

  events: RouteEvent[] = [];
  totalCount = 0;
  displayedColumns: string[] = ['route', 'event_type', 'description', 'timestamp', 'actions'];
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
  private routeNamesById = new Map<number, string>();

  private destroy$ = new Subject<void>();
  private pageChange$ = new Subject<PageEvent>();

  ngOnInit(): void {
    this.loadRoutes();
    this.activatedRoute.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.typeFilter = (params.get('tipo') ?? '').split(',').filter(Boolean);
      this.pageIndex = 0;
      this.loadEvents();
    });

    this.pageChange$
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(event => {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadEvents(this.pageIndex, this.pageSize);
      });
  }

  loadRoutes(): void {
    this.routeService.getAll().subscribe({
      next: (response) => {
        this.routeNamesById = new Map(
          this.getRoutesFromResponse(response).map(route => [route.id!, route.name])
        );
      },
      error: (err) => console.error('Erro ao carregar rotas:', err)
    });
  }

  loadEvents(pageIndex: number = this.pageIndex, pageSize: number = this.pageSize): void {
    this.routeEventService.getAll({
      page: pageIndex + 1,
      page_size: pageSize,
      event_type: this.typeFilter.join(','),
    }).subscribe({
      next: (response) => {
        const items = this.getEventsFromResponse(response);
        this.events = items;
        this.totalCount = this.getTotalCountFromResponse(response, items.length);
      },
      error: (err) => {
        console.error('Erro ao carregar eventos:', err);
        this.totalCount = 0;
        this.events = [];
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadEvents(this.pageIndex, this.pageSize);
  }

  deleteEvent(id: number): void {
    if (confirm('Tem certeza que deseja excluir este evento?')) {
      this.routeEventService.delete(id).subscribe({
        next: () => this.loadEvents(),
        error: (err) => console.error('Erro ao excluir evento:', err)
      });
    }
  }

  getEventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      departure: 'Saída',
      stop: 'Parada',
      delay: 'Atraso',
      incident: 'Incidente',
      arrival: 'Chegada'
    };
    return labels[type] ?? type;
  }

  get typeFilterLabel(): string {
    return this.typeFilter.map(type => this.getEventTypeLabel(type)).join(', ');
  }

  clearTypeFilter(): void {
    this.router.navigate([], { relativeTo: this.activatedRoute, queryParams: { tipo: null }, queryParamsHandling: 'merge' });
  }

  getRouteLabel(routeId: number): string {
    return this.routeNamesById.get(routeId) ?? String(routeId);
  }

  private getEventsFromResponse(response: RouteEventListResponse | RouteEvent[]): RouteEvent[] {
    return extractPaginatedItems<RouteEvent>(response);
  }

  private getRoutesFromResponse(response: RouteListResponse | Route[]): Route[] {
    return extractPaginatedItems<Route>(response);
  }

  private getTotalCountFromResponse(response: any, fallbackLength: number): number {
    return extractPaginatedCount(response, fallbackLength);
  }

    ngOnDestroy(): void {
      this.destroy$.next();
      this.destroy$.complete();
    }
}
