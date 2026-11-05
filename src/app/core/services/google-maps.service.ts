import { inject, Injectable } from '@angular/core';
import { Loader } from '@googlemaps/js-api-loader';
import { ConfigService } from './config.service';

export interface GoogleMapsLibraries {
  maps: google.maps.MapsLibrary;
  marker: google.maps.MarkerLibrary;
}

/**
 * Carrega a Maps JavaScript API uma vez só, com a chave de navegador da configuração
 * (assets/config/config.json ou config.local.json). Sem chave, `load()` rejeita.
 */
@Injectable({ providedIn: 'root' })
export class GoogleMapsService {
  private readonly config = inject(ConfigService);
  private libraries?: Promise<GoogleMapsLibraries>;

  get hasKey(): boolean {
    return !!this.config.getGoogleMapsApiKey();
  }

  get mapId(): string {
    return this.config.getGoogleMapsMapId();
  }

  load(): Promise<GoogleMapsLibraries> {
    if (!this.hasKey) return Promise.reject(new Error('missing-key'));
    if (!this.libraries) {
      const loader = new Loader({ apiKey: this.config.getGoogleMapsApiKey(), version: 'weekly', language: 'pt-BR', region: 'BR' });
      this.libraries = Promise.all([loader.importLibrary('maps'), loader.importLibrary('marker')])
        .then(([maps, marker]) => ({ maps, marker }))
        .catch((err) => {
          this.libraries = undefined; // permite tentar de novo
          throw err;
        });
    }
    return this.libraries;
  }
}
