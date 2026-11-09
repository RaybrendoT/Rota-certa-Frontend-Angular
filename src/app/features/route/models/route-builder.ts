/** Tipos da API do stepper de criação/edição manual de rotas (`/api/route-builder/`). */

export type RouteKind = 'fixed' | 'extra';

export interface StopInput {
  meeting_point: number;
  passengers: number[];
}

export interface RouteInput {
  name: string;
  kind: RouteKind;
  schedule: number | null;
  service_date: string | null;
  vehicle: number | null;
  passengers: number[];
  /** null: o servidor monta as paradas pelo ponto mais perto de casa e ordena pelo menor trajeto. */
  stops: StopInput[] | null;
  optimize?: boolean;
  /** Rota em edição (o conflito do motorista e "já vai em outra rota" ignoram ela mesma). */
  route?: number | null;
}

export interface BuilderSchedule {
  id: number;
  time: string;
  weekdays: string[];
  label: string;
}

export interface BuilderEmployee {
  id: number;
  name: string;
  code: string;
  bairro: string;
  has_home: boolean;
  nearest_point: { id: number; name: string; distance_m: number } | null;
  fixed_routes: string[];
}

export interface BuilderPoint {
  id: number;
  name: string;
  short_name: string;
  lat: number;
  lng: number;
  home: boolean;
}

export interface BuilderOptions {
  schedules: BuilderSchedule[];
  employees: BuilderEmployee[];
  meeting_points: BuilderPoint[];
  company_location: { lat: number; lng: number } | null;
}

export interface BuilderVehicle {
  id: number;
  plate: string;
  model: string;
  capacity: number;
  driver: { id: number; name: string } | null;
  /** Outra rota do motorista perto deste horário ("07:30 Nome da rota"). */
  conflict: string | null;
}

export interface PreviewPassenger {
  id: number;
  name: string;
  code: string;
  distance_m: number | null;
}

export interface PreviewStop {
  meeting_point: BuilderPoint;
  eta: string;
  passengers: PreviewPassenger[];
}

export interface PreviewWarning {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  person_ids?: number[];
}

export interface RoutePreview {
  name: string;
  kind: RouteKind;
  schedule: { id: number; time: string; label: string };
  service_date: string | null;
  vehicle: { id: number; plate: string; model: string; capacity: number } | null;
  driver: { id: number; name: string } | null;
  load: number;
  arrival: string;
  departure: string | null;
  duration_min: number;
  distance_km: number;
  stops: PreviewStop[];
  warnings: PreviewWarning[];
  can_save: boolean;
}

export interface LoadedRoute {
  id: number;
  data: RouteInput;
  preview: RoutePreview | null;
}

export interface SavedRoute {
  id: number;
  preview: RoutePreview;
}
