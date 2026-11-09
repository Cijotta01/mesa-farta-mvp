export interface Item {
  id: string;
  donation_id: string;
  product_name: string;
  category: ItemCategory;
  quantity_kg: number;
  unit: 'kg' | 'un' | 'l';
  expiration_date: string;
  lot_code?: string;
  barcode?: string;
  nutri_score?: NutriScore;
  status: ItemStatus;
  prepped_by?: string;
  prepped_at?: string;
  served_at?: string;
  wasted_at?: string;
  waste_reason?: WasteReason;
  created_at: string;
  updated_at: string;
}

export type ItemCategory =
  | 'hortifruti'
  | 'proteina'
  | 'grao'
  | 'laticinio'
  | 'panificado'
  | 'outro';

export type ItemStatus =
  | 'recebido'
  | 'preparando'
  | 'cozido'
  | 'servido'
  | 'desperdicado';

export type WasteReason =
  | 'validade_vencida'
  | 'qualidade_ruim'
  | 'excedente'
  | 'contaminacao'
  | 'outro';

export interface NutriScore {
  energy_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
}

export interface ItemCreateInput {
  donation_id: string;
  product_name: string;
  category: ItemCategory;
  quantity_kg: number;
  unit: 'kg' | 'un' | 'l';
  expiration_date: string;
  lot_code?: string;
  barcode?: string;
  nutri_score?: NutriScore;
}