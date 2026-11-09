import { Injectable, inject } from '@angular/core';
import { DexieService, SyncQueueItem } from '../storage/dexie.db';
import { Donation, Item, Task, Recipe, Donor } from '../../shared/models';
import { v4 as uuidv4 } from 'uuid';

@Injectable({ providedIn: 'root' })
export class SyncQueueService {
  private dexie = inject(DexieService);

  /**
   * Enfileira uma criação para sincronização posterior.
   */
  async enqueueCreate(entityType: SyncQueueItem['entity_type'], entity: Donation | Item | Task | Recipe | Donor): Promise<void> {
    await this.dexie.enqueueSync({
      entity_type: entityType,
      entity_id: entity.id,
      operation: 'create',
      payload: entity,
    });
  }

  /**
   * Enfileira uma atualização para sincronização posterior.
   */
  async enqueueUpdate(entityType: SyncQueueItem['entity_type'], entityId: string, changes: Partial<Donation | Item | Task | Recipe | Donor>): Promise<void> {
    await this.dexie.enqueueSync({
      entity_type: entityType,
      entity_id: entityId,
      operation: 'update',
      payload: changes,
    });
  }

  /**
   * Enfileira uma exclusão para sincronização posterior.
   */
  async enqueueDelete(entityType: SyncQueueItem['entity_type'], entityId: string): Promise<void> {
    await this.dexie.enqueueSync({
      entity_type: entityType,
      entity_id: entityId,
      operation: 'delete',
      payload: { id: entityId },
    });
  }

  /**
   * Gera UUID v4 para novas entidades.
   */
  generateId(): string {
    return uuidv4();
  }
}