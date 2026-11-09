export interface Donation {
  id: string;
  donor_id: string;
  received_at: string;
  received_by: string;
  vehicle_plate?: string;
  notes?: string;
  status: 'draft' | 'synced' | 'confirmed';
  created_at: string;
  updated_at: string;
}

export interface DonationCreateInput {
  donor_id: string;
  received_at: string;
  received_by: string;
  vehicle_plate?: string;
  notes?: string;
}