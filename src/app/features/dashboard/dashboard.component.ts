import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';

import { AuthService } from '../../core/auth/auth.service';
import { StockService, CriticalItem } from '../../core/services/stock.service';
import { DonationService } from '../../core/services/donation.service';
import { TaskService } from '../../core/services/task.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    RouterLink,
  ],
  template: `
    <div class="dashboard">
      <!-- Header com ação principal -->
      <header class="dashboard-header">
        <div class="header-content">
          <h1>Painel Principal</h1>
          <p class="subtitle">Cozinha Comunitária Mesa Farta</p>
        </div>
        <button
          mat-fab
          color="primary"
          routerLink="/doacao/nova"
          aria-label="Nova doação"
          class="fab-nova-doacao"
          [disabled]="!isNutritionist()"
        >
          <mat-icon>add_a_photo</mat-icon>
        </button>
      </header>

      <!-- Card de atalhos rápidos -->
      <section class="shortcuts" aria-label="Ações rápidas">
        <mat-card class="shortcut-card" appearance="outlined">
          <mat-card-content>
            <div class="shortcuts-grid">
              <!-- Itens Críticos -->
              <button
                mat-button
                routerLink="/operacoes"
                fragment="painel-critico"
                class="shortcut-btn critical"
                [matBadge]="criticalCount()"
                matBadgeColor="warn"
                matBadgeOverlap="false"
                [disabled]="criticalCount() === 0 && loading()"
              >
                <mat-icon>warning</mat-icon>
                <div class="shortcut-info">
                  <span class="shortcut-label">Itens Críticos</span>
                  <span class="shortcut-desc">{{ criticalCount() }} itens vencendo ≤3 dias</span>
                </div>
              </button>

              <!-- Sugestão de Preparo -->
              <button
                mat-button
                routerLink="/operacoes"
                fragment="sugestao-preparo"
                class="shortcut-btn suggestion"
                [disabled]="!isNutritionist() || loading()"
              >
                <mat-icon>restaurant_menu</mat-icon>
                <div class="shortcut-info">
                  <span class="shortcut-label">Sugestão de Preparo</span>
                  <span class="shortcut-desc">Cruzar itens críticos com receitas</span>
                </div>
              </button>

              <!-- Meus Checklists / Relatórios -->
              <button
                mat-button
                [routerLink]="isVolunteer() ? '/operacoes' : '/operacoes'"
                [fragment]="isVolunteer() ? 'checklist' : 'relatorios'"
                class="shortcut-btn"
                [matBadge]="pendingTasksCount()"
                matBadgeColor="primary"
                matBadgeOverlap="false"
              >
                <mat-icon>{{ isVolunteer() ? 'checklist' : 'assessment' }}</mat-icon>
                <div class="shortcut-info">
                  <span class="shortcut-label">{{ isVolunteer() ? 'Meus Checklists' : 'Relatórios' }}</span>
                  <span class="shortcut-desc">
                    {{ isVolunteer() ? pendingTasksCount() + ' tarefas pendentes' : 'Gerar PDF/CSV' }}
                  </span>
                </div>
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </section>

      <!-- Status de sincronização e doações pendentes -->
      <section class="sync-status" aria-label="Status de sincronização">
        <mat-card appearance="outlined">
          <mat-card-content>
            <div class="sync-row">
              <div class="sync-item">
                <mat-icon [class.online]="isOnline()" [class.offline]="!isOnline()">
                  {{ isOnline() ? 'cloud_done' : 'cloud_off' }}
                </mat-icon>
                <span>{{ isOnline() ? 'Online' : 'Offline' }}</span>
              </div>
              <div class="sync-item" *ngIf="draftDonations() > 0">
                <mat-icon>pending</mat-icon>
                <span>{{ draftDonations() }} doação(ões) pendente(s) de sync</span>
              </div>
              <div class="sync-item" *ngIf="syncing()">
                <mat-spinner diameter="20"></mat-spinner>
                <span>Sincronizando...</span>
              </div>
              <button
                mat-stroked-button
                (click)="triggerSync()"
                [disabled]="!isOnline() || syncing()"
                class="sync-btn"
              >
                <mat-icon>sync</mat-icon>
                <span>Sincronizar agora</span>
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </section>

      <!-- Prévia de itens críticos -->
      <section class="critical-preview" aria-label="Prévia de itens críticos" *ngIf="criticalItems().length > 0">
        <div class="section-header">
          <h2>Itens que vencem em breve</h2>
          <a mat-button routerLink="/operacoes" fragment="painel-critico">Ver todos</a>
        </div>
        <div class="critical-list">
          @for (item of criticalItems().slice(0, 5); track item.id) {
            <div class="critical-item" [class]="item.urgency">
              <mat-chip [color]="urgencyColor(item.urgency)">
                <mat-icon>{{ urgencyIcon(item.urgency) }}</mat-icon>
                {{ urgencyLabel(item.urgency) }}
              </mat-chip>
              <div class="item-info">
                <span class="item-name">{{ item.product_name }}</span>
                <span class="item-meta">{{ item.quantity_kg }} {{ item.unit }} • Vence em {{ item.daysUntilExpiration }} dia(s)</span>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Estado vazio -->
      <div class="empty-state" *ngIf="!loading() && criticalItems().length === 0 && draftDonations() === 0">
        <mat-icon>inventory_2</mat-icon>
        <h3>Nenhum item crítico no momento</h3>
        <p>Registre uma nova doação para começar a acompanhar o estoque.</p>
        <button mat-flat-button color="primary" routerLink="/doacao/nova" *ngIf="isNutritionist()">
          <mat-icon>add</mat-icon>
          Registrar doação
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      max-width: 600px;
      margin: 0 auto;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      gap: 16px;
    }

    .header-content h1 {
      margin: 0 0 4px;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .subtitle {
      margin: 0;
      color: #666;
      font-size: 0.9rem;
    }

    .fab-nova-doacao {
      position: relative;
      z-index: 10;
      box-shadow: 0 4px 12px rgba(25, 118, 210, 0.4);
    }

    .fab-nova-doacao:disabled {
      background: #e0e0e0 !important;
      color: #9e9e9e !important;
    }

    /* Shortcuts */
    .shortcuts {
      margin-bottom: 16px;
    }

    .shortcuts-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .shortcut-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 16px 8px;
      min-height: 96px;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
      background: white;
      transition: all 0.2s ease;
      text-align: center;
    }

    .shortcut-btn:hover:not(:disabled) {
      border-color: #1976d2;
      box-shadow: 0 2px 8px rgba(25, 118, 210, 0.15);
    }

    .shortcut-btn.critical {
      border-color: #ffcdd2;
      background: #fefefe;
    }

    .shortcut-btn.critical:hover:not(:disabled) {
      border-color: #f44336;
      background: #fdf2f2;
    }

    .shortcut-btn.suggestion {
      border-color: #c8e6c9;
      background: #fefefe;
    }

    .shortcut-btn.suggestion:hover:not(:disabled) {
      border-color: #4caf50;
      background: #f1f8e9;
    }

    .shortcut-btn mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #1976d2;
    }

    .shortcut-btn.critical mat-icon {
      color: #f44336;
    }

    .shortcut-btn.suggestion mat-icon {
      color: #4caf50;
    }

    .shortcut-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .shortcut-label {
      font-weight: 600;
      font-size: 0.8rem;
      color: #333;
    }

    .shortcut-desc {
      font-size: 0.7rem;
      color: #666;
      line-height: 1.2;
    }

    /* Sync Status */
    .sync-status {
      margin-bottom: 16px;
    }

    .sync-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .sync-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      color: #555;
    }

    .sync-item mat-icon.online {
      color: #4caf50;
    }

    .sync-item mat-icon.offline {
      color: #f44336;
    }

    .sync-btn {
      margin-left: auto;
      min-height: 40px;
    }

    /* Critical Preview */
    .critical-preview {
      margin-bottom: 16px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .section-header h2 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .critical-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .critical-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: white;
      border-radius: 8px;
      border-left: 4px solid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    .critical-item.critical {
      border-left-color: #f44336;
    }

    .critical-item.warning {
      border-left-color: #ff9800;
    }

    .critical-item.ok {
      border-left-color: #4caf50;
    }

    .critical-item mat-chip {
      font-size: 0.7rem;
      height: 24px;
    }

    .critical-item mat-chip mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .item-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .item-name {
      font-weight: 500;
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-meta {
      font-size: 0.75rem;
      color: #666;
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      background: white;
      border-radius: 12px;
      border: 1px dashed #e0e0e0;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #bdbdbd;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      margin: 0 0 8px;
      color: #757575;
    }

    .empty-state p {
      margin: 0 0 24px;
      color: #9e9e9e;
      max-width: 280px;
    }

    /* Responsive */
    @media (max-width: 480px) {
      .shortcuts-grid {
        grid-template-columns: 1fr;
      }

      .shortcut-btn {
        flex-direction: row;
        justify-content: flex-start;
        text-align: left;
        padding: 12px 16px;
        min-height: 64px;
      }

      .shortcut-btn mat-icon {
        margin-right: 12px;
        flex-shrink: 0;
      }

      .sync-row {
        flex-direction: column;
        align-items: stretch;
      }

      .sync-btn {
        margin-left: 0;
        width: 100%;
      }
    }
  `],
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private stock = inject(StockService);
  private donation = inject(DonationService);
  private task = inject(TaskService);
  private announcer = inject(LiveAnnouncer);

  // Estado
  loading = signal(true);
  syncing = signal(false);
  criticalItems = signal<CriticalItem[]>([]);
  draftDonationsCount = signal(0);
  pendingTasksCount = signal(0);
  isOnline = signal(navigator.onLine);

  // Auth computed
  isNutritionist = this.auth.isNutritionist;
  isVolunteer = this.auth.isVolunteer;
  isManager = this.auth.isManager;

  // Helpers para template
  criticalCount = computed(() => this.criticalItems().length);
  draftDonations = computed(() => this.draftDonationsCount());

  ngOnInit(): void {
    this.loadData();
    this.setupOnlineListener();
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.announcer.announce('Conexão restaurada. Sincronizando...');
      this.triggerSync();
    });
    window.addEventListener('offline', () => this.isOnline.set(false));
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const [critical, drafts, tasks] = await Promise.all([
        this.stock.getCriticalItems(3),
        this.donation.getDraftDonations(),
        this.task.getPendingTasks(this.auth.profile()?.id),
      ]);
      this.criticalItems.set(critical);
      this.draftDonationsCount.set(drafts.length);
      this.pendingTasksCount.set(tasks.length);
    } catch (error) {
      console.error('[Dashboard] Erro ao carregar dados:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async triggerSync(): Promise<void> {
    if (!this.isOnline() || this.syncing()) return;
    this.syncing.set(true);
    try {
      // TODO: chamar SyncService
      await this.loadData();
      this.announcer.announce('Sincronização concluída');
    } finally {
      this.syncing.set(false);
    }
  }

  urgencyColor(urgency: CriticalItem['urgency']): 'primary' | 'accent' | 'warn' {
    return urgency === 'critical' ? 'warn' : urgency === 'warning' ? 'accent' : 'primary';
  }

  urgencyIcon(urgency: CriticalItem['urgency']): string {
    return urgency === 'critical' ? 'error' : urgency === 'warning' ? 'schedule' : 'check_circle';
  }

  urgencyLabel(urgency: CriticalItem['urgency']): string {
    return urgency === 'critical' ? 'Vence hoje' : urgency === 'warning' ? '2-3 dias' : 'OK';
  }
}