import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';

/** Endpoints que não levam token e cujo 401 significa "credencial errada", não "sessão expirada". */
const PUBLIC_AUTH_PATHS = ['/auth/login/', '/auth/refresh/', '/auth/verify/', '/auth/password-reset/'];

/**
 * Anexa o Bearer nas chamadas à API. Em 401 tenta renovar o access token uma vez e repete
 * a requisição; se a renovação falhar, encerra a sessão e volta ao login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const apiBase = inject(ConfigService).getApiBaseUrl();

  const isApiCall = !!apiBase && req.url.startsWith(apiBase);
  const isPublic = PUBLIC_AUTH_PATHS.some(path => req.url.includes(path));
  if (!isApiCall || isPublic) {
    return next(req);
  }

  const withToken = (token: string | null): HttpRequest<unknown> =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(withToken(auth.accessToken)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      if (!auth.refreshToken) {
        auth.logout();
        return throwError(() => error);
      }
      return auth.refreshAccessToken().pipe(
        // Só a falha da renovação encerra a sessão; erro da requisição repetida segue para o chamador.
        catchError(() => {
          auth.logout();
          return throwError(() => error);
        }),
        switchMap(token => next(withToken(token)))
      );
    })
  );
};
