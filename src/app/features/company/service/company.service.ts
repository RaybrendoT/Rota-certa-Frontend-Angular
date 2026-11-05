import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { BaseService } from '../../../core/services/base.service';
import { Company, CompanyListResponse } from '../models/company';

@Injectable({
  providedIn: 'root'
})
export class CompanyService extends BaseService<Company> {
  protected override readonly endpoint = 'companies';
  private readonly auth = inject(AuthService);

  override getAll(params?: any): Observable<CompanyListResponse | Company[]> {
    return super.getAll(params);
  }

  /**
   * Empresas para preencher um campo "Empresa" nos cadastros. O gestor só trabalha na
   * própria empresa e não pode listar empresas (a API responde 403): devolve a da sessão.
   */
  options(): Observable<CompanyListResponse | Company[]> {
    const person = this.auth.person();
    if (this.auth.isManager() && person) {
      return of([{ id: person.company_id, name: person.company_name }]);
    }
    return this.getAll();
  }
}
