import { z } from 'zod';

/**
 * Esquemas Zod compartilhados entre cliente e servidor (Edge Functions).
 * Garante validação idêntica offline e online.
 */

// --- Donation ---
export const donationCreateSchema = z.object({
  donor_id: z.string().uuid('Doador inválido'),
  received_at: z.string().datetime({ offset: true }),
  received_by: z.string().uuid('Usuário inválido'),
  vehicle_plate: z.string().max(10).optional(),
  notes: z.string().max(500).optional(),
});

export const donationUpdateSchema = donationCreateSchema.partial();

export type DonationCreateInput = z.infer<typeof donationCreateSchema>;
export type DonationUpdateInput = z.infer<typeof donationUpdateSchema>;

// --- Item ---
export const itemCategorySchema = z.enum([
  'hortifruti',
  'proteina',
  'grao',
  'laticinio',
  'panificado',
  'outro',
]);

export const itemUnitSchema = z.enum(['kg', 'un', 'l']);

export const itemStatusSchema = z.enum([
  'recebido',
  'preparando',
  'cozido',
  'servido',
  'desperdicado',
]);

export const wasteReasonSchema = z.enum([
  'validade_vencida',
  'qualidade_ruim',
  'excedente',
  'contaminacao',
  'outro',
]);

export const nutriScoreSchema = z.object({
  energy_kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  fiber_g: z.number().nonnegative(),
  sodium_mg: z.number().nonnegative(),
});

export const itemCreateSchema = z.object({
  donation_id: z.string().uuid('Doação inválida'),
  product_name: z.string().min(1, 'Nome do produto obrigatório').max(100),
  category: itemCategorySchema,
  quantity_kg: z.number().positive('Quantidade deve ser positiva'),
  unit: itemUnitSchema,
  expiration_date: z.string().date('Data de validade inválida (YYYY-MM-DD)'),
  lot_code: z.string().max(50).optional(),
  barcode: z.string().max(20).optional(),
  nutri_score: nutriScoreSchema.optional(),
});

export const itemUpdateSchema = itemCreateSchema.partial().extend({
  status: itemStatusSchema.optional(),
  prepped_by: z.string().uuid().optional(),
  prepped_at: z.string().datetime({ offset: true }).optional(),
  served_at: z.string().datetime({ offset: true }).optional(),
  wasted_at: z.string().datetime({ offset: true }).optional(),
  waste_reason: wasteReasonSchema.optional(),
});

export type ItemCreateInput = z.infer<typeof itemCreateSchema>;
export type ItemUpdateInput = z.infer<typeof itemUpdateSchema>;

// --- Task ---
export const taskCreateSchema = z.object({
  item_id: z.string().uuid('Item inválido'),
  volunteer_id: z.string().uuid().optional(),
  description: z.string().min(1, 'Descrição obrigatória').max(200),
  sequence: z.number().int().positive(),
});

export const taskUpdateSchema = z.object({
  status: z.enum(['pendente', 'concluida']).optional(),
  volunteer_id: z.string().uuid().optional(),
  completed_at: z.string().datetime({ offset: true }).optional(),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

// --- Recipe ---
export const recipeIngredientSchema = z.object({
  category: itemCategorySchema,
  quantity_kg: z.number().positive(),
  unit: itemUnitSchema,
  is_optional: z.boolean().default(false),
});

export const nutriTargetsSchema = z.object({
  energy_kcal_min: z.number().nonnegative(),
  energy_kcal_max: z.number().nonnegative(),
  protein_g_min: z.number().nonnegative(),
  carbs_g_min: z.number().nonnegative(),
  fat_g_max: z.number().nonnegative(),
  fiber_g_min: z.number().nonnegative(),
  sodium_mg_max: z.number().nonnegative(),
});

export const recipeCreateSchema = z.object({
  name: z.string().min(1).max(100),
  ingredients: z.array(recipeIngredientSchema).min(1),
  nutri_targets: nutriTargetsSchema,
  servings_per_batch: z.number().int().positive(),
  prep_time_min: z.number().int().positive(),
});

export type RecipeCreateInput = z.infer<typeof recipeCreateSchema>;

// --- Donor ---
export const donorTypeSchema = z.enum([
  'supermercado',
  'restaurante',
  'horta_urbana',
  'outro',
]);

export const donorCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: donorTypeSchema,
  contact_phone: z.string().max(20).optional(),
  contact_email: z.string().email().optional(),
});

export type DonorCreateInput = z.infer<typeof donorCreateSchema>;

// --- Report ---
export const reportGenerateSchema = z.object({
  period_start: z.string().date(),
  period_end: z.string().date(),
  format: z.enum(['pdf', 'csv']),
});

export type ReportGenerateInput = z.infer<typeof reportGenerateSchema>;

// --- Validation helper ---
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}