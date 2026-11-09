import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, RouterLink],
  template: `
    <div class="unauthorized-container">
      <mat-icon class="unauthorized-icon">lock</mat-icon>
      <h1>Acesso não autorizado</h1>
      <p>Você não tem permissão para acessar esta página.</p>
      <p class="role-info">Seu papel: <strong>{{ roleLabel() }}</strong></p>

      <div class="actions">
        <button mat-flat-button color="primary" routerLink="/">
          <mat-icon>home</mat-icon>
          <span>Voltar ao início</span>
        </button>
        <button mat-stroked-button (click)="signOut()">
          <mat-icon>logout</mat-icon>
          <span>Trocar de usuário</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .unauthorized-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      padding: 24px;
      text-align: center;
    }

    .unauthorized-icon {
      font-size: 72px;
      width: 72px;
      height: 72px;
      color: #f44336;
      margin-bottom: 16px;
    }

    h1 {
      color: #c62828;
      margin: 0 0 8px;
    }

    p {
      color: #666;
      margin: 0 0 16px;
    }

    .role-info {
      color: #1976d2;
      font-size: 0.9rem;
      margin-bottom: 24px;
    }

    .actions {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .actions button {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 48px;
    }
  `],
})
export class UnauthorizedComponent {
  private auth = inject(AuthService);

  roleLabel = () => {
    const r = this.auth.role();
    return r === 'nutritionist' ? 'Nutricionista' : r === 'volunteer' ? 'Voluntário' : r === 'manager' ? 'Gestor' : 'Não identificado';
  };

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}