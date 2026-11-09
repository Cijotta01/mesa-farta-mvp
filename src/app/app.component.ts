import { Component, inject, signal, computed, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

import { AuthService, UserRole } from './core/auth/auth.service';
import { DexieService } from './core/storage/dexie.db';
import { SyncService } from './core/sync/sync.service';
import { LoginFormComponent } from './shared/components/login-form/login-form.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatChipsModule,
    MatMenuModule,
    MatBadgeModule,
    LoginFormComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private dexie = inject(DexieService);
  private sync = inject(SyncService);

  // Estado da UI
  isOnline = signal(navigator.onLine);
  syncing = signal(false);
  currentRoute = signal('');

  // Computed do auth
  user = this.auth.user;
  profile = this.auth.profile;
  role = this.auth.role;
  isAuthenticated = this.auth.isAuthenticated;
  isNutritionist = this.auth.isNutritionist;
  isVolunteer = this.auth.isVolunteer;
  isManager = this.auth.isManager;

  // Role label para chip
  roleLabel = computed(() => {
    const r = this.role();
    return r === 'nutritionist' ? 'Nutricionista' : r === 'volunteer' ? 'Voluntário' : r === 'manager' ? 'Gestor' : '';
  });

  constructor() {
    // Monitora online/offline
    window.addEventListener('online', () => this.isOnline.set(true));
    window.addEventListener('offline', () => this.isOnline.set(false));

    // Monitora rota atual para destacar nav
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: NavigationEnd) => {
      this.currentRoute.set(e.urlAfterRedirects);
    });

    // Auto-sync quando volta online
    effect(() => {
      if (this.isOnline() && this.isAuthenticated()) {
        this.triggerSync();
      }
    });
  }

  async triggerSync(): Promise<void> {
    if (this.syncing()) return;
    this.syncing.set(true);
    try {
      await this.sync.processQueue();
      await this.sync.pullFromServer();
    } finally {
      this.syncing.set(false);
    }
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }

  getNavItems() {
    const items = [
      { label: 'Início', icon: 'home', route: '/', roles: ['nutritionist', 'volunteer', 'manager'] as UserRole[] },
      { label: 'Checklist', icon: 'checklist', route: '/operacoes', roles: ['volunteer', 'nutritionist', 'manager'] as UserRole[] },
      { label: 'Sincronia', icon: 'sync', route: '/operacoes', roles: ['nutritionist', 'manager'] as UserRole[] },
    ];
    const role = this.role();
    return role ? items.filter(i => i.roles.includes(role)) : [];
  }

  isActive(route: string): boolean {
    return this.currentRoute().startsWith(route);
  }
}