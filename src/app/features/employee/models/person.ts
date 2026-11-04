import { Role } from '../../../core/models/auth.model';

export type PersonType = 'DRIVER' | 'EMPLOYEE';

export interface CompanyRef {
  id?: number;
  name?: string;
  company_name?: string;
  url?: string;
}

export interface Person {
  id?: number;
  company: number | string | CompanyRef;
  /** Nome da empresa, já resolvido pela API (evita depender de GET /companies/, que o gestor não acessa). */
  company_name?: string;
  name: string;
  phone: string;
  type: PersonType;
  license_number: string | null;
  employee_code: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  auto_email?: string | null;
  /** Perfil de acesso da conta; null quando a pessoa ainda não tem conta. */
  role?: Role | null;
}

export interface PaginatedPeople {
  count: number;
  next: string | null;
  previous: string | null;
  results: Person[];
}

/** GET people/{id}/overview/ — detalhes do painel lateral. */
export interface PersonOverview {
  account: { email: string; role: Role; must_change_password: boolean; last_login: string | null } | null;
  addresses: HomeAddress[];
  /** Endereços anteriores (trocados no app ou no painel), do mais recente ao mais antigo. */
  address_history: HomeAddress[];
  routes: PersonRoute[];
  /** Outros cadastros da mesma empresa com o mesmo nome e telefone (ex.: motorista e funcionário). */
  linked_records: { id: number; name: string; type: PersonType; is_active: boolean; code: string | null }[];
}

export interface PersonRoute {
  id: number;
  name: string;
  as: 'passenger' | 'driver';
  arrival: string | null;
  weekdays: string[];
  /** Preenchido nas rotas avulsas (de um dia só). */
  service_date: string | null;
  meeting_point?: string | null;
  vehicle?: string;
}

export interface HomeAddress {
  id: number;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  /** panel = cadastrado no painel; gps / typed = informado pelo colaborador no app. */
  source: 'panel' | 'gps' | 'typed';
  source_label: string;
  /** gps | exact | approximate (vazio nos cadastrados pelo painel). */
  precision: string;
  accuracy_m: number | null;
  is_active: boolean;
  /** pending | approved | rejected (vazio nos cadastrados pelo painel). */
  review_status: '' | 'pending' | 'approved' | 'rejected';
  review_note: string;
  reviewed_at: string | null;
  created_at: string;
}
