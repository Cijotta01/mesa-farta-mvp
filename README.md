# 🍽️ Mesa Farta — MVP

**Sistema de Gestão de Doações Perecíveis** — PWA Offline-First para a Cozinha Comunitária "Mesa Farta" (200 refeições/dia).

## 🎯 Problema
- 15-20% desperdício por validade invisível
- Compras de emergência 40% mais caras
- 8h/mês em relatórios manuais

## 🛠️ Stack
- **Frontend**: Angular 18 LTS + TypeScript + Angular Material + CDK
- **PWA**: Service Worker (Workbox) + IndexedDB (Dexie.js) — Offline-First
- **Backend**: Supabase (PostgreSQL 15 + Auth + Realtime + Storage + Edge Functions)
- **Deploy**: Vercel (GRU1 São Paulo) + GitHub Actions CI/CD

## 📱 Fluxos Principais (MVP)
| RF | Funcionalidade | Critério Crítico |
|----|----------------|------------------|
| RF01 | Entrada Doação Offline + OCR | ≤30s/item Android entrada (2GB RAM) |
| RF02 | Painel Itens Críticos | ≤500ms classificação (vermelho/amarelo/verde) |
| RF03 | Sugestão Preparo Nutricional | Match itens críticos + receitas + metas |
| RF04 | Checklist Voluntários | Touch 48dp, TalkBack, navegação linear |
| RF05 | Relatório PDF/CSV | Edge Function ≤10s, tagged PDF acessível |

## ♿ Acessibilidade
WCAG 2.1 AA verificável no CI: toque ≥48dp, fonte ≥16px, contraste 4.5:1, LiveAnnouncer, navegação teclado, cor+ícone+texto.

## 🔒 Segurança
- Magic Link exclusivo (zero senhas)
- RLS em todas tabelas
- CSP rigoroso + Zod validação dupla (client+server)
- Upload: magic bytes + sharp re-encode + signed URLs

## 🚀 Como rodar
```bash
npm ci
npm run dev          # localhost:4200
npm run build        # production build
npm run test         # unit + integration
npm run e2e          # Playwright E2E
```

## 📋 Commits Semânticos
Seguimos [Conventional Commits](https://www.conventionalcommits.org/):
`feat`, `fix`, `refactor`, `perf`, `a11y`, `security`, `docs`, `test`, `chore`, `build`, `ci`

## 📄 Licença
MIT — Projeto educacional Experiência Prática II.