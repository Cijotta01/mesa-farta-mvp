import { Injectable, inject } from '@angular/core';
import { DexieService } from '../storage/dexie.db';
import { SyncQueueService } from '../sync/sync-queue.service';
import { Donation, DonationCreateInput, Item, ItemCreateInput } from '../../shared/models';
import { validateSchema, donationCreateSchema, itemCreateSchema } from '../../shared/validators/schemas';
import { z } from 'zod';

interface ZodIssue {
  message: string;
  path: (string | number)[];
}

@Injectable({ providedIn: 'root' })
export class DonationService {
  private dexie = inject(DexieService);
  private syncQueue = inject(SyncQueueService);

  /**
   * Cria uma nova doação com itens (offline-first).
   * Valida com Zod, salva no IndexedDB, enfileira para sync.
   */
  async createDonationWithItems(input: DonationCreateInput, items: ItemCreateInput[]): Promise<{ donation: Donation; items: Item[] }> {
    // Valida doação
    const donationValidation = validateSchema(donationCreateSchema, input);
    if (!donationValidation.success) {
      const zodError = donationValidation.errors as z.ZodError<unknown>;
      const messages = (zodError.issues as ZodIssue[]).map((e: ZodIssue) => e.message).join(', ');
      throw new Error(`Doação inválida: ${messages}`);
    }

    // Valida itens
    for (const item of items) {
      const itemValidation = validateSchema(itemCreateSchema, item);
      if (!itemValidation.success) {
        const zodError = itemValidation.errors as z.ZodError<unknown>;
        const messages = (zodError.issues as ZodIssue[]).map((e: ZodIssue) => e.message).join(', ');
        throw new Error(`Item inválido: ${messages}`);
      }
    }

    const donationId = this.syncQueue.generateId();
    const now = new Date().toISOString();

    const donation: Donation = {
      id: donationId,
      ...input,
      status: 'draft',
      created_at: now,
      updated_at: now,
    };

    const createdItems: Item[] = items.map((itemInput) => ({
      id: this.syncQueue.generateId(),
      ...itemInput,
      donation_id: donationId,
      status: 'recebido' as const,
      created_at: now,
      updated_at: now,
    }));

    // Salva localmente (offline-first)
    await this.dexie.addDonation(donation);
    for (const item of createdItems) {
      await this.dexie.addItem(item);
    }

    // Enfileira para sincronização
    await this.syncQueue.enqueueCreate('donation', donation);
    for (const item of createdItems) {
      await this.syncQueue.enqueueCreate('item', item);
    }

    return { donation, items: createdItems };
  }

  async getDonation(id: string): Promise<Donation | undefined> {
    return this.dexie.getDonation(id);
  }

  async getDraftDonations(): Promise<Donation[]> {
    return this.dexie.getDonationsByStatus('draft');
  }

  async confirmDonation(id: string): Promise<void> {
    await this.dexie.updateDonation(id, { status: 'confirmed', updated_at: new Date().toISOString() });
    const donation = await this.dexie.getDonation(id);
    if (donation) {
      await this.syncQueue.enqueueUpdate('donation', id, { status: 'confirmed' });
    }
  }
}