import { Injectable } from '@angular/core';
import { Dexie } from 'dexie';
import { Donation, Item, Task, Recipe, Donor, UserProfile } from '../../shared/models';

/**
 * Dexie Database para persistência offline (IndexedDB).
 * Armazena: Doações, Itens, Tasks, Receitas, Doadores, Perfil de usuário, Fila de sincronização.
 */
export class MesaFartaDB extends Dexie {
  donations!: Dexie.Table<Donation, string>;
  items!: Dexie.Table<Item, string>;
  tasks!: Dexie.Table<Task, string>;
  recipes!: Dexie.Table<Recipe, string>;
  donors!: Dexie.Table<Donor, string>;
  userProfile!: Dexie.Table<UserProfile, string>;
  syncQueue!: Dexie.Table<SyncQueueItem, number>;

  constructor() {
    super('MesaFartaDB');
    this.version(1).stores({
      donations: 'id, donor_id, received_at, status, created_at',
      items: 'id, donation_id, expiration_date, status, category, created_at, [expiration_date+status]',
      tasks: 'id, item_id, volunteer_id, status, sequence, created_at',
      recipes: 'id, name, is_active, created_at',
      donors: 'id, name, type, is_active, created_at',
      userProfile: 'id, email, role, created_at',
      syncQueue: '++id, entity_type, entity_id, operation, created_at, retries',
    });

    // Índices compostos para queries críticas
    this.items.hook('creating', (primKey, obj, trans) => {
      // Garante updated_at na criação
      if (!obj.updated_at) obj.updated_at = new Date().toISOString();
    });
  }
}

export interface SyncQueueItem {
  id?: number;
  entity_type: 'donation' | 'item' | 'task' | 'recipe' | 'donor';
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  created_at: string;
  retries: number;
  last_error?: string;
}

@Injectable({ providedIn: 'root' })
export class DexieService {
  db = new MesaFartaDB();

  constructor() {
    // Abre a conexão
    this.db.open().catch((err) => {
      console.error('[Dexie] Falha ao abrir IndexedDB:', err);
    });
  }

  // --- Donations ---
  async addDonation(donation: Donation): Promise<string> {
    return this.db.donations.add(donation);
  }

  async getDonation(id: string): Promise<Donation | undefined> {
    return this.db.donations.get(id);
  }

  async getDonationsByStatus(status: Donation['status']): Promise<Donation[]> {
    return this.db.donations.where('status').equals(status).toArray();
  }

  async updateDonation(id: string, changes: Partial<Donation>): Promise<number> {
    return this.db.donations.update(id, { ...changes, updated_at: new Date().toISOString() });
  }

  // --- Items ---
  async addItem(item: Item): Promise<string> {
    return this.db.items.add(item);
  }

  async getItem(id: string): Promise<Item | undefined> {
    return this.db.items.get(id);
  }

  async getItemsByDonation(donationId: string): Promise<Item[]> {
    return this.db.items.where('donation_id').equals(donationId).toArray();
  }

  async getCriticalItems(daysAhead = 3): Promise<Item[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return this.db.items
      .where('expiration_date')
      .belowOrEqual(cutoffStr)
      .and((item: Item) => item.status === 'recebido' || item.status === 'preparando')
      .toArray();
  }

  async getItemsByStatus(status: Item['status']): Promise<Item[]> {
    return this.db.items.where('status').equals(status).toArray();
  }

  async updateItem(id: string, changes: Partial<Item>): Promise<number> {
    return this.db.items.update(id, { ...changes, updated_at: new Date().toISOString() });
  }

  // --- Tasks ---
  async addTask(task: Task): Promise<string> {
    return this.db.tasks.add(task);
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.db.tasks.get(id);
  }

  async getTasksByVolunteer(volunteerId: string): Promise<Task[]> {
    return this.db.tasks.where('volunteer_id').equals(volunteerId).toArray();
  }

  async getTasksByItem(itemId: string): Promise<Task[]> {
    return this.db.tasks.where('item_id').equals(itemId).toArray();
  }

  async getPendingTasks(volunteerId?: string): Promise<Task[]> {
    let query = this.db.tasks.where('status').equals('pendente');
    if (volunteerId) {
      query = query.and((task) => !task.volunteer_id || task.volunteer_id === volunteerId);
    }
    return query.sortBy('sequence');
  }

  async updateTask(id: string, changes: Partial<Task>): Promise<number> {
    const update: Partial<Task> = { ...changes };
    if (changes.status === 'concluida' && !changes.completed_at) {
      update.completed_at = new Date().toISOString();
    }
    return this.db.tasks.update(id, update);
  }

  // --- Recipes ---
  async addRecipe(recipe: Recipe): Promise<string> {
    return this.db.recipes.add(recipe);
  }

  async getActiveRecipes(): Promise<Recipe[]> {
    return this.db.recipes.where('is_active').equals(true as unknown as never).toArray();
  }

  async getRecipe(id: string): Promise<Recipe | undefined> {
    return this.db.recipes.get(id);
  }

  // --- Donors ---
  async addDonor(donor: Donor): Promise<string> {
    return this.db.donors.add(donor);
  }

  async getDonor(id: string): Promise<Donor | undefined> {
    return this.db.donors.get(id);
  }

  async getActiveDonors(): Promise<Donor[]> {
    return this.db.donors.where('is_active').equals(true as unknown as never).toArray();
  }

  // --- User Profile ---
  async setUserProfile(profile: UserProfile): Promise<string> {
    return this.db.userProfile.put(profile);
  }

  async getUserProfile(): Promise<UserProfile | undefined> {
    return this.db.userProfile.get('current');
  }

  async clearUserProfile(): Promise<void> {
    await this.db.userProfile.clear();
  }

  // --- Sync Queue ---
  async enqueueSync(item: Omit<SyncQueueItem, 'id' | 'created_at' | 'retries'>): Promise<number> {
    return this.db.syncQueue.add({
      ...item,
      created_at: new Date().toISOString(),
      retries: 0,
    });
  }

  async getSyncQueue(limit = 100): Promise<SyncQueueItem[]> {
    return this.db.syncQueue.orderBy('created_at').limit(limit).toArray();
  }

  async updateSyncQueueItem(id: number, changes: Partial<SyncQueueItem>): Promise<number> {
    return this.db.syncQueue.update(id, changes);
  }

  async removeSyncQueueItem(id: number): Promise<void> {
    return this.db.syncQueue.delete(id);
  }

  async clearSyncedQueue(): Promise<number> {
    return this.db.syncQueue.where('retries').above(5).delete(); // Remove itens com muitas tentativas
  }

  // --- Utility ---
  async clearAllData(): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      for (const table of this.db.tables) {
        await table.clear();
      }
    });
  }

  isOnline(): boolean {
    return navigator.onLine;
  }
}