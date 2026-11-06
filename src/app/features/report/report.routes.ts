import { Routes } from '@angular/router';

export const REPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/reports-page/reports-page.component')
        .then(c => c.ReportsPageComponent),
  }
];
