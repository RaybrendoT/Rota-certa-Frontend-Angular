import { Injectable } from '@angular/core';
import { BaseService } from '../../../core/services/base.service';
import { Person, PaginatedPeople } from '../models/person';
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

  /** Define o perfil de acesso (EMPLOYEE ou MANAGER) da conta da pessoa. */
  setAccessRole(id: number, role: Extract<Role, 'EMPLOYEE' | 'MANAGER'>): Observable<Person> {
    return this.http.post<Person>(`${this.fullUrl}/${id}/access-role/`, { role });
  }
}
