import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { AddressReviewRequest } from '../models/address-review';

/** Aprovação dos endereços enviados pelos colaboradores no app (gestor). */
@Injectable({ providedIn: 'root' })
export class AddressReviewService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** Quantidade de pedidos pendentes, para o contador do menu. */
  readonly pendingCount = signal(0);

  private get baseUrl(): string {
    return `${this.config.getApiBaseUrl()}/address-reviews`;
  }

  pending(): Observable<AddressReviewRequest[]> {
    return this.http.get<AddressReviewRequest[]>(`${this.baseUrl}/`).pipe(tap((items) => this.pendingCount.set(items.length)));
  }

  reviewed(): Observable<AddressReviewRequest[]> {
    return this.http.get<AddressReviewRequest[]>(`${this.baseUrl}/`, { params: { status: 'reviewed' } });
  }

  approve(id: number, body: { route_id: number | null; update_current_stops: boolean; note?: string }): Observable<AddressReviewRequest> {
    return this.http.post<AddressReviewRequest>(`${this.baseUrl}/${id}/approve/`, body);
  }

  reject(id: number, reason: string): Observable<AddressReviewRequest> {
    return this.http.post<AddressReviewRequest>(`${this.baseUrl}/${id}/reject/`, { reason });
  }
}
