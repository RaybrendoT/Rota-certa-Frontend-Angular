export type RouteEventType = 'departure' | 'stop' | 'delay' | 'arrival' | string;

export interface RouteEvent {
  id?: number;
  route: number;
  /** Nome da rota (só leitura, vem da API). */
  route_name?: string;
  event_type: RouteEventType;
  description: string;
  latitude: string;
  longitude: string;
  timestamp?: string;
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
