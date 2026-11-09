export interface Task {
  id: string;
  item_id: string;
  volunteer_id?: string;
  description: string;
  sequence: number;
  status: 'pendente' | 'concluida';
  completed_at?: string;
  created_at: string;
}

export interface TaskCreateInput {
  item_id: string;
  volunteer_id?: string;
  description: string;
  sequence: number;
}

export interface TaskUpdateInput {
  status?: 'pendente' | 'concluida';
  volunteer_id?: string;
  completed_at?: string;
}