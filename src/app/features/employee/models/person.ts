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
