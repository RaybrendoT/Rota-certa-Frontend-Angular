import { Injectable } from '@angular/core';
import { BaseService } from '../../../core/services/base.service';
import { ImportResult, Person, PaginatedPeople, PersonOverview } from '../models/person';
import { Role } from '../../../core/models/auth.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmployeeService extends BaseService<Person> {
  protected override readonly endpoint = 'people';

  override getAll(params?: any): Observable<PaginatedPeople> {
    return super.getAll(params);
  }

  override create(data: Partial<Person>): Observable<Person> {
    return super.create(data);
  }

  override update(id: number, data: Partial<Person>): Observable<Person> {
    return super.update(id, data);
  }

  /** Conta, endereço, rotas atuais e outros cadastros da mesma pessoa (painel lateral). */
  overview(id: number): Observable<PersonOverview> {
    return this.http.get<PersonOverview>(`${this.fullUrl}/${id}/overview/`);
  }

  /** Define o perfil de acesso (EMPLOYEE ou MANAGER) da conta da pessoa. */
  setAccessRole(id: number, role: Extract<Role, 'EMPLOYEE' | 'MANAGER'>): Observable<Person> {
    return this.http.post<Person>(`${this.fullUrl}/${id}/access-role/`, { role });
  }

  /**
   * Importa funcionários de um CSV. Sem `confirm`, só confere e devolve a prévia;
   * com `confirm`, grava tudo ou nada. `company` só vale para o gerente.
   */
  importCsv(file: File, confirm: boolean, company?: number | null): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('confirm', confirm ? 'true' : 'false');
    if (company) {
      form.append('company', String(company));
    }
    return this.http.post<ImportResult>(`${this.fullUrl}/import/`, form);
  }
}
