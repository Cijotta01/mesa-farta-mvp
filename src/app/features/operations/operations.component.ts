import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { LiveAnnouncer } from '@angular/cdk/a11y';

import { AuthService } from '../../core/auth/auth.service';
import { StockService, CriticalItem } from '../../core/services/stock.service';
import { TaskService } from '../../core/services/task.service';
import { ReportService } from '../../core/services/report.service';
import { Task } from '../../shared/models';

@Component({
  selector: 'app-operations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTooltipModule,
    MatDividerModule,
    MatTableModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="operations">
      <!-- Header -->
      <header class="ops-header">
        <h1>Operações</h1>
        <mat-chip-set>
          <mat-chip [color]="isOnline() ? 'primary' : 'warn'">
            <mat-icon>{{ isOnline() ? 'cloud_done' : 'cloud_off' }}</mat-icon>
            {{ isOnline() ? 'Online' : 'Offline' }}
          </mat-chip>
        </mat-chip-set>
      </header>

      <!-- Tabs -->
      <mat-tab-group class="ops-tabs" (selectedTabChange)="onTabChange($event)" [selectedIndex]="selectedTab()">
        <!-- ABA 1: CHECKLIST -->
        <mat-tab label="Checklist">
          <div class="tab-content" role="tabpanel">
            @if (loadingTasks()) {
              <div class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>
            } @else if (pendingTasks().length === 0) {
              <div class="empty-checklist">
                <mat-icon>check_circle</mat-icon>
                <h3>Nenhuma tarefa pendente</h3>
                <p>Todas as tarefas foram concluídas. Ótimo trabalho!</p>
              </div>
            } @else {
              <div class="tasks-list">
                @for (task of pendingTasks(); track task.id; let i = $index) {
                  <mat-card class="task-card" appearance="outlined">
                    <mat-card-content>
                      <div class="task-main">
                        <mat-checkbox
                          class="task-checkbox"
                          [checked]="task.status === 'concluida'"
                          (change)="toggleTask(task, $event.checked)"
                          [disabled]="task.status === 'concluida'"
                          [attr.aria-label]="'Marcar ' + task.description + ' como ' + (task.status === 'concluida' ? 'concluída' : 'pendente')"
                        ></mat-checkbox>

                        <div class="task-info">
                          <span class="task-sequence">{{ task.sequence }}.</span>
                          <span class="task-description">{{ task.description }}</span>
                        </div>

                        <mat-chip [color]="task.status === 'concluida' ? 'primary' : 'warn'" class="task-status">
                          {{ task.status === 'concluida' ? 'Concluída' : 'Pendente' }}
                        </mat-chip>
                      </div>

                      <div class="task-meta" *ngIf="task.completed_at">
                        <mat-icon>check_circle</mat-icon>
                        <span>Concluída em {{ formatDateTime(task.completed_at) }}</span>
                      </div>
                    </mat-card-content>
                  </mat-card>
                }

                <!-- Botão "Próxima" fixo no rodapé -->
                <div class="next-task-bar" *ngIf="hasNextTask()">
                  <button
                    mat-flat-button
                    color="primary"
                    (click)="focusNextTask()"
                    class="next-btn"
                    style="width: 100%; min-height: 56px; font-size: 1.1rem;"
                  >
                    <mat-icon>navigate_next</mat-icon>
                    Próxima: {{ nextTaskDescription() }}
                  </button>
                </div>
              </div>
            }

            <!-- Pull to Refresh / Sync -->
            <div class="sync-footer" (click)="triggerSync()" style="cursor: pointer;">
              <mat-icon>{{ syncingTasks() ? 'sync' : 'cloud_download' }}</mat-icon>
              <span>{{ syncingTasks() ? 'Sincronizando...' : 'Puxar para sincronizar' }}</span>
            </div>
          </div>
        </mat-tab>

        <!-- ABA 2: PAINEL CRÍTICO -->
        <mat-tab label="Painel Crítico" *ngIf="isNutritionist() || isManager()">
          <div class="tab-content" role="tabpanel">
            <div class="panel-header">
              <div class="panel-stats">
                @for (stat of criticalStats(); track stat.label) {
                  <div class="stat-chip" [class]="stat.urgency">
                    <mat-chip [color]="stat.color">{{ stat.label }}</mat-chip>
                    <span class="stat-count">{{ stat.count }}</span>
                  </div>
                }
              </div>

              <mat-form-field appearance="outline" class="category-filter">
                <mat-label>Filtrar categoria</mat-label>
                <mat-select [formControl]="categoryFilter" (selectionChange)="applyCategoryFilter()">
                  <mat-option value="">Todas</mat-option>
                  @for (cat of categories; track cat.value) {
                    <mat-option [value]="cat.value">{{ cat.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            @if (loadingCritical()) {
              <div class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>
            } @else {
              <div class="table-container">
                <table mat-table [dataSource]="filteredCriticalItems()" class="critical-table" role="grid">
                  <!-- Coluna Produto -->
                  <ng-container matColumnDef="product">
                    <th mat-header-cell *matHeaderCellDef>Produto</th>
                    <td mat-cell *matCellDef="let item">
                      <div class="cell-product">
                        <span class="product-name">{{ item.product_name }}</span>
                        <span class="product-category">{{ item.category }}</span>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Coluna Validade -->
                  <ng-container matColumnDef="validity">
                    <th mat-header-cell *matHeaderCellDef>Validade</th>
                    <td mat-cell *matCellDef="let item">
                      <div class="cell-validity">
                        <mat-chip [color]="urgencyColor(item.urgency)" class="validity-chip">
                          <mat-icon>{{ urgencyIcon(item.urgency) }}</mat-icon>
                          {{ urgencyLabel(item.urgency) }}
                        </mat-chip>
                        <span class="validity-date">{{ formatDate(item.expiration_date) }}</span>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Coluna Quantidade -->
                  <ng-container matColumnDef="quantity">
                    <th mat-header-cell *matHeaderCellDef>Quantidade</th>
                    <td mat-cell *matCellDef="let item">{{ item.quantity_kg }} {{ item.unit }}</td>
                  </ng-container>

                  <!-- Coluna Ações -->
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Ações</th>
                    <td mat-cell *matCellDef="let item">
                      <button
                        mat-icon-button
                        [matTooltip]="'Detalhes do item'"
                        [attr.aria-label]="'Ver detalhes de ' + item.product_name"
                        (click)="viewItemDetails(item)"
                      >
                        <mat-icon>visibility</mat-icon>
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumns;" [class]="'urgency-' + row.urgency"></tr>
                </table>

                @if (filteredCriticalItems().length === 0) {
                  <div class="empty-table">
                    <mat-icon>filter_list_off</mat-icon>
                    <p>Nenhum item crítico encontrado com este filtro</p>
                  </div>
                }
              </div>
            }
          </div>
        </mat-tab>

        <!-- ABA 3: RELATÓRIOS -->
        <mat-tab label="Relatórios" *ngIf="isNutritionist() || isManager()">
          <div class="tab-content" role="tabpanel">
            <mat-card appearance="outlined" class="report-card">
              <mat-card-header>
                <mat-card-title>Gerar Relatório</mat-card-title>
                <mat-card-subtitle>Período e formato de exportação</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <form class="report-form" #reportForm="ngForm" (ngSubmit)="generateReport()">
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Data inicial *</mat-label>
                      <input matInput [matDatepicker]="startPicker" [(ngModel)]="reportPeriod.start" name="start" required />
                      <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
                      <mat-datepicker #startPicker></mat-datepicker>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Data final *</mat-label>
                      <input matInput [matDatepicker]="endPicker" [(ngModel)]="reportPeriod.end" name="end" required />
                      <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
                      <mat-datepicker #endPicker></mat-datepicker>
                    </mat-form-field>
                  </div>

                  <div class="form-row">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Formato *</mat-label>
                      <mat-select [(ngModel)]="reportPeriod.format" name="format" required>
                        <mat-option value="pdf">PDF (acessível)</mat-option>
                        <mat-option value="csv">CSV (UTF-8 com BOM)</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>

                  <div class="report-actions">
                    <button
                      mat-flat-button
                      color="primary"
                      type="submit"
                      [disabled]="reportForm.invalid || generatingReport()"
                      style="min-width: 160px;"
                    >
                      @if (generatingReport()) {
                        <mat-spinner diameter="20"></mat-spinner>
                        Gerando...
                      } @else {
                        <mat-icon>{{ reportPeriod.format === 'pdf' ? 'picture_as_pdf' : 'table_chart' }}</mat-icon>
                        Gerar {{ reportPeriod.format.toUpperCase() }}
                      }
                    </button>
                  </div>
                </form>

                @if (lastReportUrl()) {
                  <div class="report-result">
                    <mat-divider></mat-divider>
                    <p>Relatório gerado com sucesso:</p>
                    <a mat-flat-button color="accent" [href]="lastReportUrl()" target="_blank" rel="noopener">
                      <mat-icon>download</mat-icon>
                      Baixar {{ reportPeriod.format.toUpperCase() }}
                    </a>
                  </div>
                }
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- Banner offline persistente -->
      @if (!isOnline()) {
        <div class="offline-banner-bottom" role="status" aria-live="polite">
          <mat-icon>wifi_off</mat-icon>
          <span>Offline — alterações salvas localmente</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .operations {
      max-width: 900px;
      margin: 0 auto;
      padding-bottom: 100px;
    }

    .ops-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding: 8px 0;
    }

    .ops-header h1 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .ops-tabs {
      background: white;
      border-radius: 12px 12px 0 0;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.05);
    }

    .tab-content {
      padding: 16px;
    }

    .loading-center {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    /* ===== CHECKLIST ===== */
    .empty-checklist {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
    }

    .empty-checklist mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #4caf50;
      margin-bottom: 16px;
    }

    .empty-checklist h3 {
      margin: 0 0 8px;
      color: #2e7d32;
    }

    .empty-checklist p {
      margin: 0;
      color: #666;
    }

    .tasks-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .task-card {
      border-left: 4px solid #e0e0e0;
    }

    .task-card:has(.task-status[color="primary"]) {
      border-left-color: #4caf50;
    }

    .task-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .task-checkbox {
      --mdc-checkbox-touch-target-size: 48px;
    }

    .task-info {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    .task-sequence {
      font-weight: 700;
      font-size: 1.1rem;
      color: #1976d2;
      min-width: 28px;
    }

    .task-description {
      font-size: 1rem;
      font-weight: 500;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .task-status {
      font-size: 0.75rem;
      height: 24px;
      font-weight: 500;
    }

    .task-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding-left: 56px; // alinha com checkbox
      font-size: 0.8rem;
      color: #4caf50;
    }

    .task-meta mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .next-task-bar {
      position: sticky;
      bottom: 0;
      padding: 12px 0;
      background: linear-gradient(to top, white 80%, transparent);
      z-index: 10;
    }

    .next-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .sync-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
      color: #666;
      font-size: 0.9rem;
    }

    /* ===== PAINEL CRÍTICO ===== */
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .panel-stats {
      display: flex;
      gap: 8px;
    }

    .stat-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: white;
      border-radius: 20px;
      border: 1px solid;
    }

    .stat-chip.critical {
      border-color: #f44336;
    }

    .stat-chip.warning {
      border-color: #ff9800;
    }

    .stat-chip.ok {
      border-color: #4caf50;
    }

    .stat-chip mat-chip {
      font-size: 0.7rem;
      height: 22px;
    }

    .stat-count {
      font-weight: 700;
      font-size: 1.1rem;
    }

    .stat-chip.critical .stat-count { color: #f44336; }
    .stat-chip.warning .stat-count { color: #ff9800; }
    .stat-chip.ok .stat-count { color: #4caf50; }

    .category-filter {
      min-width: 200px;
    }

    .table-container {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .critical-table {
      width: 100%;
      min-width: 600px;
    }

    .critical-table th {
      font-weight: 600;
      color: #333;
      background: #fafafa;
    }

    .critical-table td {
      padding: 12px 16px;
    }

    .critical-table tr.urgency-critical {
      background: #fdf2f2;
    }

    .critical-table tr.urgency-warning {
      background: #fff8e1;
    }

    .critical-table tr.urgency-ok {
      background: #f1f8e9;
    }

    .cell-product {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .product-name {
      font-weight: 500;
    }

    .product-category {
      font-size: 0.75rem;
      color: #666;
      text-transform: capitalize;
    }

    .cell-validity {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .validity-chip {
      font-size: 0.7rem;
      height: 22px;
    }

    .validity-chip mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .validity-date {
      font-size: 0.85rem;
      color: #555;
      font-variant-numeric: tabular-nums;
    }

    .empty-table {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: #9e9e9e;
    }

    .empty-table mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    /* ===== RELATÓRIOS ===== */
    .report-card {
      max-width: 560px;
    }

    .report-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .full-width {
      width: 100%;
    }

    .report-actions {
      margin-top: 8px;
    }

    .report-result {
      margin-top: 16px;
      padding-top: 16px;
      text-align: center;
    }

    .report-result p {
      margin: 0 0 12px;
      color: #666;
    }

    /* ===== OFFLINE BANNER BOTTOM ===== */
    .offline-banner-bottom {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #fff3e0;
      color: #e65100;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      z-index: 99;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
    }

    .offline-banner-bottom mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 768px) {
      .form-row {
        grid-template-columns: 1fr;
      }

      .panel-stats {
        width: 100%;
        justify-content: space-around;
      }

      .category-filter {
        width: 100%;
      }

      .table-container {
        border-radius: 0;
        border-left: none;
        border-right: none;
      }
    }
  `],
})
export class OperationsComponent implements OnInit {
  private auth = inject(AuthService);
  private stock = inject(StockService);
  private taskService = inject(TaskService);
  private reportService = inject(ReportService);
  private snackBar = inject(MatSnackBar);
  private announcer = inject(LiveAnnouncer);

  // Estado
  selectedTab = signal(0);
  loadingTasks = signal(true);
  loadingCritical = signal(true);
  syncingTasks = signal(false);
  generatingReport = signal(false);
  isOnline = signal(navigator.onLine);

  // Data
  pendingTasks = signal<Task[]>([]);
  criticalItems = signal<CriticalItem[]>([]);
  criticalStats = signal<{ label: string; count: number; urgency: CriticalItem['urgency']; color: 'warn' | 'accent' | 'primary' }[]>([]);
  filteredCriticalItems = signal<CriticalItem[]>([]);
  lastReportUrl = signal<string | null>(null);

  // Filters
  categoryFilter = new FormControl('');
  categories = [
    { value: 'hortifruti', label: 'Hortifrúti' },
    { value: 'proteina', label: 'Proteína' },
    { value: 'grao', label: 'Grão' },
    { value: 'laticinio', label: 'Laticínio' },
    { value: 'panificado', label: 'Panificado' },
    { value: 'outro', label: 'Outro' },
  ];

  // Report form
  reportPeriod = {
    start: '',
    end: '',
    format: 'pdf' as 'pdf' | 'csv',
  };

  // Auth computed
  isNutritionist = this.auth.isNutritionist;
  isVolunteer = this.auth.isVolunteer;
  isManager = this.auth.isManager;

  displayedColumns = ['product', 'validity', 'quantity', 'actions'];

  ngOnInit(): void {
    this.loadData();
    this.setupOnlineListener();
    this.setupDateDefaults();
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.triggerSync();
    });
    window.addEventListener('offline', () => this.isOnline.set(false));
  }

  private setupDateDefaults(): void {
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    this.reportPeriod.start = monthAgo.toISOString().split('T')[0];
    this.reportPeriod.end = today.toISOString().split('T')[0];
  }

  async loadData(): Promise<void> {
    await Promise.all([
      this.loadTasks(),
      this.loadCriticalItems(),
    ]);
  }

  async loadTasks(): Promise<void> {
    this.loadingTasks.set(true);
    try {
      const tasks = await this.taskService.getPendingTasks(this.auth.profile()?.id);
      this.pendingTasks.set(tasks);
    } catch (error) {
      console.error('[Operations] Erro ao carregar tasks:', error);
    } finally {
      this.loadingTasks.set(false);
    }
  }

  async loadCriticalItems(): Promise<void> {
    this.loadingCritical.set(true);
    try {
      const items = await this.stock.getCriticalItems(3);
      this.criticalItems.set(items);
      this.applyCategoryFilter();

      // Stats
      const stats = await this.stock.getCriticalStats();
      this.criticalStats.set([
        { label: 'Crítico (≤1 dia)', count: stats.critical, urgency: 'critical', color: 'warn' },
        { label: 'Atenção (2-3 dias)', count: stats.warning, urgency: 'warning', color: 'accent' },
        { label: 'OK (>3 dias)', count: stats.ok, urgency: 'ok', color: 'primary' },
      ]);
    } catch (error) {
      console.error('[Operations] Erro ao carregar itens críticos:', error);
    } finally {
      this.loadingCritical.set(false);
    }
  }

  onTabChange(event: { index: number }): void {
    this.selectedTab.set(event.index);
    if (event.index === 0) this.loadTasks();
    if (event.index === 1) this.loadCriticalItems();
  }

  applyCategoryFilter(): void {
    const filter = this.categoryFilter.value;
    let filtered = this.criticalItems();
    if (filter) {
      filtered = filtered.filter(item => item.category === filter);
    }
    this.filteredCriticalItems.set(filtered);
  }

  // --- Checklist Actions ---
  async toggleTask(task: Task, completed: boolean): Promise<void> {
    if (completed) {
      await this.taskService.completeTask(task.id, this.auth.profile()!.id);
      this.announcer.announce(`Tarefa concluída. ${this.getNextTaskAnnouncement()}`);
    } else {
      // Reabrir tarefa (se necessário)
      await this.taskService.updateTask(task.id, { status: 'pendente' });
    }
    await this.loadTasks();
  }

  hasNextTask(): boolean {
    const pending = this.pendingTasks().filter(t => t.status === 'pendente');
    return pending.length > 0;
  }

  nextTaskDescription(): string {
    const pending = this.pendingTasks().filter(t => t.status === 'pendente');
    return pending[0]?.description ?? '';
  }

  focusNextTask(): void {
    const pending = this.pendingTasks().filter(t => t.status === 'pendente');
    if (pending.length > 0) {
      // Scroll para a próxima tarefa
      const element = document.querySelector(`[data-task-id="${pending[0].id}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Foca no checkbox
      setTimeout(() => {
        const checkbox = element?.querySelector('mat-checkbox') as HTMLElement;
        checkbox?.focus();
      }, 300);
    }
  }

  private getNextTaskAnnouncement(): string {
    const pending = this.pendingTasks().filter(t => t.status === 'pendente');
    if (pending.length > 0) {
      return `Próxima: ${pending[0].description}`;
    }
    return 'Todas as tarefas concluídas.';
  }

  // --- Sync ---
  async triggerSync(): Promise<void> {
    if (!this.isOnline() || this.syncingTasks()) return;
    this.syncingTasks.set(true);
    try {
      // TODO: chamar SyncService
      await this.loadData();
      this.announcer.announce('Sincronização concluída');
      this.showSuccess('Sincronizado com sucesso');
    } catch (error) {
      this.showError('Falha na sincronização');
    } finally {
      this.syncingTasks.set(false);
    }
  }

  // --- Critical Panel Actions ---
  viewItemDetails(item: CriticalItem): void {
    // TODO: abrir modal com detalhes
    this.showSuccess(`Detalhes de ${item.product_name} - a implementar`);
  }

  urgencyColor(urgency: CriticalItem['urgency']): 'warn' | 'accent' | 'primary' {
    return urgency === 'critical' ? 'warn' : urgency === 'warning' ? 'accent' : 'primary';
  }

  urgencyIcon(urgency: CriticalItem['urgency']): string {
    return urgency === 'critical' ? 'error' : urgency === 'warning' ? 'schedule' : 'check_circle';
  }

  urgencyLabel(urgency: CriticalItem['urgency']): string {
    return urgency === 'critical' ? 'Vence hoje' : urgency === 'warning' ? '2-3 dias' : 'OK';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  // --- Reports ---
  async generateReport(): Promise<void> {
    this.generatingReport.set(true);
    this.lastReportUrl.set(null);

    try {
      const result = await this.reportService.generateReport({
        period_start: this.reportPeriod.start,
        period_end: this.reportPeriod.end,
        format: this.reportPeriod.format,
      });

      this.lastReportUrl.set(result.pdfUrl || result.csvUrl || '');
      this.announcer.announce(`Relatório ${this.reportPeriod.format.toUpperCase()} gerado com sucesso`);
      this.showSuccess('Relatório gerado!');
    } catch (error) {
      console.error('[Operations] Erro ao gerar relatório:', error);
      this.showError('Falha ao gerar relatório');
    } finally {
      this.generatingReport.set(false);
    }
  }

  private showSuccess(msg: string): void {
    this.snackBar.open(msg, 'OK', { duration: 3000, panelClass: 'success-snackbar' });
  }

  private showError(msg: string): void {
    this.snackBar.open(msg, 'OK', { duration: 5000, panelClass: 'error-snackbar' });
  }
}

type ItemCategory = 'hortifruti' | 'proteina' | 'grao' | 'laticinio' | 'panificado' | 'outro';