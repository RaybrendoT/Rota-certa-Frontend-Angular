import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { DashboardAlerts, DashboardFeed, DashboardSummary, DashboardTrends } from '../models/dashboard-summary';

/** Dia (AAAA-MM-DD; sem data = hoje no fuso de Manaus) e, opcionalmente, um turno. */
export interface DashboardFilter {
  date?: string;
  schedule?: number | null;
}

/** Números do dia para a tela inicial do gestor. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  summary(filter: DashboardFilter = {}): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(this.url('summary'), { params: params(filter) });
  }

  /** Pendências do dia: incidentes, atrasos, rotas sem veículo/motorista e endereços para aprovar. */
  alerts(filter: DashboardFilter = {}): Observable<DashboardAlerts> {
    return this.http.get<DashboardAlerts>(this.url('alerts'), { params: params(filter) });
  }

  /** Últimos eventos e embarques do dia, do mais novo para o mais antigo. */
  feed(filter: DashboardFilter = {}): Observable<DashboardFeed> {
    return this.http.get<DashboardFeed>(this.url('feed'), { params: params(filter) });
  }

  /** Últimos `days` dias até hoje: embarques, ausências, pontualidade e rotas com mais ausências. */
  trends(days: 7 | 14 | 30): Observable<DashboardTrends> {
    return this.http.get<DashboardTrends>(this.url('trends'), { params: { days } });
  }

  /** Rotas do dia em CSV (Excel pt-BR). Vem como Blob porque a chamada precisa do token. */
  exportCsv(filter: DashboardFilter = {}): Observable<Blob> {
    return this.http.get(this.url('export'), { params: params(filter), responseType: 'blob' });
  }

  private url(path: string): string {
    return `${this.config.getApiBaseUrl()}/dashboard/${path}/`;
  }
}

function params(filter: DashboardFilter): Record<string, string> {
  const result: Record<string, string> = {};
  if (filter.date) result['date'] = filter.date;
  if (filter.schedule) result['schedule'] = String(filter.schedule);
  return result;
}
