export interface Route {
  id?: number;
  company: number;
  vehicle: number | null;
  name: string;
  is_active: boolean;
  schedule?: number | null;
  /** Preenchida só em rotas avulsas (montadas para um dia); vazia = rota fixa (diária). */
  service_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RouteListResponse {
  value?: Route[];
  results?: Route[];
  Count?: number;
  count?: number;
}

/** Filtro da listagem: fixed = diárias (sem data), extra = avulsas (montadas para um dia). */
export type RouteKindFilter = 'all' | 'fixed' | 'extra';
