import { Component, inject, signal, computed } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { LiveAnnouncer } from '@angular/cdk/a11y';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login-form" novalidate>
      <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
        <mat-label>E-mail institucional</mat-label>
        <input
          matInput
          type="email"
          formControlName="email"
          autocomplete="email"
          aria-describedby="email-hint"
          [attr.aria-invalid]="email.invalid && (email.dirty || email.touched)"
        />
        <mat-icon matPrefix>email</mat-icon>
        <mat-hint id="email-hint">Enviaremos um link mágico para este e-mail</mat-hint>
        @if (email.invalid && (email.dirty || email.touched)) {
          <mat-error>
            @if (email.hasError('required')) { E-mail é obrigatório }
            @else if (email.hasError('email')) { Formato de e-mail inválido }
          </mat-error>
        }
      </mat-form-field>

      <button
        mat-flat-button
        color="primary"
        type="submit"
        class="submit-btn full-width"
        [disabled]="form.invalid || loading()"
        style="min-height: 48px; margin-top: 16px;"
      >
        @if (loading()) {
          <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
          <span>Enviando...</span>
        } @else {
          <mat-icon>send</mat-icon>
          <span>Enviar link mágico</span>
        }
      </button>

      <p class="login-note" aria-live="polite" role="status">
        <mat-icon>info</mat-icon>
        <span>Se o e-mail existir no sistema, enviaremos o link de acesso. Nenhuma senha é necessária.</span>
      </p>

      @if (sent()) {
        <div class="success-message" role="alert" aria-live="assertive">
          <mat-icon>check_circle</mat-icon>
          <span>Link enviado! Verifique sua caixa de entrada (incluindo spam).</span>
        </div>
      }
    </form>
  `,
  styles: [`
    .login-form {
      width: 100%;
      max-width: 360px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .full-width {
      width: 100%;
    }

    .submit-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 1rem;
      font-weight: 600;
    }

    .btn-spinner {
      margin-right: 4px;
    }

    .login-note {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 0.8rem;
      color: #666;
      margin-top: 8px;
      text-align: left;
    }

    .login-note mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin-top: 2px;
      color: #1976d2;
      flex-shrink: 0;
    }

    .success-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #e8f5e9;
      color: #2e7d32;
      border-radius: 8px;
      margin-top: 16px;
      font-weight: 500;
    }

    .success-message mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    @media (max-width: 480px) {
      .login-form {
        max-width: 100%;
      }
    }
  `],
})
export class LoginFormComponent {
  private auth = inject(AuthService);
  private announcer = inject(LiveAnnouncer);

  loading = signal(false);
  sent = signal(false);

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  get email() {
    return this.form.get('email')!;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.sent.set(false);

    const { success, error } = await this.auth.sendMagicLink(this.email.value!);

    this.loading.set(false);

    if (success) {
      this.sent.set(true);
      this.announcer.announce('Link mágico enviado. Verifique seu e-mail.');
      this.form.reset();
    } else {
      this.announcer.announce(`Erro: ${error}`);
      this.email.setErrors({ serverError: error });
    }
  }
}