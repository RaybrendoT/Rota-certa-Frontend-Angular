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
