# Handoff Tecnico - Carga Inicial para IA

Use este documento como prompt inicial para qualquer novo chat de IA sobre este projeto.

---

Voce e um assistente tecnico atuando no projeto **Senior Scout 360**, localizado em `C:/Users/bruno.ferreira/Desktop/NOVO APP`.

## 1) Objetivo do produto
Aplicacao web de inteligencia comercial (PT-BR) para prospeccao/investigacao de empresas (foco agro), com:
- chat com IA (Gemini),
- RAG (Pinecone),
- autenticacao (Clerk),
- persistencia local/remota de sessoes,
- exportacao de dossiers (PDF/MD/DOC),
- mini CRM Kanban.

## 2) Stack principal
- Frontend: React 19 + TypeScript + Vite + Tailwind
- Testes: Vitest + Testing Library
- Auth: Clerk
- IA: Gemini (`@google/genai`)
- RAG: Pinecone
- Persistencia local: IndexedDB (`idb-keyval`) + fallback localStorage
- Persistencia remota / integracoes operacionais: Google Apps Script
- Funcoes serverless: `api/*.ts` (estilo Vercel Functions)

## 3) Pontos de entrada e arquitetura
- Bootstrap da app: `index.tsx`
  - `ErrorBoundary`
  - `ClerkProvider`
  - `AuthProvider`, `ModeProvider`, `CRMProvider`
- Orquestrador principal: `App.tsx`
  - sessao ativa, mensagens, loading/status, export, CRM, modais, permissao de features, sync local/remoto
- Camada visual principal do chat: `components/ChatInterface.tsx`
- Render das mensagens: `components/MessageRow.tsx`, `components/SectionalBotMessage.tsx`
- Contratos centrais: `types.ts`
- Config textual/prompts: `constants.ts`

## 4) Fluxo de mensagem (resumo operacional)
1. Usuario envia mensagem na UI (`ChatInterface`).
2. `App.tsx` adiciona mensagem + placeholder do bot.
3. `services/geminiService.ts` orquestra:
   - guardrail (`utils/promptGuard`),
   - analise de intencao/modelo,
   - lookup/benchmark de cliente,
   - RAG interno (`/api/rag`) e docs (`/api/docs-rag`),
   - chamada Gemini via proxy (`services/geminiProxy.ts` -> `/api/gemini`),
   - parsing de marcadores (`STATUS`, `PORTA`, etc.).
4. Resposta atualiza texto final, fontes, sugestoes, score PORTA e status.
5. Sessao persiste localmente e pode ser salva remotamente.

## 5) Servicos criticos
- `services/geminiService.ts`: motor de negocio da conversa.
- `services/ragService.ts`: chamadas para `/api/rag` e `/api/docs-rag` com timeout/fallback.
- `services/sessionRemoteStore.ts`: list/get/save de sessoes no backend Apps Script.
- `services/feedbackRemoteStore.ts`: envio de feedback.
- `services/apiConfig.ts`: URLs/config de integracoes.

## 6) APIs internas serverless
- `api/gemini.ts`:
  - acoes `health`, `generateContent`, `chatSendMessage`.
- `api/rag.ts`:
  - embedding + consulta vetorial para contexto interno.
- `api/docs-rag.ts`:
  - embedding + consulta vetorial para docs.
- `api/link-status.ts`:
  - validacao de links em lote.

## 7) Estado atual do repositorio (importante)
Working tree com alteracoes locais em:
- `App.tsx`
- `components/ChatInterface.tsx`
- `components/ScorePorta.tsx`
- `components/SettingsDrawer.tsx`

Nao assumir que essas alteracoes ja estao validadas ou commitadas.

## 8) Scripts uteis
- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run test:watch`
- `npm run lint`
- `npm run typecheck`
- `npm run format`

## 9) Limitacoes conhecidas (pre-existentes)
- Lint pode falhar por mismatch de config (ESLint v10 x `.eslintrc.cjs` legado).
- `typecheck` sofre ruido por `old.tsx` no root.
- Sem Clerk valido, UI principal fica bloqueada.
- `npm run dev` (Vite) nao sobe automaticamente as serverless locais.
- Fluxo completo depende de variaveis de ambiente externas (Clerk/Gemini/Pinecone).

## 10) Variaveis de ambiente relevantes
Frontend:
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_BACKEND_URL`
- `VITE_LOOKUP_URL`
- modelos (`VITE_ROUTER_MODEL`, `VITE_TACTICAL_MODEL`, etc.)

Server/API:
- `GEMINI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_DOCS_KEY`
- `PINECONE_DOCS_INDEX`
- `PINECONE_NAMESPACE`
- `PINECONE_DOCS_NAMESPACE`

## 11) Divida tecnica e riscos
- `App.tsx` grande e com multiplas responsabilidades (alto acoplamento).
- Prop drilling intenso entre `App` e componentes de chat.
- Regras de negocio de dominio pesadas no frontend.
- Possivel acoplamento indevido servico/UI (`geminiService` importando modulo de componente).
- Prompts extensos em `constants.ts` dificultam manutencao.

## 12) Como voce (IA) deve trabalhar neste projeto
- Priorize mudancas pequenas e seguras.
- Antes de editar: mapear impactos em `App.tsx`, `types.ts`, `services/*`, `components/*`.
- Sempre validar com testes quando possivel (`npm run test`).
- Em caso de erro de lint/typecheck, separar o que e legado do que e regressao nova.
- Evitar mexer em segredos/env e nao expor chaves.
- Nao reverter alteracoes locais nao relacionadas.

## 13) Entregavel esperado em cada tarefa
Sempre retornar:
1. diagnostico objetivo do problema,
2. plano curto de implementacao,
3. arquivos afetados,
4. patch/codigo,
5. validacao executada,
6. riscos residuais e proximos passos.

Comece perguntando: **qual e a tarefa prioritaria neste codigo?**

