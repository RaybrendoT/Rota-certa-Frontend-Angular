/** Contratos de `planning/`, `pickup-suggestions/` (backend: core/planning e core/pickup_points). */

export interface PlanningMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface PlanPassenger {
  id: number;
  name: string;
  code: string | null;
}

export interface PlanStop {
  order: number;
  meeting_point_id: number;
  point: string;
  /** "HH:MM" estimado. */
  eta: string;
  passengers: PlanPassenger[];
}

export interface PlanRoute {
  number: number;
  driver: { id: number; name: string };
  vehicle: { plate: string; model: string; capacity: number };
  load: number;
  departure: string;
  duration_min: number;
  distance_km: number;
  stops: PlanStop[];
}

export interface PlanningPlan {
  date: string;
  weekday: string;
  arrival: string;
  total_passengers: number;
  routes: PlanRoute[];
  warnings: string[];
  status: 'draft' | 'approved';
  times_are_estimates: boolean;
  /** Presente quando o rascunho não pôde ser exibido (ex.: dados apagados). */
  error?: string;
}

export interface PlanningConversation {
  id: number;
  status: 'draft' | 'approved';
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  messages: PlanningMessage[];
  plan: PlanningPlan | null;
  routes: { id: number; name: string }[];
  usage: { input_tokens: number; output_tokens: number };
  /** Só na resposta de `messages/`. */
  reply?: string;
}

export interface PlanningSummary {
  id: number;
  status: 'draft' | 'approved';
  updated_at: string;
  has_plan: boolean;
}

export interface PickupSuggestion {
  h3_cell: string;
  latitude: number;
  longitude: number;
  people: number;
  person_ids: number[];
  names: string[];
  avg_distance_now_m: number;
  avg_distance_after_m: number;
  address: { street: string; number: string; sublocality: string; formatted: string } | null;
}

export interface PickupSuggestions {
  walk_limit_m: number;
  min_people: number;
  resolution: number;
  employees: number;
  covered: number;
  uncovered: number;
  still_uncovered: number;
  suggestions: PickupSuggestion[];
}

/** Colaborador do cadastro achado numa linha da lista anexada. */
export interface ListPerson {
  id: number;
  name: string;
  code: string | null;
  email: string | null;
}

export interface ListLine {
  row: number;
  code: string;
  name: string;
}

export interface EmployeeListResult {
  file_name: string;
  rows: number;
  matched: (ListLine & { person: ListPerson; matched_by: 'code' | 'name'; name_differs: boolean })[];
  ambiguous: (ListLine & { candidates: ListPerson[] })[];
  not_found: ListLine[];
  duplicates: number;
}
