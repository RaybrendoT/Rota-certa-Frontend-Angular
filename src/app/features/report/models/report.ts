/** Respostas de /api/reports/* (relatórios do período do gestor). */
export type ReportKind = 'attendance' | 'routes' | 'drivers' | 'events';

export interface ReportFilter {
  from: string;
  to: string;
  schedule?: number | null;
  route?: number | null;
  driver?: number | null;
  type?: 'delay' | 'incident' | null;
}

export interface ReportOptions {
  schedules: { id: number; time: string }[];
  routes: { id: number; name: string; schedule_id: number | null }[];
  drivers: { id: number; name: string }[];
  max_days: number;
}

interface ReportPeriod {
  from: string;
  to: string;
  days: number;
}

export interface AttendanceRow {
  person_id: number;
  name: string;
  code: string;
  routes: string[];
  expected: number;
  confirmed: number;
  absent: number;
  no_record: number;
  presence_rate: number | null;
  absence_rate: number | null;
}

export interface AttendanceReport extends ReportPeriod {
  totals: {
    people: number;
    expected: number;
    confirmed: number;
    absent: number;
    presence_rate: number | null;
    absence_rate: number | null;
    never_boarded: number;
  };
  rows: AttendanceRow[];
}

export interface AttendanceDetail extends ReportPeriod {
  person: { id: number; name: string; code: string };
  timeline: { date: string; route_id: number; route_name: string; time: string | null; status: 'confirmed' | 'absent' | 'no_record' }[];
}

export interface RouteRow {
  route_id: number;
  name: string;
  time: string | null;
  vehicle: string | null;
  driver: string | null;
  capacity: number | null;
  passengers: number;
  planned: number;
  done: number;
  completion_rate: number | null;
  on_time: number;
  late: number;
  punctuality_rate: number | null;
  avg_late_minutes: number | null;
  avg_occupancy: number | null;
  confirmed: number;
  absent: number;
  delays: number;
  incidents: number;
}

export interface RoutesReport extends ReportPeriod {
  totals: {
    routes: number;
    planned: number;
    done: number;
    completion_rate: number | null;
    punctuality_rate: number | null;
    avg_occupancy: number | null;
    delays: number;
    incidents: number;
  };
  rows: RouteRow[];
}

export interface DriverRow {
  driver: string;
  vehicle: string;
  routes: number;
  planned: number;
  done: number;
  completion_rate: number | null;
  on_time: number;
  late: number;
  punctuality_rate: number | null;
  avg_late_minutes: number | null;
  delays: number;
  incidents: number;
}

export interface DriversReport extends ReportPeriod {
  totals: { drivers: number };
  rows: DriverRow[];
}

export interface EventRow {
  id: number;
  date: string;
  time: string;
  type: 'delay' | 'incident';
  route_id: number;
  route_name: string;
  shift: string | null;
  driver: string | null;
  vehicle: string | null;
  description: string;
}

export interface EventsReport extends ReportPeriod {
  totals: { events: number; delays: number; incidents: number; truncated: boolean };
  rows: EventRow[];
}

export interface ReportByKind {
  attendance: AttendanceReport;
  routes: RoutesReport;
  drivers: DriversReport;
  events: EventsReport;
}
