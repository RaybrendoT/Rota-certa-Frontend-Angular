/** Resposta de GET /api/dashboard/summary/ (resumo do dia da empresa do gestor). */
export interface DashboardSummary {
  date: string;
  generated_at: string;
  routes: {
    total: number;
    not_started: number;
    in_progress: number;
    finished: number;
    without_vehicle: number;
  };
  passengers: {
    expected: number;
    confirmed: number;
    absent: number;
    pending: number;
  };
  events: { delays: number; incidents: number };
  occupancy: { seats: number; passengers: number; rate: number | null };
  punctuality: {
    finished: number;
    on_time: number;
    late: number;
    rate: number | null;
    tolerance_minutes: number;
  };
  shifts: DashboardShift[];
  /** Turnos que rodam no dia (botões do filtro), com ou sem filtro aplicado. */
  available_shifts: { id: number; time: string }[];
  /** Rotas consideradas (respeita o filtro de turno): o feed ao vivo usa para filtrar. */
  route_ids: number[];
}

export interface DashboardShift {
  schedule_id: number | null;
  time: string | null;
  routes: number;
  in_progress: number;
  finished: number;
  passengers: number;
  confirmed: number;
  absent: number;
  seats: number;
  occupancy_rate: number | null;
}

/** Resposta de GET /api/dashboard/alerts/ (pendências que pedem ação do gestor). */
export type DashboardAlertKind = 'incidents' | 'delays' | 'unassigned' | 'address_reviews';

export interface DashboardAlertItem {
  id?: number;
  route_id?: number;
  route_name?: string;
  person_name?: string;
  /** HH:MM no fuso da operação; em address_reviews, data/hora ISO do envio. */
  time: string | null;
  description?: string;
  /** delays: 'reported' | 'overdue'; unassigned: 'no_vehicle' | 'no_driver'. */
  reason?: string;
}

/** `items` traz todos os itens do grupo; o painel mostra os primeiros e expande o resto. */
export interface DashboardAlertGroup {
  kind: DashboardAlertKind;
  count: number;
  items: DashboardAlertItem[];
}

export interface DashboardAlerts {
  date: string;
  generated_at: string;
  total: number;
  groups: DashboardAlertGroup[];
}

/** Item do feed: mesmo formato das mensagens route_event e boarding_status do WebSocket. */
export interface DashboardFeedItem {
  type: 'route_event' | 'boarding_status';
  id?: number;
  route_passenger_id?: number;
  route_id: number;
  route_name?: string;
  event_type?: 'departure' | 'arrival' | 'stop' | 'delay' | 'incident';
  description?: string;
  person_name?: string;
  status?: 'pending' | 'confirmed' | 'absent';
  timestamp?: string;
}

export interface DashboardFeed {
  date: string;
  items: DashboardFeedItem[];
}

/** Resposta de GET /api/dashboard/trends/?days=7|14|30. */
export interface DashboardTrends {
  days: number;
  from: string;
  to: string;
  daily: DashboardTrendDay[];
  routes: DashboardTrendRoute[];
}

export interface DashboardTrendDay {
  date: string;
  routes: number;
  finished: number;
  expected: number;
  confirmed: number;
  absent: number;
  pending: number;
  on_time: number;
  late: number;
  punctuality_rate: number | null;
  delays: number;
  incidents: number;
}

export interface DashboardTrendRoute {
  route_id: number;
  name: string;
  expected: number;
  absent: number;
  rate: number | null;
}
