export interface Donor {
  id: string;
  name: string;
  type: 'supermercado' | 'restaurante' | 'horta_urbana' | 'outro';
  contact_phone?: string;
  contact_email?: string;
  is_active: boolean;
  created_at: string;
}

export interface DonorCreateInput {
  name: string;
  type: 'supermercado' | 'restaurante' | 'horta_urbana' | 'outro';
  contact_phone?: string;
  contact_email?: string;
}