import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Aguarda inicialização do auth
  while (auth.loading()) {
    await new Promise((r) => setTimeout(r, 50));
  }

  if (!auth.isAuthenticated()) {
    await router.navigate(['/'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  return true;
};

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return async (route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    while (auth.loading()) {
      await new Promise((r) => setTimeout(r, 50));
    }

    if (!auth.isAuthenticated() || !auth.role() || !allowedRoles.includes(auth.role()!)) {
      await router.navigate(['/unauthorized']);
      return false;
    }

    return true;
  };
};

// Tipos necessários
type UserRole = 'nutritionist' | 'volunteer' | 'manager';