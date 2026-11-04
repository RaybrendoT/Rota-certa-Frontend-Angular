import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { EmployeeListResult, PickupSuggestions, PlanningConversation, PlanningSummary } from '../models/planning';

/** Assistente de planejamento de rotas avulsas e sugestões de pontos (gestor). */
@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get baseUrl(): string {
    return this.config.getApiBaseUrl();
  }

  list(): Observable<PlanningSummary[]> {
    return this.http.get<PlanningSummary[]>(`${this.baseUrl}/planning/`);
  }

  create(): Observable<PlanningConversation> {
    return this.http.post<PlanningConversation>(`${this.baseUrl}/planning/`, {});
  }

  get(id: number): Observable<PlanningConversation> {
    return this.http.get<PlanningConversation>(`${this.baseUrl}/planning/${id}/`);
  }

  /** Pode levar dezenas de segundos: o assistente chama várias ferramentas antes de responder. */
  sendMessage(id: number, text: string): Observable<PlanningConversation> {
    return this.http.post<PlanningConversation>(`${this.baseUrl}/planning/${id}/messages/`, { text });
  }

  /** Lê a lista (.csv ou .xlsx com matrícula e nome) e confere com o cadastro; não altera a conversa. */
  uploadEmployeeList(file: File): Observable<EmployeeListResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<EmployeeListResult>(`${this.baseUrl}/planning/employee-list/`, form);
  }

  approve(id: number): Observable<PlanningConversation> {
    return this.http.post<PlanningConversation>(`${this.baseUrl}/planning/${id}/approve/`, {});
  }

  pickupSuggestions(walkLimit: number, minPeople: number): Observable<PickupSuggestions> {
    const params = new HttpParams().set('walk_limit', walkLimit).set('min_people', minPeople);
    return this.http.get<PickupSuggestions>(`${this.baseUrl}/pickup-suggestions/`, { params });
  }
}
