# 🚀 Guia Rápido: Deploy do MVP Mesa Farta no Supabase + Vercel

## ✅ Pré-requisitos
- Conta no [Supabase](https://supabase.com) (gratuito)
- Conta no [Vercel](https://vercel.com) (gratuito)
- Conta no [GitHub](https://github.com) (já tem: `Cijotta01`)

---

## 1️⃣ CRIAR PROJETO NO SUPABASE (5 min)

1. Acesse https://supabase.com/dashboard
2. **New Project** → Organization: sua conta
3. **Name**: `mesa-farta-mvp`
4. **Database Password**: gere uma senha forte (salve no gerenciador)
5. **Region**: `South America (São Paulo)` — **obrigatório para baixa latência**
6. **Create** → aguarde ~2 min

---

## 2️⃣ RODAR SCHEMA SQL (3 min)

1. No dashboard do projeto → **SQL Editor** → **New Query**
2. Cole **todo o conteúdo** de `supabase/01_schema.sql`
3. **Run** → deve aparecer "Success. No rows returned"
4. Verifique nas abas laterais:
   - **Table Editor**: 7 tabelas criadas (`donor`, `donation`, `item`, `recipe`, `task`, `user_profile`, `report`, `sync_queue`)
   - **Authentication → Policies**: RLS habilitado em todas
   - **Database → Realtime**: `donation`, `item`, `task` habilitados
   - **Storage → Buckets**: `receipts` e `reports` criados (privados)

---

## 3️⃣ CRIAR USUÁRIOS INICIAIS (5 min)

### Opção A: Magic Link (recomendado para produção)
1. **Authentication → Users** → **Invite User**
2. Crie 4 usuários:
   | Email | Role | Observação |
   |-------|------|------------|
   | `ana@mesafarta.org` | nutritionist | Nutricionista principal |
   | `gestor@mesafarta.org` | manager | Gestor da cozinha |
   | `maria@mesafarta.org` | volunteer | Voluntária 50+ |
   | `joao@mesafarta.org` | volunteer | Voluntário reserva |
3. Cada um recebe email para definir senha (ou use Magic Link direto no app)

### Opção B: SQL direto (rápido para testes)
1. No **SQL Editor**, rode:
```sql
-- Substitua pelos UUIDs reais retornados pelo auth.users após criar acima
INSERT INTO public.user_profile (id, email, full_name, role) VALUES
    ('UUID_DA_ANA', 'ana@mesafarta.org', 'Ana Nutricionista', 'nutritionist'),
    ('UUID_DO_GESTOR', 'gestor@mesafarta.org', 'Carlos Gestor', 'manager'),
    ('UUID_DA_MARIA', 'maria@mesafarta.org', 'Maria Voluntária', 'volunteer'),
    ('UUID_DO_JOAO', 'joao@mesafarta.org', 'João Voluntário', 'volunteer')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
```

---

## 4️⃣ PEGAR CREDENCIAIS (1 min)

No dashboard do Supabase → **Settings → API**:
- **Project URL**: `https://SEU_PROJETO.supabase.co`
- **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (chave longa)

**Copie os dois.**

---

## 5️⃣ DEPLOY NO VERCEL (5 min)

1. Acesse https://vercel.com/dashboard
2. **Add New... → Project**
3. **Import Git Repository** → `Cijotta01/mesa-farta-mvp`
4. **Framework Preset**: Angular (detecta automaticamente)
5. **Environment Variables** (adicione **antes** do deploy):
   ```
   SUPABASE_URL = https://SEU_PROJETO.supabase.co
   SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
6. **Deploy** → aguarde build (~2-3 min)
7. Acesse a URL gerada: `https://mesa-farta-mvp.vercel.app`

---

## 6️⃣ TESTE MANUAL NO CELULAR (30 min) ⚠️ **CRÍTICO**

### Checklist de validação:
- [ ] **Login**: Abre app → digita email → recebe Magic Link → entra como nutricionista
- [ ] **Nova Doação (offline)**:
  - Ativa **Modo Avião** no celular
  - Clica "Nova Doação" → tira foto (ou pula OCR) → preenche → "Salvar offline"
  - Vê toast "Doação salva localmente"
- [ ] **Sync**: Desativa Modo Avião → vê banner "Sincronizando..." → "3 tarefas sincronizadas"
- [ ] **Painel Crítico**: Vê badges vermelho/amarelo/verde + contadores
- [ ] **Checklist (voluntário)**:
  - Loga como `maria@mesafarta.org`
  - Vê apenas aba "Checklist"
  - Checkbox 48dp funciona com dedo grosso
  - "Próxima" navega linear
  - TalkBack lê descrição + status
- [ ] **Relatórios (nutricionista/gestor)**:
  - Gera PDF → abre no leitor de tela → tabelas navegáveis
  - Gera CSV → abre no Excel → acentos OK (BOM UTF-8)

---

## 7️⃣ CONFIGURAR EDGE FUNCTION (opcional, para relatórios)

1. No Supabase → **Edge Functions** → **Create Function**
2. Name: `generate-report`
3. Cole o conteúdo de `supabase/functions/generate-report/index.ts`
3. **Deploy** (usa Deno, build automático)

> **Nota**: A function usa `SUPABASE_URL` e `SUPABASE_ANON_KEY` do ambiente do Supabase (já configurados automaticamente).

---

## 🔧 COMANDOS ÚTEIS PÓS-DEPLOY

```bash
# Ver logs da Edge Function
supabase functions logs generate-report --project-ref SEU_PROJETO

# Rodar migrações locais (se mudar schema)
supabase db push --project-ref SEU_PROJETO

# Testar function localmente
supabase functions serve generate-report --project-ref SEU_PROJETO
```

---

## 🆘 TROUBLESHOOTING COMUM

| Erro | Causa | Solução |
|------|-------|---------|
| `RLS policy violation` | Usuário sem role na `user_profile` | Verifique se INSERT na `user_profile` rodou após criar no Auth |
| `Magic Link não chega` | Email em spam / config SMTP | Use "Invite User" no dashboard ou configure SMTP customizado |
| `PWA não instala` | HTTPS obrigatório | Vercel já dá HTTPS; teste em `https://...` não `localhost` |
| `Offline não funciona` | Service Worker não registrado | Abra DevTools → Application → Service Workers → "Update on reload" |
| `Relatório PDF vazio` | Edge Function timeout | Aumente timeout no `vercel.json` ou otimize geração |

---

## 📞 PRÓXIMOS PASSOS APÓS VALIDAÇÃO

1. **OCR Real**: Substituir mock por Tesseract.js em Web Worker (`src/app/core/ocr/`)
2. **Testes E2E**: Implementar 3 fluxos no Playwright (`e2e/`)
3. **Monitoramento**: Sentry para errors + LogRocket para sessões
4. **Backup**: `supabase db dump` semanal automatizado

---

**Dúvidas?** Rode o SQL, faça o deploy, teste no celular. Se travar em algum passo, me avisa com o erro exato.