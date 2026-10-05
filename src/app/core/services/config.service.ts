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

  /** Django admin no mesmo servidor da API: ".../api" -> ".../admin/". */
  getAdminUrl(): string {
    return `${this.getApiBaseUrl().replace(/\/api\/?$/, '')}/admin/`;
  }
}
