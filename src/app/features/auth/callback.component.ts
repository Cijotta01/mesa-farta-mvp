import { Component, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { LiveAnnouncer } from '@angular/cdk/a11y';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule],
  template: `
    <div class="callback-container">
      <mat-spinner diameter="48"></mat-spinner>
      <h2>Processando login...</h2>
      <p>Por favor, aguarde enquanto validamos seu acesso.</p>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      text-align: center;
      padding: 24px;
    }

    h2 {
      margin: 16px 0 8px;
      color: #333;
    }

    p {
      color: #666;
      margin: 0;
    }
  `],
})
export class AuthCallbackComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private announcer = inject(LiveAnnouncer);

  async ngOnInit(): Promise<void> {
    // O AuthService já processa a troca de código por sessão via onAuthStateChange
    // Aguardamos a inicialização completar
    while (this.auth.loading()) {
      await new Promise((r) => setTimeout(r, 100));
    }

    if (this.auth.isAuthenticated()) {
      this.announcer.announce('Login realizado com sucesso. Redirecionando...');
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
      await this.router.navigateByUrl(returnUrl);
    } else {
      this.announcer.announce('Falha no login. Redirecionando para página inicial.');
      await this.router.navigate(['/'], { queryParams: { error: 'auth_failed' } });
    }
  }
}