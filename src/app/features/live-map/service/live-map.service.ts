import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { LiveMapData } from '../models/live-map';

@Injectable({ providedIn: 'root' })
export class LiveMapService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** Rotas de hoje com a última posição do ônibus; o resto chega pelo WebSocket. */
  load(): Observable<LiveMapData> {
    return this.http.get<LiveMapData>(`${this.config.getApiBaseUrl()}/dashboard/map/`);
  }
}
