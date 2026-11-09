import { Component, inject, signal, computed, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

import { AuthService } from '../../core/auth/auth.service';
import { DonationService } from '../../core/services/donation.service';
import { StockService } from '../../core/services/stock.service';
import { Donor, DonationCreateInput, ItemCreateInput } from '../../shared/models';
import { DexieService } from '../../core/storage/dexie.db';

interface OcrResult {
  product_name?: string;
  category?: 'hortifruti' | 'proteina' | 'grao' | 'laticinio' | 'panificado' | 'outro';
  quantity_kg?: number;
  unit?: 'kg' | 'un' | 'l';
  expiration_date?: string;
  lot_code?: string;
  barcode?: string;
  confidence: number;
}

@Component({
  selector: 'app-donation-entry',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatStepperModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  template: `
    <div class="donation-entry">
      <!-- Header -->
      <header class="entry-header">
        <button mat-icon-button (click)="goBack()" aria-label="Voltar">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="header-title">
          <h1>Nova Doação</h1>
          <p class="step-indicator">Passo {{ currentStep() + 1 }} de 3</p>
        </div>
      </header>

      <!-- Stepper Linear -->
      <mat-stepper linear #stepper [selectedIndex]="currentStep()" class="entry-stepper">
        <!-- PASSO 1: Captura -->
        <mat-step [stepControl]="captureForm" label="Captura" [optional]="false">
          <div class="step-content">
            <h2>Fotografe o código de barras ou nota fiscal</h2>

            <!-- Drop Zone / Camera -->
            <div
              class="capture-zone"
              (click)="fileInput.click()"
              (keydown.enter)="fileInput.click()"
              (keydown.space)="$event.preventDefault(); fileInput.click()"
              tabindex="0"
              role="button"
              aria-label="Toque para escanear código de barras ou fotografar nota"
            >
              <input
                #fileInput
                type="file"
                accept="image/*"
                capture="environment"
                (change)="onImageSelected($event)"
                hidden
              />

              @if (!selectedImage()) {
                <mat-icon class="capture-icon">camera_alt</mat-icon>
                <p class="capture-text">Toque para escanear código de barras ou fotografar nota</p>
                <p class="capture-hint">Câmera traseira • OCR offline</p>
              } @else {
                <img [src]="selectedImage()!" alt="Prévia da imagem capturada" class="capture-preview" />
                <div class="capture-overlay">
                  @if (ocrLoading()) {
                    <mat-spinner diameter="40" color="primary"></mat-spinner>
                    <p>Processando imagem...</p>
                  } @else {
                    <button mat-stroked-button color="primary" (click)="retakePhoto($event)">
                      <mat-icon>refresh</mat-icon>
                      Refazer foto
                    </button>
                  }
                </div>
              }
            </div>

            <!-- OCR Status -->
            @if (ocrLoading()) {
              <div class="ocr-status" role="status" aria-live="polite">
                <mat-spinner diameter="24"></mat-spinner>
                <span>OCR em andamento... (Web Worker)</span>
              </div>
            }

            <!-- Erro OCR baixa confiança -->
            @if (ocrError()) {
              <div class="ocr-error" role="alert">
                <mat-icon>warning</mat-icon>
                <span>OCR incerto ({{ ocrConfidence() }}%) — confira os campos abaixo</span>
              </div>
            }
          </div>
        </mat-step>

        <!-- PASSO 2: Confirmação -->
        <mat-step [stepControl]="confirmForm" label="Confirmação" [optional]="false">
          <div class="step-content">
            <h2>Confira e complete os dados</h2>

            <form [formGroup]="confirmForm" class="confirm-form">
              <!-- Linha 1: Produto + Categoria -->
              <div class="form-row">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Produto *</mat-label>
                  <input matInput formControlName="product_name" required autocomplete="off" />
                  <mat-icon matPrefix>inventory_2</mat-icon>
                  <mat-error *ngIf="confirmForm.get('product_name')?.hasError('required')">Nome do produto é obrigatório</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Categoria *</mat-label>
                  <mat-select formControlName="category" required>
                    @for (cat of categories; track cat.value) {
                      <mat-option [value]="cat.value">{{ cat.label }}</mat-option>
                    }
                  </mat-select>
                  <mat-icon matPrefix>category</mat-icon>
                  <mat-error *ngIf="confirmForm.get('category')?.hasError('required')">Selecione a categoria</mat-error>
                </mat-form-field>
              </div>

              <!-- Linha 2: Quantidade + Unidade -->
              <div class="form-row">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Quantidade *</mat-label>
                  <input matInput type="number" formControlName="quantity_kg" step="0.01" min="0.01" required />
                  <mat-icon matPrefix>scale</mat-icon>
                  <mat-error *ngIf="confirmForm.get('quantity_kg')?.hasError('required')">Quantidade é obrigatória</mat-error>
                  <mat-error *ngIf="confirmForm.get('quantity_kg')?.hasError('min')">Deve ser maior que zero</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Unidade *</mat-label>
                  <mat-select formControlName="unit" required>
                    <mat-option value="kg">kg</mat-option>
                    <mat-option value="un">un</mat-option>
                    <mat-option value="l">l</mat-option>
                  </mat-select>
                  <mat-icon matPrefix>straighten</mat-icon>
                </mat-form-field>
              </div>

              <!-- Linha 3: Validade + Lote -->
              <div class="form-row">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Data de validade *</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="expiration_date" required />
                  <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                  <mat-icon matPrefix>event</mat-icon>
                  <mat-error *ngIf="confirmForm.get('expiration_date')?.hasError('required')">Data de validade é obrigatória</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Código do lote</mat-label>
                  <input matInput formControlName="lot_code" />
                  <mat-icon matPrefix>confirmation_number</mat-icon>
                </mat-form-field>
              </div>

              <!-- Linha 4: Código de barras (readonly se preenchido pelo OCR) -->
              <div class="form-row">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Código de barras</mat-label>
                  <input matInput formControlName="barcode" [readonly]="!!ocrResult()?.barcode" />
                  <mat-icon matPrefix>qr_code_scanner</mat-icon>
                  @if (ocrResult()?.barcode) {
                    <mat-hint>Preenchido automaticamente pelo OCR</mat-hint>
                  }
                </mat-form-field>
              </div>

              <!-- Linha 5: Doador -->
              <div class="form-row">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Doador *</mat-label>
                  <mat-select formControlName="donor_id" required>
                    @for (donor of donors(); track donor.id) {
                      <mat-option [value]="donor.id">{{ donor.name }} ({{ donor.type }})</mat-option>
                    }
                  </mat-select>
                  <mat-icon matPrefix>store</mat-icon>
                  <mat-error *ngIf="confirmForm.get('donor_id')?.hasError('required')">Selecione o doador</mat-error>
                </mat-form-field>
              </div>

              <!-- Observações -->
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Observações</mat-label>
                <textarea matInput formControlName="notes" rows="2" placeholder="Informações adicionais..."></textarea>
                <mat-icon matPrefix>note</mat-icon>
              </mat-form-field>
            </form>
          </div>
        </mat-step>

        <!-- PASSO 3: Salvo -->
        <mat-step label="Salvo" [optional]="false">
          <div class="step-content success-step">
            <div class="success-icon">
              <mat-icon>check_circle</mat-icon>
            </div>
            <h2>Doação salva localmente!</h2>
            <p class="success-id">ID: {{ savedDonationId() }}</p>
            <p class="success-message">A doação será sincronizada automaticamente quando houver conexão.</p>

            <div class="success-actions">
              <button mat-flat-button color="primary" (click)="startNewDonation()" style="min-width: 160px;">
                <mat-icon>add</mat-icon>
                Nova doação
              </button>
              <button
                mat-flat-button
                color="accent"
                (click)="approveAndGenerateTasks()"
                *ngIf="canGenerateTasks()"
                style="min-width: 160px;"
              >
                <mat-icon>checklist</mat-icon>
                Aprovar e gerar tasks
              </button>
            </div>
          </div>
        </mat-step>
      </mat-stepper>

      <!-- Navegação inferior (fora do stepper para controle total) -->
      <div class="stepper-nav" *ngIf="currentStep() < 2">
        <button mat-button (click)="prevStep()" *ngIf="currentStep() > 0" [disabled]="ocrLoading()">
          <mat-icon>chevron_left</mat-icon>
          Voltar
        </button>
        <div class="nav-spacer"></div>
        <button
          mat-flat-button
          color="primary"
          (click)="nextStep()"
          [disabled]="!canProceed() || ocrLoading()"
        >
          @if (currentStep() === 1) {
            <mat-icon>save</mat-icon>
            Salvar offline
          } @else {
            <mat-icon>arrow_forward</mat-icon>
            Avançar
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .donation-entry {
      max-width: 560px;
      margin: 0 auto;
      padding-bottom: 100px;
    }

    .entry-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      padding: 8px 0;
    }

    .header-title h1 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .step-indicator {
      margin: 0;
      font-size: 0.8rem;
      color: #666;
    }

    .entry-stepper {
      background: transparent;
      box-shadow: none;
    }

    .step-content {
      padding: 16px 0 24px;
    }

    .step-content h2 {
      margin: 0 0 20px;
      font-size: 1.1rem;
      font-weight: 600;
      color: #333;
    }

    /* Capture Zone */
    .capture-zone {
      position: relative;
      width: 100%;
      aspect-ratio: 4/3;
      min-height: 240px;
      border: 2px dashed #1976d2;
      border-radius: 12px;
      background: #f5f5f5;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      overflow: hidden;
    }

    .capture-zone:hover,
    .capture-zone:focus {
      border-color: #1565c0;
      background: #e3f2fd;
      box-shadow: 0 4px 12px rgba(25, 118, 210, 0.2);
      outline: none;
    }

    .capture-zone:focus-visible {
      outline: 3px solid #1976d2;
      outline-offset: 2px;
    }

    .capture-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: #1976d2;
      margin-bottom: 12px;
    }

    .capture-text {
      margin: 0 0 4px;
      font-size: 1rem;
      color: #333;
      text-align: center;
    }

    .capture-hint {
      margin: 0;
      font-size: 0.8rem;
      color: #666;
    }

    .capture-preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .capture-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 16px;
      background: linear-gradient(transparent, rgba(0,0,0,0.7));
      display: flex;
      justify-content: center;
    }

    .capture-overlay button {
      min-height: 48px;
    }

    /* OCR Status */
    .ocr-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 16px;
      padding: 12px;
      background: #e3f2fd;
      border-radius: 8px;
      color: #1565c0;
      font-size: 0.9rem;
    }

    .ocr-status mat-spinner {
      margin: 0;
    }

    /* OCR Error */
    .ocr-error {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 12px 16px;
      background: #fff3e0;
      border: 1px solid #ffcc80;
      border-radius: 8px;
      color: #e65100;
      font-weight: 500;
      font-size: 0.85rem;
    }

    .ocr-error mat-icon {
      color: #f57c00;
    }

    /* Confirm Form */
    .confirm-form {
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

    /* Success Step */
    .success-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 32px 16px;
    }

    .success-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #e8f5e9;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .success-icon mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #2e7d32;
    }

    .success-step h2 {
      margin: 0 0 8px;
      color: #2e7d32;
    }

    .success-id {
      margin: 0 0 16px;
      font-family: monospace;
      font-size: 0.9rem;
      color: #666;
      background: #f5f5f5;
      padding: 8px 16px;
      border-radius: 8px;
    }

    .success-message {
      margin: 0 0 24px;
      color: #666;
      max-width: 300px;
    }

    .success-actions {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .success-actions button {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 48px;
    }

    /* Stepper Nav */
    .stepper-nav {
      position: sticky;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 12px 0;
      background: linear-gradient(to top, white 80%, transparent);
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 50;
      border-top: 1px solid #eee;
    }

    .stepper-nav button {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 48px;
      min-width: 120px;
    }

    .nav-spacer {
      flex: 1;
    }

    /* Responsive */
    @media (max-width: 480px) {
      .form-row {
        grid-template-columns: 1fr;
      }

      .capture-zone {
        aspect-ratio: 16/10;
        min-height: 200px;
      }
    }
  `],
})
export class DonationEntryComponent implements AfterViewInit, OnDestroy {
  private auth = inject(AuthService);
  private donationService = inject(DonationService);
  private stock = inject(StockService);
  private dexie = inject(DexieService);
  private snackBar = inject(MatSnackBar);
  private announcer = inject(LiveAnnouncer);

  // Stepper state
  currentStep = signal(0);
  ocrLoading = signal(false);
  ocrError = signal(false);
  ocrConfidence = signal(0);
  ocrResult = signal<OcrResult | null>(null);
  selectedImage = signal<string | null>(null);
  savedDonationId = signal('');

  // Forms
  captureForm = new FormGroup({});
  confirmForm = new FormGroup({
    product_name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    category: new FormControl<ItemCategory | null>(null, Validators.required),
    quantity_kg: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    unit: new FormControl<'kg' | 'un' | 'l'>('kg', Validators.required),
    expiration_date: new FormControl<string | null>(null, Validators.required),
    lot_code: new FormControl(''),
    barcode: new FormControl(''),
    donor_id: new FormControl<string | null>(null, Validators.required),
    notes: new FormControl(''),
  });

  // Data
  donors = signal<Donor[]>([]);
  categories = [
    { value: 'hortifruti' as ItemCategory, label: 'Hortifrúti' },
    { value: 'proteina' as ItemCategory, label: 'Proteína' },
    { value: 'grao' as ItemCategory, label: 'Grão' },
    { value: 'laticinio' as ItemCategory, label: 'Laticínio' },
    { value: 'panificado' as ItemCategory, label: 'Panificado' },
    { value: 'outro' as ItemCategory, label: 'Outro' },
  ];

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  async ngAfterViewInit(): Promise<void> {
    await this.loadDonors();
    // Pré-seleciona data de validade para amanhã
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.confirmForm.patchValue({ expiration_date: tomorrow.toISOString().split('T')[0] });
  }

  ngOnDestroy(): void {
    this.resetState();
  }

  async loadDonors(): Promise<void> {
    const donors = await this.dexie.getActiveDonors();
    this.donors.set(donors);
  }

  // --- Stepper Navigation ---
  canProceed(): boolean {
    if (this.currentStep() === 0) {
      // Passo 1: precisa ter imagem capturada
      return !!this.selectedImage();
    }
    if (this.currentStep() === 1) {
      // Passo 2: formulário válido
      return this.confirmForm.valid;
    }
    return false;
  }

  nextStep(): void {
    if (!this.canProceed()) return;

    if (this.currentStep() === 0) {
      // Processa OCR antes de avançar
      this.processOcr();
    } else if (this.currentStep() === 1) {
      this.saveDonation();
    }
  }

  prevStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update(s => s - 1);
    }
  }

  goBack(): void {
    if (this.currentStep() > 0) {
      this.prevStep();
    } else {
      window.history.back();
    }
  }

  // --- OCR Processing ---
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Valida tipo e tamanho
    if (!file.type.startsWith('image/')) {
      this.showError('Selecione uma imagem válida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.showError('Imagem muito grande (máx. 5MB)');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => this.selectedImage.set(e.target?.result as string);
    reader.readAsDataURL(file);

    // Processa OCR em Web Worker (simulado aqui)
    this.processOcr(file);
  }

  async processOcr(file?: File): Promise<void> {
    this.ocrLoading.set(true);
    this.ocrError.set(false);

    try {
      // TODO: Implementar Web Worker com Tesseract.js
      // Por enquanto, simula resultado
      await new Promise(r => setTimeout(r, 1500));

      // Mock OCR result para desenvolvimento
      const mockResult: OcrResult = {
        product_name: 'Tomate',
        category: 'hortifruti',
        quantity_kg: 5.0,
        unit: 'kg',
        expiration_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lot_code: 'L12345',
        barcode: '7891234567890',
        confidence: 92,
      };

      this.ocrResult.set(mockResult);
      this.ocrConfidence.set(mockResult.confidence);

      // Preenche formulário
      this.confirmForm.patchValue({
        product_name: mockResult.product_name,
        category: mockResult.category,
        quantity_kg: mockResult.quantity_kg,
        unit: mockResult.unit,
        expiration_date: mockResult.expiration_date,
        lot_code: mockResult.lot_code,
        barcode: mockResult.barcode,
      });

      // Alerta se confiança baixa
      if (mockResult.confidence < 80) {
        this.ocrError.set(true);
        this.announcer.announce('OCR incerto. Por favor, confira os campos.');
      } else {
        this.announcer.announce('OCR concluído. Dados preenchidos automaticamente.');
      }
    } catch (error) {
      console.error('[OCR] Erro:', error);
      this.ocrError.set(true);
      this.ocrConfidence.set(0);
    } finally {
      this.ocrLoading.set(false);
    }
  }

  retakePhoto(event: Event): void {
    event.stopPropagation();
    this.selectedImage.set(null);
    this.ocrResult.set(null);
    this.ocrError.set(false);
    this.ocrConfidence.set(0);
    this.confirmForm.reset({
      unit: 'kg',
      expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    this.fileInput.nativeElement.value = '';
  }

  // --- Save Donation ---
  async saveDonation(): Promise<void> {
    const formValue = this.confirmForm.value;

    const donationInput: DonationCreateInput = {
      donor_id: formValue.donor_id!,
      received_at: new Date().toISOString(),
      received_by: this.auth.user()?.id ?? 'unknown',
      vehicle_plate: undefined,
      notes: formValue.notes || undefined,
    };

    const itemInput: ItemCreateInput = {
      donation_id: '', // será preenchido pelo service
      product_name: formValue.product_name!,
      category: formValue.category!,
      quantity_kg: formValue.quantity_kg!,
      unit: formValue.unit!,
      expiration_date: formValue.expiration_date!,
      lot_code: formValue.lot_code || undefined,
      barcode: formValue.barcode || undefined,
    };

    try {
      const { donation } = await this.donationService.createDonationWithItems(donationInput, [itemInput]);
      this.savedDonationId.set(donation.id.slice(0, 8).toUpperCase());
      this.currentStep.set(2);
      this.announcer.announce(`Doação salva com ID ${donation.id.slice(0, 8)}. Sincronizará ao conectar.`);
      this.showSuccess('Doação registrada offline!');
    } catch (error) {
      console.error('[DonationEntry] Erro ao salvar:', error);
      this.showError(error instanceof Error ? error.message : 'Erro ao salvar doação');
    }
  }

  canGenerateTasks(): boolean {
    return this.auth.isNutritionist();
  }

  approveAndGenerateTasks(): void {
    // TODO: Navegar para sugestão de preparo
    this.showSuccess('Funcionalidade de gerar tasks será implementada na RF03');
  }

  startNewDonation(): void {
    this.resetState();
    this.currentStep.set(0);
  }

  private resetState(): void {
    this.selectedImage.set(null);
    this.ocrResult.set(null);
    this.ocrError.set(false);
    this.ocrConfidence.set(0);
    this.ocrLoading.set(false);
    this.savedDonationId.set('');
    this.captureForm.reset();
    this.confirmForm.reset({
      unit: 'kg',
      expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  }

  private showSuccess(msg: string): void {
    this.snackBar.open(msg, 'OK', { duration: 3000, panelClass: 'success-snackbar' });
  }

  private showError(msg: string): void {
    this.snackBar.open(msg, 'OK', { duration: 5000, panelClass: 'error-snackbar' });
  }
}

type ItemCategory = 'hortifruti' | 'proteina' | 'grao' | 'laticinio' | 'panificado' | 'outro';