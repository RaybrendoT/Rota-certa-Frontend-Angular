import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { DashboardSummary } from '../models/dashboard-summary';

/** Números do dia para a tela inicial do gestor. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** `date` no formato AAAA-MM-DD; sem data, o backend usa hoje (fuso de Manaus). */
  summary(date?: string): Observable<DashboardSummary> {
    const params: Record<string, string> = date ? { date } : {};
    return this.http.get<DashboardSummary>(`${this.config.getApiBaseUrl()}/dashboard/summary/`, { params });
  }
}
