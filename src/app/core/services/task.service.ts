import { Injectable, inject } from '@angular/core';
import { DexieService } from '../storage/dexie.db';
import { SyncQueueService } from '../sync/sync-queue.service';
import { Task, TaskCreateInput, TaskUpdateInput } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private dexie = inject(DexieService);
  private syncQueue = inject(SyncQueueService);

  /**
   * Cria tasks a partir de uma sugestão de preparo aprovada.
   */
  async createTasksFromSuggestion(itemId: string, tasks: Omit<TaskCreateInput, 'item_id'>[]): Promise<Task[]> {
    const now = new Date().toISOString();
    const created: Task[] = [];

    for (const taskInput of tasks) {
      const task: Task = {
        id: this.syncQueue.generateId(),
        item_id: itemId,
        ...taskInput,
        status: 'pendente',
        created_at: now,
      };

      await this.dexie.addTask(task);
      await this.syncQueue.enqueueCreate('task', task);
      created.push(task);
    }

    return created;
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.dexie.getTask(id);
  }

  async getPendingTasks(volunteerId?: string): Promise<Task[]> {
    return this.dexie.getPendingTasks(volunteerId);
  }

  async getTasksByVolunteer(volunteerId: string): Promise<Task[]> {
    return this.dexie.getTasksByVolunteer(volunteerId);
  }

  async getTasksByItem(itemId: string): Promise<Task[]> {
    return this.dexie.getTasksByItem(itemId);
  }

  /**
   * Marca task como concluída (offline-first).
   */
  async completeTask(taskId: string, volunteerId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.dexie.updateTask(taskId, {
      status: 'concluida',
      volunteer_id: volunteerId,
      completed_at: now,
    });
    await this.syncQueue.enqueueUpdate('task', taskId, {
      status: 'concluida',
      volunteer_id: volunteerId,
      completed_at: now,
    });
  }

  /**
   * Auto-atribui task ao voluntário logado.
   */
  async claimTask(taskId: string, volunteerId: string): Promise<void> {
    await this.dexie.updateTask(taskId, { volunteer_id: volunteerId });
    await this.syncQueue.enqueueUpdate('task', taskId, { volunteer_id: volunteerId });
  }

  /**
   * Atualiza uma task genericamente.
   */
  async updateTask(taskId: string, changes: Partial<Task>): Promise<void> {
    await this.dexie.updateTask(taskId, changes);
    await this.syncQueue.enqueueUpdate('task', taskId, changes);
  }
}