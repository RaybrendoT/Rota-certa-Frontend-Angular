import { Routes } from '@angular/router';

export const MANAGER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/manager-list/manager-list.component')
        .then(c => c.ManagerListComponent)
  },
  {
    path: 'novo',
    loadComponent: () =>
      import('./components/manager-form/manager-form.component')
        .then(c => c.ManagerFormComponent)
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./components/manager-form/manager-form.component')
        .then(c => c.ManagerFormComponent)
  }
];
