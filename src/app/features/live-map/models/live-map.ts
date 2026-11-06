/** Resposta de GET /api/dashboard/map/ (rotas do dia com posição, status e paradas). */
export interface LiveMapData {
  date: string;
  generated_at: string;
  /** Sem posição nova há mais que isso = sinal perdido. */
  stale_after_seconds: number;
  destination: LiveMapPoint & { name: string } | null;
  routes: LiveMapRoute[];
}

export interface LiveMapPoint {
  latitude: number;
  longitude: number;
}

export interface LiveMapLocation extends LiveMapPoint {
  route_id: number;
  heading: number | null;
  speed: number | null;
  recorded_at: string;
}

export interface LiveMapRoute {
  id: number;
  name: string;
  time: string | null;
  state: 'not_started' | 'in_progress' | 'finished';
  delayed: boolean;
  vehicle: { plate: string; model: string; capacity: number } | null;
  driver_name: string | null;
  passengers: number;
  location: LiveMapLocation | null;
  stops: (LiveMapPoint & { sequence: number; name: string })[];
}
