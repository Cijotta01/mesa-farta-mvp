import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'doacao/nova',
    loadComponent: () => import('./features/donation-entry/donation-entry.component').then(m => m.DonationEntryComponent),
    canActivate: [roleGuard(['nutritionist'])],
  },
  {
    path: 'operacoes',
    loadComponent: () => import('./features/operations/operations.component').then(m => m.OperationsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/callback.component').then(m => m.AuthCallbackComponent),
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./shared/components/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

type UserRole = 'nutritionist' | 'volunteer' | 'manager';