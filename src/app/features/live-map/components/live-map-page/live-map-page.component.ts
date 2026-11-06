import { AfterViewInit, Component, computed, DestroyRef, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GoogleMapsLibraries, GoogleMapsService } from '../../../../core/services/google-maps.service';
import { RealtimeService, StreamMessage } from '../../../../core/services/realtime.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { LiveMapData, LiveMapLocation, LiveMapRoute } from '../../models/live-map';
import { LiveMapService } from '../../service/live-map.service';

type Filter = 'all' | 'in_progress' | 'delayed' | 'no_signal';
type Tone = 'run' | 'late' | 'stale' | 'done' | 'idle';
type MapState = 'loading' | 'ready' | 'missing-key' | 'failed';

/** Centro de Manaus, quando ainda não há nada para enquadrar. */
const FALLBACK_CENTER: google.maps.LatLngLiteral = { lat: -3.1019, lng: -60.025 };
const TICK_MS = 15_000;
const TRAIL_COLOR = '#3b82f6';

@Component({
  selector: 'app-live-map-page',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './live-map-page.component.html',
  styleUrl: './live-map-page.component.scss',
})
export class LiveMapPageComponent implements AfterViewInit {
  private readonly service = inject(LiveMapService);
  private readonly googleMaps = inject(GoogleMapsService);
  private readonly theme = inject(ThemeService);
  readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');

  readonly data = signal<LiveMapData | null>(null);
  readonly routes = signal<LiveMapRoute[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly mapState = signal<MapState>('loading');
  readonly filter = signal<Filter>('all');
  readonly selectedId = signal<number | null>(null);
  /** Relógio para recalcular "há X min" e o sinal perdido sem depender de mensagens. */
  readonly now = signal(Date.now());

  readonly counts = computed(() => {
    const routes = this.routes();
    this.now();
    return {
      all: routes.length,
      in_progress: routes.filter((r) => r.state === 'in_progress').length,
      delayed: routes.filter((r) => r.delayed && r.state !== 'finished').length,
      no_signal: routes.filter((r) => r.state === 'in_progress' && !this.hasSignal(r)).length,
      on_map: routes.filter((r) => r.location && r.state !== 'finished').length,
    };
  });

  readonly visible = computed(() => {
    const filter = this.filter();
    this.now();
    const order = { in_progress: 0, not_started: 1, finished: 2 };
    return this.routes()
      .filter((r) =>
        filter === 'all' ? true
          : filter === 'in_progress' ? r.state === 'in_progress'
          : filter === 'delayed' ? r.delayed && r.state !== 'finished'
          : r.state === 'in_progress' && !this.hasSignal(r))
      .sort((a, b) => order[a.state] - order[b.state] || (a.time ?? '').localeCompare(b.time ?? '') || a.name.localeCompare(b.name));
  });

  private lib?: GoogleMapsLibraries;
  private map?: google.maps.Map;
  private info?: google.maps.InfoWindow;
  private infoRouteId: number | null = null;
  private readonly markers = new Map<number, google.maps.marker.AdvancedMarkerElement>();
  private destinationMarker?: google.maps.marker.AdvancedMarkerElement;
  private trail: (google.maps.Polyline | google.maps.marker.AdvancedMarkerElement)[] = [];

  constructor() {
    // Tema claro/escuro do painel também no mapa.
    effect(() => {
      const scheme = this.theme.theme();
      untracked(() => this.map && this.lib && this.createMap(scheme));
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.load();
    this.realtime.connect();
    this.realtime.messages.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((m) => this.onMessage(m));

    const tick = setInterval(() => {
      this.now.set(Date.now());
      this.refreshMarkers();
    }, TICK_MS);

    this.destroyRef.onDestroy(() => {
      clearInterval(tick);
      this.realtime.release();
    });
  }

  load(): void {
    this.loading.set(true);
    this.service.load().subscribe({
      next: (data) => {
        this.data.set(data);
        this.routes.set(data.routes);
        this.error.set(null);
        this.loading.set(false);
        this.drawDestination();
        this.refreshMarkers();
        this.fitAll();
      },
      error: (err) => {
        this.error.set(extractErrorMessage(err, 'Não foi possível carregar o mapa.'));
        this.loading.set(false);
      },
    });
  }

  select(route: LiveMapRoute): void {
    this.selectedId.set(route.id);
    this.drawTrail(route);
    this.refreshMarkers();
    if (!this.map) return;
    const marker = this.markers.get(route.id);
    if (marker?.position) {
      this.map.panTo(marker.position);
      if ((this.map.getZoom() ?? 0) < 15) this.map.setZoom(15);
      this.openInfo(route, marker);
    } else if (route.stops.length) {
      const bounds = new google.maps.LatLngBounds();
      route.stops.forEach((s) => bounds.extend({ lat: s.latitude, lng: s.longitude }));
      this.map.fitBounds(bounds, 48);
    }
  }

  fitAll(): void {
    if (!this.map) return;
    const points: google.maps.LatLngLiteral[] = this.routes()
      .filter((r) => r.location && r.state !== 'finished')
      .map((r) => ({ lat: r.location!.latitude, lng: r.location!.longitude }));
    const destination = this.data()?.destination;
    if (destination) points.push({ lat: destination.latitude, lng: destination.longitude });
    if (points.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      this.map.fitBounds(bounds, 56);
      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        if ((this.map!.getZoom() ?? 0) > 15) this.map!.setZoom(15);
      });
    } else if (points.length === 1) {
      this.map.setCenter(points[0]);
      this.map.setZoom(14);
    }
  }

  retryMap(): void {
    this.initMap();
  }

  // ---------- estado de cada rota ----------
  hasSignal(route: LiveMapRoute): boolean {
    if (!route.location) return false;
    const limit = (this.data()?.stale_after_seconds ?? 120) * 1000;
    return this.now() - new Date(route.location.recorded_at).getTime() <= limit;
  }

  tone(route: LiveMapRoute): Tone {
    if (route.state === 'finished') return 'done';
    if (route.state === 'in_progress' && !this.hasSignal(route)) return 'stale';
    if (route.delayed) return 'late';
    return route.state === 'in_progress' ? 'run' : 'idle';
  }

  statusLabel(route: LiveMapRoute): string {
    if (route.state === 'finished') return 'Finalizada';
    if (route.state === 'in_progress') {
      if (!route.location) return 'Em andamento · sem GPS';
      if (!this.hasSignal(route)) return `Sinal perdido · ${this.ago(route.location.recorded_at)}`;
      return route.delayed ? `Atrasada · ${this.ago(route.location.recorded_at)}` : `Em andamento · ${this.ago(route.location.recorded_at)}`;
    }
    return route.delayed ? 'Não saiu · atrasada' : 'Não iniciada';
  }

  ago(iso: string): string {
    const seconds = Math.max(0, Math.round((this.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return 'agora';
    const minutes = Math.round(seconds / 60);
    return minutes < 60 ? `há ${minutes} min` : `há ${Math.floor(minutes / 60)} h`;
  }

  // ---------- ao vivo ----------
  private onMessage(message: StreamMessage): void {
    const routeId = Number(message['route_id']);
    if (!routeId) return;
    if (message.type === 'vehicle_location') {
      this.patch(routeId, { location: message as unknown as LiveMapLocation });
    } else if (message.type === 'route_event') {
      const type = message['event_type'];
      if (type === 'departure') this.patch(routeId, { state: 'in_progress' });
      else if (type === 'arrival') this.patch(routeId, { state: 'finished' });
      else if (type === 'delay') this.patch(routeId, { delayed: true });
    }
  }

  private patch(routeId: number, changes: Partial<LiveMapRoute>): void {
    if (!this.routes().some((r) => r.id === routeId)) return;
    this.routes.update((list) => list.map((r) => (r.id === routeId ? { ...r, ...changes } : r)));
    this.refreshMarkers();
  }

  // ---------- mapa ----------
  private async initMap(): Promise<void> {
    if (!this.googleMaps.hasKey) {
      this.mapState.set('missing-key');
      return;
    }
    this.mapState.set('loading');
    try {
      this.lib = await this.googleMaps.load();
    } catch {
      this.mapState.set('failed');
      return;
    }
    this.createMap(this.theme.theme());
    this.mapState.set('ready');
  }

  /** (Re)cria o mapa: o esquema de cores só pode ser definido na criação. */
  private createMap(scheme: 'light' | 'dark'): void {
    if (!this.lib) return;
    const previous = this.map;
    this.map = new this.lib.maps.Map(this.mapEl().nativeElement, {
      center: previous?.getCenter() ?? FALLBACK_CENTER,
      zoom: previous?.getZoom() ?? 12,
      mapId: this.googleMaps.mapId,
      colorScheme: scheme === 'dark' ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
      disableDefaultUI: true,
      zoomControl: true,
      fullscreenControl: true,
      clickableIcons: false,
      gestureHandling: 'greedy',
    });
    this.info = new this.lib.maps.InfoWindow({ headerDisabled: true });
    this.info.addListener('closeclick', () => (this.infoRouteId = null));
    this.markers.forEach((marker) => (marker.map = null));
    this.markers.clear();
    this.destinationMarker = undefined;
    this.drawDestination();
    this.refreshMarkers();
    const selected = this.routes().find((r) => r.id === this.selectedId());
    if (selected) this.drawTrail(selected);
    if (!previous) this.fitAll();
  }

  private refreshMarkers(): void {
    if (!this.map || !this.lib) return;
    const seen = new Set<number>();
    for (const route of this.routes()) {
      if (!route.location || route.state === 'finished') continue;
      seen.add(route.id);
      const position = { lat: route.location.latitude, lng: route.location.longitude };
      let marker = this.markers.get(route.id);
      if (!marker) {
        marker = new this.lib.marker.AdvancedMarkerElement({ map: this.map, position, title: route.name, gmpClickable: true });
        marker.addEventListener('gmp-click', () => {
          const current = this.routes().find((r) => r.id === route.id);
          if (current) this.select(current);
        });
        this.markers.set(route.id, marker);
      } else {
        marker.position = position;
      }
      marker.content = this.busContent(route);
      marker.zIndex = this.selectedId() === route.id ? 1000 : null;
      if (this.infoRouteId === route.id) this.info?.setContent(this.popupContent(route));
    }
    for (const [id, marker] of this.markers) {
      if (!seen.has(id)) {
        marker.map = null;
        this.markers.delete(id);
      }
    }
  }

  private openInfo(route: LiveMapRoute, marker: google.maps.marker.AdvancedMarkerElement): void {
    if (!this.info || !this.map) return;
    this.info.setContent(this.popupContent(route));
    this.info.open({ map: this.map, anchor: marker });
    this.infoRouteId = route.id;
  }

  private busContent(route: LiveMapRoute): HTMLElement {
    const el = document.createElement('div');
    el.className = `bus-marker ${this.tone(route)}${this.selectedId() === route.id ? ' selected' : ''}`;
    const heading = route.location?.heading;
    if (heading != null) {
      const arrow = document.createElement('span');
      arrow.className = 'bus-arrow';
      arrow.style.transform = `rotate(${heading}deg)`;
      el.appendChild(arrow);
    }
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'directions_bus';
    el.appendChild(icon);
    return el;
  }

  private popupContent(route: LiveMapRoute): HTMLElement {
    const el = document.createElement('div');
    el.className = 'map-popup';
    const vehicle = route.vehicle ? `${route.vehicle.plate} · ${route.passengers}/${route.vehicle.capacity} passageiros` : 'sem veículo';
    const speed = route.location?.speed != null ? ` · ${Math.round(route.location.speed * 3.6)} km/h` : '';
    const lines: [string, string][] = [
      ['strong', route.name],
      ['span', route.driver_name ?? 'sem motorista'],
      ['span', vehicle],
      ['em', `${this.statusLabel(route)}${speed}`],
    ];
    for (const [tag, text] of lines) {
      const line = document.createElement(tag);
      line.textContent = text; // textContent: nomes vindos da API nunca viram HTML
      el.appendChild(line);
    }
    return el;
  }

  private drawDestination(): void {
    const destination = this.data()?.destination;
    if (!this.map || !this.lib || !destination || this.destinationMarker) return;
    const el = document.createElement('div');
    el.className = 'dest-marker';
    el.innerHTML = '<span class="material-icons">factory</span>';
    this.destinationMarker = new this.lib.marker.AdvancedMarkerElement({
      map: this.map,
      position: { lat: destination.latitude, lng: destination.longitude },
      title: destination.name,
      content: el,
      zIndex: -1,
    });
  }

  private drawTrail(route: LiveMapRoute): void {
    this.trail.forEach((item) => ('setMap' in item ? item.setMap(null) : (item.map = null)));
    this.trail = [];
    if (!this.map || !this.lib || !route.stops.length) return;
    const path: google.maps.LatLngLiteral[] = route.stops.map((s) => ({ lat: s.latitude, lng: s.longitude }));
    const destination = this.data()?.destination;
    if (destination) path.push({ lat: destination.latitude, lng: destination.longitude });
    this.trail.push(new this.lib.maps.Polyline({
      map: this.map,
      path,
      strokeOpacity: 0,
      icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, strokeColor: TRAIL_COLOR, scale: 3 }, offset: '0', repeat: '14px' }],
    }));
    for (const stop of route.stops) {
      const dot = document.createElement('div');
      dot.className = 'stop-marker';
      dot.textContent = String(stop.sequence + 1);
      this.trail.push(new this.lib.marker.AdvancedMarkerElement({
        map: this.map,
        position: { lat: stop.latitude, lng: stop.longitude },
        title: `${stop.sequence + 1}. ${stop.name}`,
        content: dot,
      }));
    }
  }
}
