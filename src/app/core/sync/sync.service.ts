import { Injectable, inject } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { DexieService, SyncQueueItem } from '../storage/dexie.db';
import { Donation, Item, Task, Recipe, Donor } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private supabase: SupabaseClient;
  private dexie = inject(DexieService);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  /**
   * Processa a fila de sincronização pendente.
   * Deve ser chamado quando a conectividade for restaurada.
   */
  async processQueue(): Promise<{ synced: number; failed: number }> {
    if (!this.dexie.isOnline()) {
      return { synced: 0, failed: 0 };
    }

    const queue = await this.dexie.getSyncQueue(50);
    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        await this.syncItem(item);
        await this.dexie.removeSyncQueueItem(item.id!);
        synced++;
      } catch (error) {
        await this.dexie.updateSyncQueueItem(item.id!, {
          retries: item.retries + 1,
          last_error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
        failed++;
      }
    }

    return { synced, failed };
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const { entity_type, entity_id, operation, payload } = item;

    switch (entity_type) {
      case 'donation':
        await this.syncDonation(entity_id, operation, payload as Donation);
        break;
      case 'item':
        await this.syncItemEntity(entity_id, operation, payload as Item);
        break;
      case 'task':
        await this.syncTask(entity_id, operation, payload as Task);
        break;
      case 'recipe':
        await this.syncRecipe(entity_id, operation, payload as Recipe);
        break;
      case 'donor':
        await this.syncDonor(entity_id, operation, payload as Donor);
        break;
    }
  }

  private async syncDonation(id: string, operation: string, payload: Donation): Promise<void> {
    if (operation === 'create') {
      const { error } = await this.supabase.from('donation').insert(payload);
      if (error) throw error;
      // Atualiza status local para 'synced'
      await this.dexie.updateDonation(id, { status: 'synced' });
    } else if (operation === 'update') {
      const { error } = await this.supabase.from('donation').update(payload).eq('id', id);
      if (error) throw error;
    }
  }

  private async syncItemEntity(id: string, operation: string, payload: Item): Promise<void> {
    if (operation === 'create') {
      const { error } = await this.supabase.from('item').insert(payload);
      if (error) throw error;
    } else if (operation === 'update') {
      const { error } = await this.supabase.from('item').update(payload).eq('id', id);
      if (error) throw error;
    }
  }

  private async syncTask(id: string, operation: string, payload: Task): Promise<void> {
    if (operation === 'create') {
      const { error } = await this.supabase.from('task').insert(payload);
      if (error) throw error;
    } else if (operation === 'update') {
      const { error } = await this.supabase.from('task').update(payload).eq('id', id);
      if (error) throw error;
    }
  }

  private async syncRecipe(id: string, operation: string, payload: Recipe): Promise<void> {
    if (operation === 'create') {
      const { error } = await this.supabase.from('recipe').insert(payload);
      if (error) throw error;
    } else if (operation === 'update') {
      const { error } = await this.supabase.from('recipe').update(payload).eq('id', id);
      if (error) throw error;
    }
  }

  private async syncDonor(id: string, operation: string, payload: Donor): Promise<void> {
    if (operation === 'create') {
      const { error } = await this.supabase.from('donor').insert(payload);
      if (error) throw error;
    } else if (operation === 'update') {
      const { error } = await this.supabase.from('donor').update(payload).eq('id', id);
      if (error) throw error;
    }
  }

  /**
   * Baixa dados do servidor para o cache local (inicialização / pull-to-refresh).
   */
  async pullFromServer(): Promise<void> {
    if (!this.dexie.isOnline()) return;

    // Baixa doadores ativos
    const { data: donors } = await this.supabase.from('donor').select('*').eq('is_active', true);
    if (donors) {
      for (const donor of donors) {
        await this.dexie.addDonor(donor);
      }
    }

    // Baixa receitas ativas
    const { data: recipes } = await this.supabase.from('recipe').select('*').eq('is_active', true);
    if (recipes) {
      for (const recipe of recipes) {
        await this.dexie.addRecipe(recipe);
      }
    }

    // Baixa itens recentes (últimos 30 dias) para o painel crítico
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const { data: items } = await this.supabase
      .from('item')
      .select('*')
      .gte('created_at', cutoff.toISOString())
      .in('status', ['recebido', 'preparando']);
    if (items) {
      for (const item of items) {
        await this.dexie.addItem(item);
      }
    }
  }
}