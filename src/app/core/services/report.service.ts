import { Injectable, inject } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Report, ReportGenerateInput, ReportMetrics, WasteReason } from '../../shared/models';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private supabase: SupabaseClient;
  private auth = inject(AuthService);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  /**
   * Gera relatório via Edge Function (serverless).
   * Retorna signed URL para download (expira em 15 min).
   */
  async generateReport(input: ReportGenerateInput): Promise<{ pdfUrl?: string; csvUrl?: string }> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new Error('Não autenticado');

    const { data, error } = await this.supabase.functions.invoke('generate-report', {
      body: input,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Calcula métricas localmente (para preview offline).
   */
  async calculateMetrics(periodStart: string, periodEnd: string): Promise<ReportMetrics> {
    const { data: donations, error } = await this.supabase
      .from('donation')
      .select('id, created_at')
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    if (error) throw error;

    const donationIds = donations?.map((d) => d.id) ?? [];

    const { data: items, error: itemsError } = await this.supabase
      .from('item')
      .select('quantity_kg, status, waste_reason')
      .in('donation_id', donationIds);

    if (itemsError) throw itemsError;

    const kgReceived = items?.reduce((sum, i) => sum + Number(i.quantity_kg), 0) ?? 0;
    const kgUsed = items?.filter((i) => i.status === 'servido').reduce((sum, i) => sum + Number(i.quantity_kg), 0) ?? 0;
    const kgWasted = items?.filter((i) => i.status === 'desperdicado').reduce((sum, i) => sum + Number(i.quantity_kg), 0) ?? 0;

    const wasteByReason: Record<WasteReason, number> = {
      validade_vencida: 0,
      qualidade_ruim: 0,
      excedente: 0,
      contaminacao: 0,
      outro: 0,
    };

    items?.filter((i) => i.status === 'desperdicado').forEach((i) => {
      if (i.waste_reason && i.waste_reason in wasteByReason) {
        wasteByReason[i.waste_reason as WasteReason]++;
      }
    });

    const topWasteReasons = Object.entries(wasteByReason)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([reason, count]) => ({ reason: reason as WasteReason, count }));

    return {
      kg_received: kgReceived,
      kg_used: kgUsed,
      kg_wasted: kgWasted,
      waste_percentage: kgReceived > 0 ? (kgWasted / kgReceived) * 100 : 0,
      meals_served: Math.floor(kgUsed / 0.4), // ~400g por refeição
      top_waste_reasons: topWasteReasons,
    };
  }
}