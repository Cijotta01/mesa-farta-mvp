-- ============================================
-- MESA FARTA - SCHEMA COMPLETO PARA SUPABASE
-- Rode este arquivo no SQL Editor do Supabase
-- ============================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. TABELAS PRINCIPAIS
-- ============================================

-- DOADORES
CREATE TABLE public.donor (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('supermercado', 'restaurante', 'horta_urbana', 'outro')),
    contact_phone TEXT,
    contact_email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DOAÇÕES
CREATE TABLE public.donation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id UUID NOT NULL REFERENCES public.donor(id) ON DELETE RESTRICT,
    received_at TIMESTAMPTZ NOT NULL,
    received_by UUID NOT NULL, -- auth.users.id
    vehicle_plate TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'synced', 'confirmed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ITENS PERECÍVEIS
CREATE TABLE public.item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID NOT NULL REFERENCES public.donation(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('hortifruti', 'proteina', 'grao', 'laticinio', 'panificado', 'outro')),
    quantity_kg NUMERIC(10,3) NOT NULL CHECK (quantity_kg > 0),
    unit TEXT NOT NULL CHECK (unit IN ('kg', 'un', 'l')),
    expiration_date DATE NOT NULL,
    lot_code TEXT,
    barcode TEXT UNIQUE,
    nutri_score JSONB,
    status TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'preparando', 'cozido', 'servido', 'desperdicado')),
    prepped_by UUID, -- auth.users.id
    prepped_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ,
    wasted_at TIMESTAMPTZ,
    waste_reason TEXT CHECK (waste_reason IN ('validade_vencida', 'qualidade_ruim', 'excedente', 'contaminacao', 'outro')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RECEITAS PADRÃO
CREATE TABLE public.recipe (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    ingredients JSONB NOT NULL, -- [{category, quantity_kg, unit, is_optional}]
    nutri_targets JSONB NOT NULL, -- {energy_kcal_min, energy_kcal_max, protein_g_min, carbs_g_min, fat_g_max, fiber_g_min, sodium_mg_max}
    servings_per_batch INTEGER NOT NULL CHECK (servings_per_batch > 0),
    prep_time_min INTEGER NOT NULL CHECK (prep_time_min > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TAREFAS DE PREPARO
CREATE TABLE public.task (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.item(id) ON DELETE CASCADE,
    volunteer_id UUID, -- auth.users.id (opcional, auto-atribuição)
    description TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PERFIS DE USUÁRIO (estende auth.users)
CREATE TABLE public.user_profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('nutritionist', 'volunteer', 'manager')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RELATÓRIOS GERADOS
CREATE TABLE public.report (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    generated_by UUID NOT NULL REFERENCES auth.users(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    pdf_url TEXT,
    csv_url TEXT,
    metrics JSONB NOT NULL
);

-- FILA DE SINCRONIZAÇÃO (para debug/auditoria)
CREATE TABLE public.sync_queue (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('donation', 'item', 'task', 'recipe', 'donor')),
    entity_id UUID NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    retries INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    synced_at TIMESTAMPTZ
);

-- ============================================
-- 2. ÍNDICES PARA PERFORMANCE
-- ============================================

-- Painel crítico: expiração + status (RF02 ≤500ms)
CREATE INDEX idx_item_expiration_status ON public.item (expiration_date, status)
    WHERE status IN ('recebido', 'preparando');

-- Consultas por doação
CREATE INDEX idx_item_donation_id ON public.item (donation_id);

-- Tasks por voluntário
CREATE INDEX idx_task_volunteer_id ON public.task (volunteer_id) WHERE volunteer_id IS NOT NULL;
CREATE INDEX idx_task_item_id ON public.task (item_id);

-- Doações por status (sync queue)
CREATE INDEX idx_donation_status ON public.donation (status) WHERE status = 'draft';

-- Relatórios por período
CREATE INDEX idx_report_period ON public.report (period_start, period_end);

-- Sync queue por entidade
CREATE INDEX idx_sync_queue_entity ON public.sync_queue (entity_type, entity_id);

-- ============================================
-- 3. TRIGGER updated_at AUTOMÁTICO
-- ============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_donor_updated_at
    BEFORE UPDATE ON public.donor FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_donation_updated_at
    BEFORE UPDATE ON public.donation FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_item_updated_at
    BEFORE UPDATE ON public.item FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_recipe_updated_at
    BEFORE UPDATE ON public.recipe FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_user_profile_updated_at
    BEFORE UPDATE ON public.user_profile FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilita RLS em todas as tabelas
ALTER TABLE public.donor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- Função helper: role do usuário atual
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT role FROM public.user_profile WHERE id = auth.uid()),
        'anonymous'
    );
$$;

-- ============================================
-- POLÍTICAS: DOADORES
-- ============================================
-- Todos autenticados leem doadores ativos
CREATE POLICY "donor_select_active" ON public.donor
    FOR SELECT USING (is_active = true AND auth.role() = 'authenticated');

-- Nutricionista/Gestor gerenciam doadores
CREATE POLICY "donor_all_nutritionist_manager" ON public.donor
    FOR ALL USING (
        public.current_user_role() IN ('nutritionist', 'manager')
    );

-- ============================================
-- POLÍTICAS: DOAÇÕES
-- ============================================
-- Nutricionista: CRUD completo
CREATE POLICY "donation_all_nutritionist" ON public.donation
    FOR ALL USING (public.current_user_role() = 'nutritionist');

-- Gestor: apenas leitura
CREATE POLICY "donation_select_manager" ON public.donation
    FOR SELECT USING (public.current_user_role() = 'manager');

-- Voluntário: NENHUM acesso direto (usa tasks)
-- (sem policy = nega tudo)

-- ============================================
-- POLÍTICAS: ITENS
-- ============================================
-- Nutricionista: CRUD completo
CREATE POLICY "item_all_nutritionist" ON public.item
    FOR ALL USING (public.current_user_role() = 'nutritionist');

-- Gestor: leitura
CREATE POLICY "item_select_manager" ON public.item
    FOR SELECT USING (public.current_user_role() = 'manager');

-- Voluntário: vê itens das próprias tasks
CREATE POLICY "item_select_volunteer_own" ON public.item
    FOR SELECT USING (
        public.current_user_role() = 'volunteer'
        AND EXISTS (
            SELECT 1 FROM public.task t
            WHERE t.item_id = item.id
            AND t.volunteer_id = auth.uid()
        )
    );

-- ============================================
-- POLÍTICAS: RECEITAS
-- ============================================
-- Todos autenticados leem receitas ativas
CREATE POLICY "recipe_select_active" ON public.recipe
    FOR SELECT USING (is_active = true AND auth.role() = 'authenticated');

-- Nutricionista/Gestor gerenciam receitas
CREATE POLICY "recipe_all_nutritionist_manager" ON public.recipe
    FOR ALL USING (public.current_user_role() IN ('nutritionist', 'manager'));

-- ============================================
-- POLÍTICAS: TAREFAS
-- ============================================
-- Nutricionista/Gestor: CRUD completo
CREATE POLICY "task_all_nutritionist_manager" ON public.task
    FOR ALL USING (public.current_user_role() IN ('nutritionist', 'manager'));

-- Voluntário: vê e atualiza SUAS tasks
CREATE POLICY "task_select_own" ON public.task
    FOR SELECT USING (
        public.current_user_role() = 'volunteer'
        AND (volunteer_id = auth.uid() OR volunteer_id IS NULL) -- pode pegar tarefas não atribuídas
    );

CREATE POLICY "task_update_own" ON public.task
    FOR UPDATE USING (
        public.current_user_role() = 'volunteer'
        AND (volunteer_id = auth.uid() OR volunteer_id IS NULL)
    ) WITH CHECK (
        public.current_user_role() = 'volunteer'
        AND volunteer_id = auth.uid() -- ao concluir, atribui a si mesmo
    );

-- ============================================
-- POLÍTICAS: USER_PROFILE
-- ============================================
-- Usuário vê próprio perfil
CREATE POLICY "profile_select_own" ON public.user_profile
    FOR SELECT USING (id = auth.uid());

-- Gestor vê todos
CREATE POLICY "profile_select_manager" ON public.user_profile
    FOR SELECT USING (public.current_user_role() = 'manager');

-- Nutricionista vê voluntários (para atribuir tasks)
CREATE POLICY "profile_select_nutritionist_volunteers" ON public.user_profile
    FOR SELECT USING (
        public.current_user_role() = 'nutritionist'
        AND role = 'volunteer'
    );

-- ============================================
-- POLÍTICAS: RELATÓRIOS
-- ============================================
-- Nutricionista/Gestor: CRUD
CREATE POLICY "report_all_nutritionist_manager" ON public.report
    FOR ALL USING (public.current_user_role() IN ('nutritionist', 'manager'));

-- ============================================
-- POLÍTICAS: SYNC_QUEUE (apenas sistema/nutritionist)
-- ============================================
CREATE POLICY "sync_queue_nutritionist" ON public.sync_queue
    FOR ALL USING (public.current_user_role() = 'nutritionist');

-- ============================================
-- 5. REALTIME (habilita para tabelas críticas)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.donation;
ALTER PUBLICATION supabase_realtime ADD TABLE public.item;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task;

-- ============================================
-- 6. STORAGE BUCKETS
-- ============================================

-- Bucket para notas fiscais/fotos de código de barras
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    false, -- privado
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Policy: nutricionista faz upload
CREATE POLICY "receipts_upload_nutritionist" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'receipts'
        AND public.current_user_role() = 'nutritionist'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: nutricionista/gestor leem
CREATE POLICY "receipts_select_nutritionist_manager" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'receipts'
        AND public.current_user_role() IN ('nutritionist', 'manager')
    );

-- Bucket para relatórios gerados (PDF/CSV)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'reports',
    'reports',
    false, -- privado
    10485760, -- 10MB
    ARRAY['application/pdf', 'text/csv']
) ON CONFLICT (id) DO NOTHING;

-- Policy: nutricionista/gestor fazem upload (Edge Function roda como service_role, mas policy para acesso direto)
CREATE POLICY "reports_upload_nutritionist_manager" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'reports'
        AND public.current_user_role() IN ('nutritionist', 'manager')
    );

-- Policy: nutricionista/gestor leem
CREATE POLICY "reports_select_nutritionist_manager" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'reports'
        AND public.current_user_role() IN ('nutritionist', 'manager')
    );

-- ============================================
-- 7. EDGE FUNCTION: generate-report (skeleton)
-- ============================================
-- Crie o arquivo supabase/functions/generate-report/index.ts separadamente
-- Este SQL apenas registra a function no catálogo (opcional)

-- ============================================
-- 8. SEED MÍNIMO PARA TESTES
-- ============================================

-- Doadores
INSERT INTO public.donor (name, type, contact_phone, contact_email) VALUES
    ('Supermercado Bom Preço', 'supermercado', '(11) 3333-4444', 'doacoes@bompreco.com'),
    ('Restaurante Sabor Caseiro', 'restaurante', '(11) 2222-3333', 'contato@saborcaseiro.com'),
    ('Horta Urbana Vila Verde', 'horta_urbana', '(11) 99999-8888', 'horta@vilaverde.org')
ON CONFLICT DO NOTHING;

-- Receitas padrão (simplificadas)
INSERT INTO public.recipe (name, ingredients, nutri_targets, servings_per_batch, prep_time_min) VALUES
(
    'Arroz com Feijão e Legumes',
    '[
        {"category": "grao", "quantity_kg": 2.0, "unit": "kg", "is_optional": false},
        {"category": "grao", "quantity_kg": 1.5, "unit": "kg", "is_optional": false},
        {"category": "hortifruti", "quantity_kg": 3.0, "unit": "kg", "is_optional": false}
    ]'::jsonb,
    '{"energy_kcal_min": 350, "energy_kcal_max": 500, "protein_g_min": 15, "carbs_g_min": 50, "fat_g_max": 15, "fiber_g_min": 8, "sodium_mg_max": 400}'::jsonb,
    50, 45
),
(
    'Sopa de Legumes com Proteína',
    '[
        {"category": "hortifruti", "quantity_kg": 4.0, "unit": "kg", "is_optional": false},
        {"category": "proteina", "quantity_kg": 2.0, "unit": "kg", "is_optional": false}
    ]'::jsonb,
    '{"energy_kcal_min": 250, "energy_kcal_max": 400, "protein_g_min": 20, "carbs_g_min": 30, "fat_g_max": 10, "fiber_g_min": 6, "sodium_mg_max": 350}'::jsonb,
    40, 60
),
(
    'Farofa Rica com Ovos',
    '[
        {"category": "grao", "quantity_kg": 1.5, "unit": "kg", "is_optional": false},
        {"category": "proteina", "quantity_kg": 1.0, "unit": "kg", "is_optional": false},
        {"category": "hortifruti", "quantity_kg": 1.0, "unit": "kg", "is_optional": true}
    ]'::jsonb,
    '{"energy_kcal_min": 300, "energy_kcal_max": 450, "protein_g_min": 18, "carbs_g_min": 40, "fat_g_max": 12, "fiber_g_min": 5, "sodium_mg_max": 300}'::jsonb,
    35, 30
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 9. USUÁRIOS DE TESTE (rode DEPOIS de criar no Auth)
-- ============================================
-- INSTRUÇÕES:
-- 1. No Supabase Dashboard > Authentication > Users > "Invite user" ou "Create user"
-- 2. Crie 4 usuários com email/senha temporária (ou use Magic Link depois)
-- 3. Copie os UUIDs de auth.users e substitua abaixo:
--
-- INSERT INTO public.user_profile (id, email, full_name, role) VALUES
--     ('UUID_NUTRICIONISTA', 'ana@mesafarta.org', 'Ana Nutricionista', 'nutritionist'),
--     ('UUID_GESTOR', 'gestor@mesafarta.org', 'Carlos Gestor', 'manager'),
--     ('UUID_VOLUNTARIO_1', 'maria@mesafarta.org', 'Maria Voluntária', 'volunteer'),
--     ('UUID_VOLUNTARIO_2', 'joao@mesafarta.org', 'João Voluntário', 'volunteer')
-- ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- ============================================
-- 10. VERIFICAÇÃO PÓS-DEPLOY
-- ============================================
-- Rode estes SELECTs para confirmar:
-- SELECT * FROM public.donor WHERE is_active = true;
-- SELECT * FROM public.recipe WHERE is_active = true;
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
-- SELECT * FROM storage.buckets WHERE id = 'receipts';