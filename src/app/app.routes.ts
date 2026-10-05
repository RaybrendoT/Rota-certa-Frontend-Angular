import { Routes } from '@angular/router';
import {AppMenuComponent} from './layout/app-menu/app-menu.component';
import {authenticatedGuard, gerenteGuard, gestorGuard, guestGuard, panelGuard} from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/components/login/login.component')
        .then(c => c.LoginComponent)
  },
  {
    path: 'alterar-senha',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('./features/auth/components/change-password/change-password.component')
        .then(c => c.ChangePasswordComponent)
  },
  {
    path: '',
    component: AppMenuComponent,
    canActivate: [panelGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/report/components/report-maintenance/report-maintenance.component')
            .then(c => c.ReportMaintenanceComponent),
        data: {
          title: 'Dashboard em manutenção',
          description: 'O painel ainda não está disponível.'
        }
      },
      {
        path: 'funcionarios',
        canActivate: [gestorGuard],
        loadChildren: () =>
          import('./features/employee/employee.routes')
            .then(r => r.EMPLOYEE_ROUTES)
      },
      {
        path: 'veiculos',
        canActivate: [gestorGuard],
        loadChildren: () =>
          import('./features/vehicle/vehicle.routes')
            .then(r => r.VEHICLE_ROUTES)
      },
      {
        path: 'rotas',
        canActivate: [gestorGuard],
        loadChildren: () =>
          import('./features/route/route.routes')
            .then(r => r.ROUTE_ROUTES)
      },
      {
        path: 'horarios',
        canActivate: [gestorGuard],
        loadChildren: () =>
          import('./features/schedule/schedule.routes')
            .then(r => r.SCHEDULE_ROUTES)
      },
      {
        path: 'eventos-rota',
        canActivate: [gestorGuard],
        loadChildren: () =>
          import('./features/route-event/route-event.routes')
            .then(r => r.ROUTE_EVENT_ROUTES)
      },
      {
        path: 'relatorios',
        canActivate: [gestorGuard],
        loadChildren: () =>
          import('./features/report/report.routes')
            .then(r => r.REPORT_ROUTES)
      },
      {
        path: 'mapa',
        loadComponent: () =>
          import('./features/report/components/report-maintenance/report-maintenance.component')
            .then(c => c.ReportMaintenanceComponent),
        data: {
          title: 'Mapa ao vivo em manutenção',
          description: 'O mapa ao vivo ainda não está disponível.'
        }
      },
      {
        path: 'configuracoes',
        loadComponent: () =>
          import('./features/report/components/report-maintenance/report-maintenance.component')
            .then(c => c.ReportMaintenanceComponent),
        data: {
          title: 'Configurações em manutenção',
          description: 'A área de configurações ainda não está disponível.'
        }
      },
      {
        path: "home",
        loadComponent: () => import("./layout/home/home.component").then(c => c.HomeComponent),
      },

      {
        path: 'company',
        canActivate: [gerenteGuard],
        loadChildren: () =>
          import('./features/company/company.routes')
            .then(r => r.COMPANY_ROUTES)
      },
      {
        path: 'empresas',
        redirectTo: 'company',
        pathMatch: 'full'
      },
      {
        path: 'gestores',
        canActivate: [gerenteGuard],
        loadChildren: () =>
          import('./features/manager/manager.routes')
            .then(r => r.MANAGER_ROUTES)
      },

      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  },
];
