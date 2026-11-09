import { Injectable, inject } from '@angular/core';
import { DexieService } from '../storage/dexie.db';
import { Item, ItemCategory } from '../../shared/models';

export interface CriticalItem extends Item {
  urgency: 'critical' | 'warning' | 'ok'; // vermelho ≤1 dia, amarelo 2-3, verde >3
  daysUntilExpiration: number;
}

@Injectable({ providedIn: 'root' })
export class StockService {
  private dexie = inject(DexieService);

  /**
   * Obtém itens críticos classificados por urgência.
   * Usa índice composto expiration_date+status para performance ≤500ms.
   */
  async getCriticalItems(daysAhead = 3): Promise<CriticalItem[]> {
    const items = await this.dexie.getCriticalItems(daysAhead);
    return items.map((item) => this.classifyUrgency(item)).sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
  }

  /**
   * Obtém itens por categoria para o painel.
   */
  async getItemsByCategory(category: ItemCategory): Promise<Item[]> {
    const allItems = await this.dexie.getItemsByStatus('recebido');
    return allItems.filter((item) => item.category === category);
  }

  /**
   * Classifica urgência baseada na data de validade.
   */
  private classifyUrgency(item: Item): CriticalItem {
    const expDate = new Date(item.expiration_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    const daysUntilExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let urgency: CriticalItem['urgency'] = 'ok';
    if (daysUntilExpiration <= 1) urgency = 'critical';
    else if (daysUntilExpiration <= 3) urgency = 'warning';

    return { ...item, urgency, daysUntilExpiration };
  }

  /**
   * Estatísticas rápidas para badges no dashboard.
   */
  async getCriticalStats(): Promise<{ critical: number; warning: number; ok: number }> {
    const items = await this.getCriticalItems(30); // 30 dias para stats gerais
    return {
      critical: items.filter((i) => i.urgency === 'critical').length,
      warning: items.filter((i) => i.urgency === 'warning').length,
      ok: items.filter((i) => i.urgency === 'ok').length,
    };
  }
}