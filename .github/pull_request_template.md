## 📋 Descrição
<!-- Qual requisito (RF/RNF) esta PR atende? Ex.: RF01, RNF03, AME02 -->

## 🎯 Tipo de mudança
- [ ] feat — Nova funcionalidade
- [ ] fix — Correção de bug
- [ ] refactor — Refatoração
- [ ] perf — Performance
- [ ] a11y — Acessibilidade
- [ ] security — Segurança
- [ ] test — Testes
- [ ] docs — Documentação
- [ ] chore — Configuração
- [ ] build — Build
- [ ] ci — CI/CD

## ✅ Checklist de auto-revisão
- [x] Commits semânticos (conventional commits)
- [x] Testes passam (`npm run test:ci`) — **86 testes passing**
- [x] Build production passa (`npm run build`) — **1.12 MB**
- [ ] Lint passa (`npm run lint`) — **não validado** (ESLint flat config pendente)
- [ ] Acessibilidade: axe-core 0 violações nas telas alteradas — **não validado**
- [ ] Performance: RF01 ≤30s (se toca OCR/doação) — **não validado**
- [ ] Segurança: Zod schemas + RLS + CSP válidos — **parcial (schemas OK)**
- [ ] Offline-First: IndexedDB + Sync Queue funcionam — **não validado (manual)**
- [ ] Documentação atualizada (README, ADR se decisão arquitetural)

## 🧪 Como testar
1. `npm ci && npm run build`
2. `npm run test:ci` / `npm run e2e`
3. Testar offline: DevTools > Application > Service Worker > Offline
4. Validar no device Android entrada (ou emulação Pixel 2 Playwright)

## 📸 Evidências (obrigatório para RFs)
- [ ] Screenshot/GIF da funcionalidade
- [ ] Log de performance (se aplicável)
- [ ] Resultado axe-core / Lighthouse CI

---

## ⚠️ Status de Validação (Entrega Atividade)

| Item | Status | Observação |
|------|--------|------------|
| Build production | ✅ Validado | 1.12 MB |
| Testes unitários | ✅ Validado | 86 testes passing |
| Lint (ESLint) | ❌ Não validado | Flat config pendente |
| Testes E2E (Playwright) | ❌ Não validado | Pendente install browsers |
| OCR Real (Tesseract.js) | ❌ Não validado | Mock apenas |
| Performance RF01 | ❌ Não validado | Mock apenas |
| Acessibilidade (axe-core) | ❌ Não validado | Pendente |
| Deploy Vercel + Supabase | ❌ Manual | Requer config manual |