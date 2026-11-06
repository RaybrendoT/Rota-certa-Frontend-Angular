import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { LoginResponse, MeResponse, SessionPerson } from '../models/auth.model';
import { ConfigService } from './config.service';

const STORAGE_KEY = 'rotacerta.session';

interface Session {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
  person: SessionPerson;
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    return session?.accessToken && session?.refreshToken && session?.person ? session : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null): void {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Armazenamento indisponível (modo privado, cota): a sessão vale só até recarregar.
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly router = inject(Router);

  private readonly state = signal<Session | null>(readSession());
  private refreshInFlight$: Observable<string> | null = null;
  /** O perfil vindo do storage pode estar velho; é revalidado uma vez por carga da página. */
  private profileVerified = false;

  readonly person = computed(() => this.state()?.person ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly isManager = computed(() => this.person()?.role === 'MANAGER');
  readonly isGerente = computed(() => this.person()?.role === 'GERENTE');
  /** Quem entra no painel (layout com o menu lateral): gestor ou gerente. */
  readonly canAccessPanel = computed(() => this.isManager() || this.isGerente());
  readonly mustChangePassword = computed(() => this.state()?.mustChangePassword ?? false);

  get accessToken(): string | null {
    return this.state()?.accessToken ?? null;
  }

  get refreshToken(): string | null {
    return this.state()?.refreshToken ?? null;
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(this.url('login'), { email, password })
      .pipe(tap(response => this.startSession(response)));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(this.url('change-password'), {
        current_password: currentPassword,
        new_password: newPassword
      })
      .pipe(tap(response => this.startSession(response)));
  }

  /** Renova o access token. Chamadas simultâneas compartilham a mesma requisição. */
  refreshAccessToken(): Observable<string> {
    const refresh = this.refreshToken;
    if (!refresh) {
      return throwError(() => new Error('Sem refresh token.'));
    }
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http
        .post<{ access_token: string }>(this.url('refresh'), { refresh })
        .pipe(
          map(response => response.access_token),
          tap(accessToken => this.updateSession({ accessToken })),
          finalize(() => (this.refreshInFlight$ = null)),
          shareReplay(1)
        );
    }
    return this.refreshInFlight$;
  }

  /** Relê perfil e obrigatoriedade de troca de senha no servidor (uma vez por carga). */
  ensureProfile(): Observable<SessionPerson> {
    const current = this.person();
    if (this.profileVerified && current) {
      return of(current);
    }
    return this.http.get<MeResponse>(this.url('me')).pipe(
      tap(response => {
        this.updateSession({
          person: response.person,
          mustChangePassword: response.must_change_password
        });
        this.profileVerified = true;
      }),
      map(response => response.person)
    );
  }

  /** Troca a foto do perfil (imagem já recortada e reduzida no navegador). */
  uploadPhoto(image: Blob): Observable<SessionPerson> {
    const body = new FormData();
    body.append('photo', image, 'foto.jpg');
    return this.http
      .put<{ person: SessionPerson }>(`${this.config.getApiBaseUrl()}/me/photo/`, body)
      .pipe(map(response => response.person), tap(person => this.updateSession({ person })));
  }

  removePhoto(): Observable<SessionPerson> {
    return this.http
      .delete<{ person: SessionPerson }>(`${this.config.getApiBaseUrl()}/me/photo/`)
      .pipe(map(response => response.person), tap(person => this.updateSession({ person })));
  }

  clearSession(): void {
    this.profileVerified = false;
    this.state.set(null);
    writeSession(null);
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private startSession(response: LoginResponse): void {
    this.setSession({
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      mustChangePassword: response.must_change_password,
      person: response.person
    });
    this.profileVerified = true;
  }

  private updateSession(changes: Partial<Session>): void {
    const current = this.state();
    if (current) {
      this.setSession({ ...current, ...changes });
    }
  }

  private setSession(session: Session): void {
    this.state.set(session);
    writeSession(session);
  }

  private url(path: string): string {
    return `${this.config.getApiBaseUrl()}/auth/${path}/`;
  }
}
