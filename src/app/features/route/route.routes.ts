import { Routes } from '@angular/router';

export const ROUTE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/route-list/route-list.component')
        .then(c => c.RouteListComponent)
  },
  {
    // Criação e edição pelo stepper (horizontal ao criar, vertical com resumo ao editar).
    path: 'novo',
    loadComponent: () =>
      import('./components/route-wizard/route-wizard.component')
        .then(c => c.RouteWizardComponent)
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./components/route-wizard/route-wizard.component')
        .then(c => c.RouteWizardComponent)
  }
];
