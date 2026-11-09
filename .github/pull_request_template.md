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
- [ ] Commits semânticos (conventional commits)
- [ ] Lint passa (`npm run lint`)
- [ ] Testes passam (`npm test`)
- [ ] Build production passa (`npm run build`)
- [ ] Acessibilidade: axe-core 0 violações nas telas alteradas
- [ ] Performance: RF01 ≤30s (se toca OCR/doação)
- [ ] Segurança: Zod schemas + RLS + CSP válidos
- [ ] Offline-First: IndexedDB + Sync Queue funcionam
- [ ] Documentação atualizada (README, ADR se decisão arquitetural)

## 🧪 Como testar
1. `npm ci && npm run build`
2. `npm run test` / `npm run e2e`
3. Testar offline: DevTools > Application > Service Worker > Offline
4. Validar no device Android entrada (ou emulação Pixel 2 Playwright)

## 📸 Evidências (obrigatório para RFs)
- [ ] Screenshot/GIF da funcionalidade
- [ ] Log de performance (se aplicável)
- [ ] Resultado axe-core / Lighthouse CI