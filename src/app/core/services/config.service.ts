import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';

interface IConfig {
  apiBaseUrl: string;
}
@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly httpClient = inject(HttpClient);
  config?: IConfig;

  async loadConfig(): Promise<void> {
    try {
      const config = await firstValueFrom(this.httpClient.get<IConfig>('assets/config/config.json'));
      this.config = config;
    } catch (err) {
      console.error('Cant load config:', err);
    }
  }

  getApiBaseUrl(): string {
    return this.config?.apiBaseUrl || '';
  }

  /**
   * WebSocket do mesmo servidor da API: "http://host:8000/api" -> "ws://host:8000/ws/stream/";
   * com apiBaseUrl relativa ("/api", atrás do Caddy) usa a origem da página (wss em https).
   */
  getStreamUrl(): string {
    const base = new URL(this.getApiBaseUrl().replace(/\/api\/?$/, '') || '/', location.href);
    base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    base.pathname = `${base.pathname.replace(/\/$/, '')}/ws/stream/`;
    return base.toString();
  }

  /** Django admin no mesmo servidor da API: ".../api" -> ".../admin/". */
  getAdminUrl(): string {
    return `${this.getApiBaseUrl().replace(/\/api\/?$/, '')}/admin/`;
  }
}
