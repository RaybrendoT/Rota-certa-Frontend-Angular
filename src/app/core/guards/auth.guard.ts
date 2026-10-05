import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Painel administrativo: exige sessão, perfil MANAGER ou GERENTE (confirmado no servidor) e
 * senha já trocada. Quem entra com outro perfil (motorista/funcionário) é deslogado e volta
 * ao login com aviso. Gestor e gerente veem menus diferentes dentro do mesmo painel.
 */
export const panelGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  return auth.ensureProfile().pipe(
    map(() => {
      if (!auth.canAccessPanel()) {
        auth.clearSession();
        return router.createUrlTree(['/login'], { queryParams: { motivo: 'sem-acesso' } });
      }
      if (auth.mustChangePassword()) {
        return router.createUrlTree(['/alterar-senha']);
      }
      return true;
    }),
    // 401 na revalidação: o interceptor já encerrou a sessão.
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};

/** Área de empresas: exclusiva do gerente (cadastro de empresas e de gestores). */
export const gerenteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isGerente() ? true : router.createUrlTree(['/home']);
};

/** Fluxos operacionais (frota, rotas, funcionários...): exclusivos do gestor, fora do escopo do gerente. */
export const gestorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isManager() ? true : router.createUrlTree(['/home']);
};

/** Tela de troca de senha: qualquer sessão válida. */
export const authenticatedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

/** Tela de login: quem já está logado como gestor ou gerente vai direto ao painel. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() && auth.canAccessPanel() ? router.createUrlTree(['/home']) : true;
};
