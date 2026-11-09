export interface Report {
  id: string;
  period_start: string;
  period_end: string;
  generated_by: string;
  generated_at: string;
  pdf_url?: string;
  csv_url?: string;
  metrics: ReportMetrics;
}

export interface ReportMetrics {
  kg_received: number;
  kg_used: number;
  kg_wasted: number;
  waste_percentage: number;
  meals_served: number;
  top_waste_reasons: { reason: WasteReason; count: number }[];
}

export type WasteReason =
  | 'validade_vencida'
  | 'qualidade_ruim'
  | 'excedente'
  | 'contaminacao'
  | 'outro';

export interface ReportGenerateInput {
  period_start: string;
  period_end: string;
  format: 'pdf' | 'csv';
}