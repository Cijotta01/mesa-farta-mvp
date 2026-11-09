import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseClient, createClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { UserProfile, UserRole, AuthUser } from '../../shared/models';
import { DexieService } from '../storage/dexie.db';

export type { UserRole };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase: SupabaseClient;
  private router = inject(Router);
  private dexie = inject(DexieService);

  // Signals para estado reativo
  private _user = signal<User | null>(null);
  private _session = signal<Session | null>(null);
  private _profile = signal<UserProfile | null>(null);
  private _loading = signal(true);

  // Computed públicos
  user = this._user.asReadonly();
  session = this._session.asReadonly();
  profile = this._profile.asReadonly();
  loading = this._loading.asReadonly();
  isAuthenticated = computed(() => !!this._session());
  role = computed(() => this._profile()?.role ?? null);
  isNutritionist = computed(() => this.role() === 'nutritionist');
  isVolunteer = computed(() => this.role() === 'volunteer');
  isManager = computed(() => this.role() === 'manager');

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    this.initAuth();
  }

  private async initAuth(): Promise<void> {
    // Recupera sessão salva
    const { data: { session } } = await this.supabase.auth.getSession();
    this._session.set(session);
    this._user.set(session?.user ?? null);

    if (session?.user) {
      await this.loadProfile(session.user.id);
    }

    // Escuta mudanças de autenticação
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      this._session.set(session);
      this._user.set(session?.user ?? null);

      if (session?.user) {
        await this.loadProfile(session.user.id);
      } else {
        this._profile.set(null);
        await this.dexie.clearUserProfile();
      }

      this._loading.set(false);
    });

    this._loading.set(false);
  }

  private async loadProfile(userId: string): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('user_profile')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      const profile: UserProfile = {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        avatar_url: data.avatar_url,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      this._profile.set(profile);
      await this.dexie.setUserProfile({ ...profile, id: 'current' });
    } catch (error) {
      console.error('[Auth] Erro ao carregar perfil:', error);
    }
  }

  /**
   * Envia Magic Link para o e-mail informado.
   * Não armazena senhas — autenticação exclusivamente via link mágico.
   */
  async sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false, // Usuários devem ser criados pelo admin/gestor
      },
    });

    if (error) {
      return { success: false, error: this.mapAuthError(error.message) };
    }
    return { success: true };
  }

  /**
   * Faz logout e limpa dados locais.
   */
  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this._user.set(null);
    this._session.set(null);
    this._profile.set(null);
    await this.dexie.clearUserProfile();
    await this.router.navigate(['/']);
  }

  /**
   * Obtém o access token atual para chamadas autenticadas.
   */
  async getAccessToken(): Promise<string | null> {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  private mapAuthError(message: string): string {
    const errorMap: Record<string, string> = {
      'Invalid login credentials': 'E-mail não cadastrado ou inválido',
      'Email not confirmed': 'E-mail não confirmado. Verifique sua caixa de entrada.',
      'Too many requests': 'Muitas tentativas. Aguarde alguns minutos.',
      'User not found': 'Usuário não encontrado. Contate o gestor.',
    };
    return errorMap[message] ?? 'Erro ao enviar link mágico. Tente novamente.';
  }
}