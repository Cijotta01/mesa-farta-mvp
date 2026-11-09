export type UserRole = 'nutritionist' | 'volunteer' | 'manager';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  access_token: string;
  refresh_token: string;
}