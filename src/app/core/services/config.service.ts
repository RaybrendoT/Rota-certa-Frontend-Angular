import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';

interface IConfig {
  apiBaseUrl: string;
  /** Chave de navegador da Maps JavaScript API (restrita por domínio). Vazia = mapa desligado. */
  googleMapsApiKey?: string;
  /** Map ID do Google Cloud (marcadores avançados e tema claro/escuro). Padrão: DEMO_MAP_ID. */
  googleMapsMapId?: string;
}
@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly httpClient = inject(HttpClient);
  config?: IConfig;

  /**
   * Lê assets/config/config.json (versionado; em produção gerado pelo deploy) e, se existir,
   * assets/config/config.local.json por cima — fora do git, para chaves no ambiente local.
   */
  async loadConfig(): Promise<void> {
    try {
      const config = await firstValueFrom(this.httpClient.get<IConfig>('assets/config/config.json'));
      this.config = config;
    } catch (err) {
      console.error('Cant load config:', err);
    }
    try {
      const local = await firstValueFrom(this.httpClient.get<Partial<IConfig>>('assets/config/config.local.json'));
      this.config = { ...(this.config ?? { apiBaseUrl: '' }), ...local };
    } catch {
      // Sem config.local.json: normal fora do ambiente de desenvolvimento.
    }
  }

  getApiBaseUrl(): string {
    return this.config?.apiBaseUrl || '';
  }

  getGoogleMapsApiKey(): string {
    return this.config?.googleMapsApiKey || '';
  }

  getGoogleMapsMapId(): string {
    return this.config?.googleMapsMapId || 'DEMO_MAP_ID';
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
