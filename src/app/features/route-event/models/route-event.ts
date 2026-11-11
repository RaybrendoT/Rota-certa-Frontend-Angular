/** Eventos de rota. Ocorrências são os atrasos e incidentes (ver core/occurrences.py no backend). */
export type RouteEventType = 'departure' | 'arrival' | 'stop' | 'delay' | 'incident';
export type OccurrenceType = 'delay' | 'incident';
export type OccurrenceSource = 'driver' | 'system' | 'manager';
export type OccurrenceStatus = 'open' | 'in_progress' | 'resolved';
export type OccurrenceCategory =
  | 'traffic' | 'mechanical' | 'accident' | 'weather' | 'passenger' | 'road' | 'schedule' | 'other' | '';

export interface RouteEvent {
  id?: number;
  route: number;
  /** Nome da rota (só leitura, vem da API). */
  route_name?: string;
  driver_name?: string | null;
  event_type: RouteEventType;
  description: string;
  /** Opcionais: o app do motorista manda; o gestor e o sistema registram sem posição. */
  latitude?: string | null;
  longitude?: string | null;
  timestamp?: string;
  service_date?: string;
  source?: OccurrenceSource;
  source_label?: string;
  status?: OccurrenceStatus;
  status_label?: string;
  category?: OccurrenceCategory;
  category_label?: string;
  delay_minutes?: number | null;
  /** Regra do sistema que gerou a ocorrência: not_started, overdue ou late_arrival. */
  auto_code?: string;
  reported_by_name?: string | null;
  resolved_by_name?: string | null;
  resolved_at?: string | null;
  resolution?: string;
  /** Só na criação pelo painel. */
  notify_passengers?: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RouteEventListResponse {
  value?: RouteEvent[];
  results?: RouteEvent[];
  Count?: number;
  count?: number;
}

export const OCCURRENCE_TYPES: { value: OccurrenceType; label: string }[] = [
  { value: 'delay', label: 'Atraso' },
  { value: 'incident', label: 'Incidente' },
];

export const OCCURRENCE_CATEGORIES: { value: Exclude<OccurrenceCategory, '' | 'schedule'>; label: string }[] = [
  { value: 'traffic', label: 'Trânsito' },
  { value: 'mechanical', label: 'Problema mecânico' },
  { value: 'accident', label: 'Acidente' },
  { value: 'weather', label: 'Chuva / alagamento' },
  { value: 'passenger', label: 'Passageiro' },
  { value: 'road', label: 'Via bloqueada / desvio' },
  { value: 'other', label: 'Outro' },
];

export const OCCURRENCE_STATUS_LABELS: Record<OccurrenceStatus, string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  resolved: 'Resolvida',
};

export const OCCURRENCE_SOURCE_LABELS: Record<OccurrenceSource, string> = {
  driver: 'Motorista',
  system: 'Sistema',
  manager: 'Gestor',
};
