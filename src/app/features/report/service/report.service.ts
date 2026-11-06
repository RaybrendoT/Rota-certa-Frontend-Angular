import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { AttendanceDetail, ReportByKind, ReportFilter, ReportKind, ReportOptions } from '../models/report';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  options(): Observable<ReportOptions> {
    return this.http.get<ReportOptions>(this.url('options'));
  }

  load<K extends ReportKind>(kind: K, filter: ReportFilter): Observable<ReportByKind[K]> {
    return this.http.get<ReportByKind[K]>(this.url(kind), { params: params(filter) });
  }

  attendanceDetail(personId: number, filter: ReportFilter): Observable<AttendanceDetail> {
    return this.http.get<AttendanceDetail>(this.url(`attendance/${personId}`), { params: params(filter) });
  }

  /** CSV da aba (Excel pt-BR). Blob porque a chamada leva o token. */
  exportCsv(kind: ReportKind, filter: ReportFilter): Observable<Blob> {
    return this.http.get(this.url(kind), { params: { ...params(filter), export: 'csv' }, responseType: 'blob' });
  }

  private url(path: string): string {
    return `${this.config.getApiBaseUrl()}/reports/${path}/`;
  }
}

function params(filter: ReportFilter): Record<string, string> {
  const result: Record<string, string> = { from: filter.from, to: filter.to };
  for (const key of ['schedule', 'route', 'driver', 'type'] as const) {
    const value = filter[key];
    if (value) result[key] = String(value);
  }
  return result;
}
