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
