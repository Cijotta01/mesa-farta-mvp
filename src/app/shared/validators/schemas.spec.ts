import {
  validateSchema,
  donationCreateSchema,
  donationUpdateSchema,
  itemCreateSchema,
  itemUpdateSchema,
  itemCategorySchema,
  itemUnitSchema,
  itemStatusSchema,
  wasteReasonSchema,
  nutriScoreSchema,
  taskCreateSchema,
  taskUpdateSchema,
  recipeIngredientSchema,
  nutriTargetsSchema,
  recipeCreateSchema,
  donorTypeSchema,
  donorCreateSchema,
  reportGenerateSchema,
} from './schemas';

describe('Shared Validators (Zod Schemas)', () => {
  describe('validateSchema helper', () => {
    it('should return success with data for valid input', () => {
      const schema = z.object({ name: z.string().min(1) });
      const result = validateSchema(schema, { name: 'Test' });
      expect(result.success).toBeTrue();
      if (result.success) expect(result.data).toEqual({ name: 'Test' });
    });

    it('should return failure with errors for invalid input', () => {
      const schema = z.object({ name: z.string().min(1) });
      const result = validateSchema(schema, { name: '' });
      expect(result.success).toBeFalse();
      if (!result.success) expect(result.errors.issues.length).toBeGreaterThan(0);
    });
  });

  describe('donationCreateSchema', () => {
    const validDonation = {
      donor_id: '550e8400-e29b-41d4-a716-446655440000',
      received_at: '2026-11-14T10:00:00.000Z',
      received_by: '550e8400-e29b-41d4-a716-446655440001',
      vehicle_plate: 'ABC-1234',
      notes: 'Observação teste',
    };

    it('should accept valid donation', () => {
      const result = validateSchema(donationCreateSchema, validDonation);
      expect(result.success).toBeTrue();
    });

    it('should reject missing donor_id', () => {
      const { donor_id, ...rest } = validDonation;
      const result = validateSchema(donationCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject invalid donor_id format', () => {
      const result = validateSchema(donationCreateSchema, { ...validDonation, donor_id: 'invalid-uuid' });
      expect(result.success).toBeFalse();
    });

    it('should reject missing received_at', () => {
      const { received_at, ...rest } = validDonation;
      const result = validateSchema(donationCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject invalid received_at format', () => {
      const result = validateSchema(donationCreateSchema, { ...validDonation, received_at: 'invalid-date' });
      expect(result.success).toBeFalse();
    });

    it('should reject missing received_by', () => {
      const { received_by, ...rest } = validDonation;
      const result = validateSchema(donationCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should accept optional vehicle_plate', () => {
      const result = validateSchema(donationCreateSchema, { ...validDonation, vehicle_plate: undefined });
      expect(result.success).toBeTrue();
    });

    it('should reject vehicle_plate too long', () => {
      const result = validateSchema(donationCreateSchema, { ...validDonation, vehicle_plate: 'A'.repeat(11) });
      expect(result.success).toBeFalse();
    });

    it('should accept optional notes', () => {
      const result = validateSchema(donationCreateSchema, { ...validDonation, notes: undefined });
      expect(result.success).toBeTrue();
    });

    it('should reject notes too long', () => {
      const result = validateSchema(donationCreateSchema, { ...validDonation, notes: 'A'.repeat(501) });
      expect(result.success).toBeFalse();
    });
  });

  describe('donationUpdateSchema', () => {
    it('should accept partial valid donation', () => {
      const result = validateSchema(donationUpdateSchema, { notes: 'Updated notes' });
      expect(result.success).toBeTrue();
    });

    it('should accept empty object', () => {
      const result = validateSchema(donationUpdateSchema, {});
      expect(result.success).toBeTrue();
    });
  });

  describe('itemCreateSchema', () => {
    const validItem = {
      donation_id: '550e8400-e29b-41d4-a716-446655440000',
      product_name: 'Tomate',
      category: 'hortifruti',
      quantity_kg: 5.0,
      unit: 'kg',
      expiration_date: '2026-12-01',
      lot_code: 'L12345',
      barcode: '7891234567890',
      nutri_score: { energy_kcal: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, fiber_g: 1.2, sodium_mg: 5 },
    };

    it('should accept valid item', () => {
      const result = validateSchema(itemCreateSchema, validItem);
      expect(result.success).toBeTrue();
    });

    it('should reject missing donation_id', () => {
      const { donation_id, ...rest } = validItem;
      const result = validateSchema(itemCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject invalid donation_id format', () => {
      const result = validateSchema(itemCreateSchema, { ...validItem, donation_id: 'invalid' });
      expect(result.success).toBeFalse();
    });

    it('should reject missing product_name', () => {
      const { product_name, ...rest } = validItem;
      const result = validateSchema(itemCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject product_name too long', () => {
      const result = validateSchema(itemCreateSchema, { ...validItem, product_name: 'A'.repeat(101) });
      expect(result.success).toBeFalse();
    });

    it('should reject invalid category', () => {
      const result = validateSchema(itemCreateSchema, { ...validItem, category: 'invalido' });
      expect(result.success).toBeFalse();
    });

    it('should accept all valid categories', () => {
      const categories = ['hortifruti', 'proteina', 'grao', 'laticinio', 'panificado', 'outro'];
      categories.forEach(cat => {
        const result = validateSchema(itemCreateSchema, { ...validItem, category: cat });
        expect(result.success).toBeTrue();
      });
    });

    it('should reject missing quantity_kg', () => {
      const { quantity_kg, ...rest } = validItem;
      const result = validateSchema(itemCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject zero or negative quantity_kg', () => {
      expect(validateSchema(itemCreateSchema, { ...validItem, quantity_kg: 0 }).success).toBeFalse();
      expect(validateSchema(itemCreateSchema, { ...validItem, quantity_kg: -1 }).success).toBeFalse();
    });

    it('should reject missing unit', () => {
      const { unit, ...rest } = validItem;
      const result = validateSchema(itemCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should accept valid units', () => {
      ['kg', 'un', 'l'].forEach(u => {
        const result = validateSchema(itemCreateSchema, { ...validItem, unit: u });
        expect(result.success).toBeTrue();
      });
    });

    it('should reject invalid unit', () => {
      const result = validateSchema(itemCreateSchema, { ...validItem, unit: 'invalid' });
      expect(result.success).toBeFalse();
    });

    it('should reject missing expiration_date', () => {
      const { expiration_date, ...rest } = validItem;
      const result = validateSchema(itemCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject invalid expiration_date format', () => {
      const result = validateSchema(itemCreateSchema, { ...validItem, expiration_date: 'invalid-date' });
      expect(result.success).toBeFalse();
    });

    it('should accept optional lot_code', () => {
      const result = validateSchema(itemCreateSchema, { ...validItem, lot_code: undefined });
      expect(result.success).toBeTrue();
    });

    it('should accept optional barcode', () => {
      const result = validateSchema(itemCreateSchema, { ...validItem, barcode: undefined });
      expect(result.success).toBeTrue();
    });

    it('should accept optional nutri_score', () => {
      const result = validateSchema(itemCreateSchema, { ...validItem, nutri_score: undefined });
      expect(result.success).toBeTrue();
    });
  });

  describe('itemUpdateSchema', () => {
    it('should accept partial valid item', () => {
      const result = validateSchema(itemUpdateSchema, { quantity_kg: 3.5, status: 'preparando' });
      expect(result.success).toBeTrue();
    });

    it('should accept valid status transitions', () => {
      ['recebido', 'preparando', 'cozido', 'servido', 'desperdicado'].forEach(status => {
        const result = validateSchema(itemUpdateSchema, { status });
        expect(result.success).toBeTrue();
      });
    });

    it('should reject invalid status', () => {
      const result = validateSchema(itemUpdateSchema, { status: 'invalido' });
      expect(result.success).toBeFalse();
    });

    it('should accept valid waste_reason', () => {
      ['validade_vencida', 'qualidade_ruim', 'excedente', 'contaminacao', 'outro'].forEach(reason => {
        const result = validateSchema(itemUpdateSchema, { status: 'desperdicado', waste_reason: reason });
        expect(result.success).toBeTrue();
      });
    });

    it('should reject invalid waste_reason', () => {
      const result = validateSchema(itemUpdateSchema, { waste_reason: 'invalido' });
      expect(result.success).toBeFalse();
    });
  });

  describe('taskCreateSchema', () => {
    const validTask = {
      item_id: '550e8400-e29b-41d4-a716-446655440000',
      volunteer_id: '550e8400-e29b-41d4-a716-446655440001',
      description: 'Picar 5 kg de tomate',
      sequence: 1,
    };

    it('should accept valid task', () => {
      const result = validateSchema(taskCreateSchema, validTask);
      expect(result.success).toBeTrue();
    });

    it('should reject missing item_id', () => {
      const { item_id, ...rest } = validTask;
      const result = validateSchema(taskCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject invalid item_id format', () => {
      const result = validateSchema(taskCreateSchema, { ...validTask, item_id: 'invalid' });
      expect(result.success).toBeFalse();
    });

    it('should accept optional volunteer_id', () => {
      const { volunteer_id, ...rest } = validTask;
      const result = validateSchema(taskCreateSchema, rest);
      expect(result.success).toBeTrue();
    });

    it('should reject invalid volunteer_id format', () => {
      const result = validateSchema(taskCreateSchema, { ...validTask, volunteer_id: 'invalid' });
      expect(result.success).toBeFalse();
    });

    it('should reject missing description', () => {
      const { description, ...rest } = validTask;
      const result = validateSchema(taskCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject description too long', () => {
      const result = validateSchema(taskCreateSchema, { ...validTask, description: 'A'.repeat(201) });
      expect(result.success).toBeFalse();
    });

    it('should reject missing sequence', () => {
      const { sequence, ...rest } = validTask;
      const result = validateSchema(taskCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject non-positive sequence', () => {
      expect(validateSchema(taskCreateSchema, { ...validTask, sequence: 0 }).success).toBeFalse();
      expect(validateSchema(taskCreateSchema, { ...validTask, sequence: -1 }).success).toBeFalse();
    });
  });

  describe('taskUpdateSchema', () => {
    it('should accept valid status update', () => {
      const result = validateSchema(taskUpdateSchema, { status: 'concluida' });
      expect(result.success).toBeTrue();
    });

    it('should accept volunteer_id assignment', () => {
      const result = validateSchema(taskUpdateSchema, { volunteer_id: '550e8400-e29b-41d4-a716-446655440001' });
      expect(result.success).toBeTrue();
    });

    it('should reject invalid status', () => {
      const result = validateSchema(taskUpdateSchema, { status: 'invalido' });
      expect(result.success).toBeFalse();
    });
  });

  describe('recipeCreateSchema', () => {
    const validRecipe = {
      name: 'Arroz com Feijão',
      ingredients: [
        { category: 'grao', quantity_kg: 2.0, unit: 'kg', is_optional: false },
        { category: 'grao', quantity_kg: 1.5, unit: 'kg', is_optional: false },
        { category: 'hortifruti', quantity_kg: 3.0, unit: 'kg', is_optional: false },
      ],
      nutri_targets: {
        energy_kcal_min: 350,
        energy_kcal_max: 500,
        protein_g_min: 15,
        carbs_g_min: 50,
        fat_g_max: 15,
        fiber_g_min: 8,
        sodium_mg_max: 400,
      },
      servings_per_batch: 50,
      prep_time_min: 45,
    };

    it('should accept valid recipe', () => {
      const result = validateSchema(recipeCreateSchema, validRecipe);
      expect(result.success).toBeTrue();
    });

    it('should reject missing name', () => {
      const { name, ...rest } = validRecipe;
      const result = validateSchema(recipeCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject empty ingredients', () => {
      const result = validateSchema(recipeCreateSchema, { ...validRecipe, ingredients: [] });
      expect(result.success).toBeFalse();
    });

    it('should reject invalid ingredient category', () => {
      const result = validateSchema(recipeCreateSchema, {
        ...validRecipe,
        ingredients: [{ category: 'invalido', quantity_kg: 1, unit: 'kg', is_optional: false }],
      });
      expect(result.success).toBeFalse();
    });

    it('should reject missing nutri_targets', () => {
      const { nutri_targets, ...rest } = validRecipe;
      const result = validateSchema(recipeCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject invalid servings_per_batch', () => {
      expect(validateSchema(recipeCreateSchema, { ...validRecipe, servings_per_batch: 0 }).success).toBeFalse();
      expect(validateSchema(recipeCreateSchema, { ...validRecipe, servings_per_batch: -1 }).success).toBeFalse();
    });

    it('should reject invalid prep_time_min', () => {
      expect(validateSchema(recipeCreateSchema, { ...validRecipe, prep_time_min: 0 }).success).toBeFalse();
    });
  });

  describe('donorCreateSchema', () => {
    const validDonor = {
      name: 'Supermercado Teste',
      type: 'supermercado',
      contact_phone: '(11) 99999-9999',
      contact_email: 'teste@supermercado.com',
    };

    it('should accept valid donor', () => {
      const result = validateSchema(donorCreateSchema, validDonor);
      expect(result.success).toBeTrue();
    });

    it('should reject missing name', () => {
      const { name, ...rest } = validDonor;
      const result = validateSchema(donorCreateSchema, rest);
      expect(result.success).toBeFalse();
    });

    it('should reject invalid type', () => {
      const result = validateSchema(donorCreateSchema, { ...validDonor, type: 'invalido' });
      expect(result.success).toBeFalse();
    });

    it('should accept valid types', () => {
      ['supermercado', 'restaurante', 'horta_urbana', 'outro'].forEach(t => {
        const result = validateSchema(donorCreateSchema, { ...validDonor, type: t });
        expect(result.success).toBeTrue();
      });
    });

    it('should reject invalid email', () => {
      const result = validateSchema(donorCreateSchema, { ...validDonor, contact_email: 'invalid-email' });
      expect(result.success).toBeFalse();
    });

    it('should accept optional phone and email', () => {
      const result = validateSchema(donorCreateSchema, { name: 'Teste', type: 'outro' });
      expect(result.success).toBeTrue();
    });
  });

  describe('reportGenerateSchema', () => {
    it('should accept valid report request', () => {
      const result = validateSchema(reportGenerateSchema, {
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        format: 'pdf',
      });
      expect(result.success).toBeTrue();
    });

    it('should accept csv format', () => {
      const result = validateSchema(reportGenerateSchema, {
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        format: 'csv',
      });
      expect(result.success).toBeTrue();
    });

    it('should reject invalid format', () => {
      const result = validateSchema(reportGenerateSchema, {
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        format: 'xlsx',
      });
      expect(result.success).toBeFalse();
    });

    it('should reject invalid date format', () => {
      const result = validateSchema(reportGenerateSchema, {
        period_start: 'invalid-date',
        period_end: '2026-12-31',
        format: 'pdf',
      });
      expect(result.success).toBeFalse();
    });
  });

  describe('enum schemas', () => {
    it('itemCategorySchema should accept valid categories', () => {
      ['hortifruti', 'proteina', 'grao', 'laticinio', 'panificado', 'outro'].forEach(c => {
        expect(itemCategorySchema.safeParse(c).success).toBeTrue();
      });
      expect(itemCategorySchema.safeParse('invalido').success).toBeFalse();
    });

    it('itemUnitSchema should accept valid units', () => {
      ['kg', 'un', 'l'].forEach(u => {
        expect(itemUnitSchema.safeParse(u).success).toBeTrue();
      });
      expect(itemUnitSchema.safeParse('invalid').success).toBeFalse();
    });

    it('itemStatusSchema should accept valid statuses', () => {
      ['recebido', 'preparando', 'cozido', 'servido', 'desperdicado'].forEach(s => {
        expect(itemStatusSchema.safeParse(s).success).toBeTrue();
      });
      expect(itemStatusSchema.safeParse('invalido').success).toBeFalse();
    });

    it('wasteReasonSchema should accept valid reasons', () => {
      ['validade_vencida', 'qualidade_ruim', 'excedente', 'contaminacao', 'outro'].forEach(r => {
        expect(wasteReasonSchema.safeParse(r).success).toBeTrue();
      });
      expect(wasteReasonSchema.safeParse('invalido').success).toBeFalse();
    });

    it('donorTypeSchema should accept valid types', () => {
      ['supermercado', 'restaurante', 'horta_urbana', 'outro'].forEach(t => {
        expect(donorTypeSchema.safeParse(t).success).toBeTrue();
      });
      expect(donorTypeSchema.safeParse('invalido').success).toBeFalse();
    });
  });

  describe('nutriScoreSchema', () => {
    it('should accept valid nutri_score', () => {
      const valid = { energy_kcal: 100, protein_g: 5, carbs_g: 20, fat_g: 2, fiber_g: 3, sodium_mg: 50 };
      expect(nutriScoreSchema.safeParse(valid).success).toBeTrue();
    });

    it('should reject negative values', () => {
      const invalid = { energy_kcal: -1, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0 };
      expect(nutriScoreSchema.safeParse(invalid).success).toBeFalse();
    });
  });

  describe('nutriTargetsSchema', () => {
    it('should accept valid targets', () => {
      const valid = {
        energy_kcal_min: 300, energy_kcal_max: 500,
        protein_g_min: 15, carbs_g_min: 50, fat_g_max: 15,
        fiber_g_min: 8, sodium_mg_max: 400,
      };
      expect(nutriTargetsSchema.safeParse(valid).success).toBeTrue();
    });

    it('should reject negative values', () => {
      const invalid = { energy_kcal_min: -1, energy_kcal_max: 500, protein_g_min: 0, carbs_g_min: 0, fat_g_max: 0, fiber_g_min: 0, sodium_mg_max: 0 };
      expect(nutriTargetsSchema.safeParse(invalid).success).toBeFalse();
    });
  });

  describe('recipeIngredientSchema', () => {
    it('should accept valid ingredient', () => {
      const valid = { category: 'hortifruti', quantity_kg: 2.5, unit: 'kg', is_optional: false };
      expect(recipeIngredientSchema.safeParse(valid).success).toBeTrue();
    });

    it('should default is_optional to false', () => {
      const valid = { category: 'hortifruti', quantity_kg: 2.5, unit: 'kg' };
      const result = recipeIngredientSchema.safeParse(valid);
      expect(result.success).toBeTrue();
      if (result.success) expect(result.data.is_optional).toBeFalse();
    });
  });
});

// Import Zod for the first test
import { z } from 'zod';