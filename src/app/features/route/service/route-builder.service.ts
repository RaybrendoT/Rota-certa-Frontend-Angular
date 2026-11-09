import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import {
  BuilderOptions,
  BuilderVehicle,
  LoadedRoute,
  RouteInput,
  RoutePreview,
  SavedRoute,
} from '../models/route-builder';

/** Criação e edição manual de rotas (stepper): opções, prévia e gravação. */
@Injectable({ providedIn: 'root' })
export class RouteBuilderService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get url(): string {
    return `${this.config.getApiBaseUrl()}/route-builder`;
  }

  options(): Observable<BuilderOptions> {
    return this.http.get<BuilderOptions>(`${this.url}/options/`);
  }

  vehicles(schedule: number, serviceDate: string | null, route: number | null): Observable<{ vehicles: BuilderVehicle[] }> {
    let params = new HttpParams().set('schedule', schedule);
    if (serviceDate) params = params.set('service_date', serviceDate);
    if (route) params = params.set('route', route);
    return this.http.get<{ vehicles: BuilderVehicle[] }>(`${this.url}/vehicles/`, { params });
  }

  preview(input: RouteInput): Observable<RoutePreview> {
    return this.http.post<RoutePreview>(`${this.url}/preview/`, input);
  }

  get(id: number): Observable<LoadedRoute> {
    return this.http.get<LoadedRoute>(`${this.url}/${id}/`);
  }

  create(input: RouteInput): Observable<SavedRoute> {
    return this.http.post<SavedRoute>(`${this.url}/`, input);
  }

  update(id: number, input: RouteInput): Observable<SavedRoute> {
    return this.http.put<SavedRoute>(`${this.url}/${id}/`, input);
  }
}
