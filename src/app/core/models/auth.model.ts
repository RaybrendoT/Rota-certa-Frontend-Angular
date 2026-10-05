/** Perfil de acesso da conta (AccessAccount.role no backend). */
export type Role = 'DRIVER' | 'EMPLOYEE' | 'MANAGER' | 'GERENTE';

export const ROLE_LABELS: Record<Role, string> = {
  DRIVER: 'Motorista',
  EMPLOYEE: 'Funcionário',
  MANAGER: 'Gestor',
  GERENTE: 'Gerente'
};

/** Pessoa logada, no formato devolvido por `auth/login/` e `auth/me/`. */
export interface SessionPerson {
  id: number;
  name: string;
  type: 'DRIVER' | 'EMPLOYEE';
  role: Role;
  email: string;
  company_id: number;
  company_name: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  must_change_password: boolean;
  person: SessionPerson;
}

export interface MeResponse {
  must_change_password: boolean;
  person: SessionPerson;
}
