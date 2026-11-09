import { ItemCategory } from './item';

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  nutri_targets: NutriTargets;
  servings_per_batch: number;
  prep_time_min: number;
  is_active: boolean;
  created_at: string;
}

export interface RecipeIngredient {
  category: ItemCategory;
  quantity_kg: number;
  unit: 'kg' | 'un' | 'l';
  is_optional: boolean;
}

export interface NutriTargets {
  energy_kcal_min: number;
  energy_kcal_max: number;
  protein_g_min: number;
  carbs_g_min: number;
  fat_g_max: number;
  fiber_g_min: number;
  sodium_mg_max: number;
}

export interface RecipeCreateInput {
  name: string;
  ingredients: RecipeIngredient[];
  nutri_targets: NutriTargets;
  servings_per_batch: number;
  prep_time_min: number;
}