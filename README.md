# Senior Scout 360

Aplicação web de inteligência comercial com IA para prospecção e investigação de empresas (foco em agronegócio), com chat assistido, exportação de dossiês e mini CRM em formato kanban.

## Sumário

- [Visão geral](#visão-geral)
- [Se você é iniciante](#se-você-é-iniciante)
- [Principais funcionalidades](#principais-funcionalidades)
- [Arquitetura](#arquitetura)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Fluxos principais](#fluxos-principais)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Como rodar localmente](#como-rodar-localmente)
- [Scripts disponíveis](#scripts-disponíveis)
- [APIs internas (serverless)](#apis-internas-serverless)
- [FAQ de segurança (resposta curta)](#faq-de-segurança-resposta-curta)
- [Riscos técnicos conhecidos](#riscos-técnicos-conhecidos)
- [Roadmap sugerido](#roadmap-sugerido)

## Visão geral

O **Senior Scout 360** é um app React/TypeScript com:

- Chat com IA (Gemini), em modo streaming;
- Enriquecimento por RAG (Pinecone) para contexto interno e documentação;
- Autenticação via Clerk;
- Persistência local (IndexedDB/localStorage) e remota (Apps Script backend);
- Exportação de análises (PDF/Markdown/DOC);
- Mini CRM (pipeline kanban com estágios comerciais).

## Se você é iniciante

Se você começou agora (vibe coding), siga nesta ordem:

1. Leia: [`docs/GUIA-INICIANTE.md`](./docs/GUIA-INICIANTE.md)
2. Configure `.env` usando `.env.example`
3. Rode:
   - `npm install`
   - `npm run dev`
4. Se tiver erro de chave/API, veja:
   - [`docs/SEGURANCA-API.md`](./docs/SEGURANCA-API.md)

## Principais funcionalidades

- **Chat investigativo com IA**  
  Recebe perguntas sobre empresas, gera análise estruturada e sugestões de próximos passos.

- **Dois modos de conversa**  
  - `operacao`: linguagem direta para campo/execução;
  - `diretoria`: linguagem executiva orientada a estratégia.

- **RAG de duas fontes**  
  - Contexto interno (`/api/rag`);
  - Documentação técnica (`/api/docs-rag`).

- **Sessões de conversa**  
  - Criação, seleção, exclusão e retomada;
  - Sincronização local/remota.

- **Mini CRM integrado**  
  Criação de card a partir da sessão, movimentação por estágio e leitura de saúde da oportunidade.

- **Exportação e compartilhamento**  
  PDF, DOC, Markdown, envio por e-mail e agendamento de follow-up.

## Arquitetura

### Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind + Vitest
- **Auth:** Clerk
- **LLM:** Gemini (`@google/genai`)
- **RAG:** Pinecone
- **Persistência local:** IndexedDB (`idb-keyval`) + fallback localStorage
- **Backends externos:** Google Apps Script (sessões/feedback/email/follow-up)
- **Deploy API interna:** Vercel Functions (`api/*.ts`)

### Diagrama de alto nível

```text
Usuário
  ↓
React App (App.tsx / ChatInterface)
  ↓
geminiService.ts
  ├─ scanInput (promptGuard)
  ├─ lookupCliente / benchmark
  ├─ RAG interno (/api/rag)
  ├─ RAG docs (/api/docs-rag)
  └─ Gemini (stream)
  ↓
Render da resposta + fontes + sugestões
  ↓
Persistência local (IDB) e opcional remota (Apps Script)
  ↓
Conversão em oportunidade (CRM Kanban)
```

## Estrutura do projeto

```text
.
├── api/                    # Funções serverless (RAG e validação de links)
├── components/             # UI principal (chat, mensagens, CRM, modais)
├── config/                 # Configs de modelos
├── contexts/               # Auth, modo de chat e CRM state
├── hooks/                  # Hooks de estado/tema/offline/storage
├── services/               # Integrações (Gemini, RAG, remoto, war room)
├── tests/                  # Testes unitários
├── utils/                  # Helpers (erro, markdown, prompt guard, PDF, etc.)
├── App.tsx                 # Orquestração principal da aplicação
├── index.tsx               # Bootstrap React + Providers
└── constants.ts            # Prompts e configuração textual principal
```

## Fluxos principais

### 1) Inicialização

1. `index.tsx` monta providers (`ClerkProvider`, `AuthProvider`, `ModeProvider`, `CRMProvider`).
2. `App.tsx` chama `loadSessions()` (local).
3. Tenta mesclar com `listRemoteSessions()` (remoto).
4. Define sessão ativa e renderiza chat.

### 2) Envio de mensagem

1. Usuário envia mensagem (`handleSendMessage`).
2. Mensagem do usuário é anexada à sessão.
3. `processMessage` cria placeholder do bot e inicia streaming.
4. `sendMessageToGemini`:
   - valida entrada (`scanInput`);
   - analisa intenção;
   - agrega RAG + lookup + benchmark;
   - envia prompt ao modelo;
   - parseia marcadores (`STATUS`, `PORTA`).
5. UI atualiza texto final, fontes e sugestões.

### 3) Persistência

- **Automática local** via `useSessionStorage` (IDB/localStorage).
- **Manual remota** via `saveRemoteSession` (Apps Script).

### 4) Conversão para CRM

1. Usuário clica para salvar investigação no CRM.
2. `createCardFromSession` extrai dados relevantes.
3. Card entra no pipeline (`prospeccao` inicialmente).
4. Movimentações atualizam `updatedAt`, `movedToStageAt` e health.

## Variáveis de ambiente

### Frontend (Vite)

| Variável | Obrigatória | Descrição |
|---|---:|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Sim (produção) | Chave pública do Clerk |
| `VITE_BACKEND_URL` | Não | Endpoint Apps Script principal |
| `VITE_LOOKUP_URL` | Não | Endpoint Apps Script de lookup |
| `VITE_ROUTER_MODEL` | Não | Modelo de roteamento (default: `gemini-2.5-flash`) |
| `VITE_TACTICAL_MODEL` | Não | Modelo tático (default: `gemini-2.5-flash`) |
| `VITE_DEEP_CHAT_MODEL` | Não | Modelo deep chat |
| `VITE_DEEP_RESEARCH_MODEL` | Não | Modelo deep research |

### Backend / Serverless (`api/*.ts`)

| Variável | Obrigatória | Descrição |
|---|---:|---|
| `GEMINI_API_KEY` | Sim | Chave da API Gemini |
| `PINECONE_API_KEY` | Sim* | Chave Pinecone (`*` ou `PINECONE_DOCS_KEY`) |
| `PINECONE_DOCS_KEY` | Não | Chave alternativa para docs RAG |
| `PINECONE_DOCS_INDEX` | Não | Índice Pinecone (default: `scout-arsenal`) |
| `PINECONE_NAMESPACE` | Não | Namespace padrão |
| `PINECONE_DOCS_NAMESPACE` | Não | Namespace docs (default fallback interno) |

## Como rodar localmente

### Pré-requisitos

- Node.js 20+
- npm 10+

### Passos

```bash
npm install
cp .env.example .env   # se existir; caso não, crie manualmente
npm run dev
```

Aplicação: `http://localhost:3000`

## Scripts disponíveis

```bash
npm run dev         # ambiente de desenvolvimento
npm run build       # build de produção
npm run preview     # preview do build
npm run test        # testes unitários (vitest run)
npm run test:watch  # vitest em watch
npm run lint        # eslint
npm run format      # prettier
npm run typecheck   # tsc --noEmit
```

## APIs internas (serverless)

- `POST /api/rag`  
  Recebe `{ query }`, gera embedding e consulta Pinecone para contexto interno.

- `POST /api/docs-rag`  
  Recebe `{ query }`, consulta namespace de documentação no Pinecone.

- `POST /api/link-status`  
  Recebe `{ urls: string[] }`, valida links (HEAD/GET) e retorna status.

## FAQ de segurança (resposta curta)

### "Tem como esconder chave API sem backend?"

**Não, de forma segura não tem.**

Se o app roda no navegador e chama a IA direto do frontend, a chave sempre pode ser descoberta por alguém (DevTools, source map, requests etc.).

### "Então o que eu faço sendo leigo?"

Use um **backend mínimo** (pode ser serverless: Vercel Functions, Netlify Functions, Cloudflare Workers).  
Este projeto já usa `api/*.ts`, então você já está a meio caminho.

### "Não quero mexer em backend agora. Qual paliativo?"

- Restrinja a chave no provedor (domínio/IP, se disponível);
- Coloque limite de quota e alertas de uso;
- Nunca commitar `.env` no Git.

Isso **reduz risco**, mas **não protege totalmente**.

## Riscos técnicos conhecidos

1. **Garantir uso do proxy em produção**  
   O projeto agora usa `/api/gemini` para chamadas do modelo com chave no servidor.  
   Recomendação: manter esse padrão e não reintroduzir chamadas diretas do frontend para Gemini.

2. **Arquivo `App.tsx` muito extenso**  
   Alta concentração de responsabilidades (estado, fluxo, handlers, UI).

3. **Prompts muito longos em `constants.ts`**  
   Pode aumentar bundle size e dificultar manutenção/versionamento.

4. **Validação de URL em endpoint público**  
   Endurecer políticas de allowlist/rate limit para reduzir risco de abuso.

## Roadmap sugerido

- [ ] Extrair lógica do `App.tsx` para hooks de domínio (`useChatFlow`, `useExportFlow`, etc.).
- [ ] Mover chamadas Gemini para backend com segredo isolado.
- [ ] Criar `docs/` com:
  - arquitetura detalhada,
  - contrato de payloads,
  - playbook operacional de incidentes.
- [ ] Ativar `strict` no TypeScript de forma gradual.
- [ ] Publicar `.env.example` com comentários por ambiente.

## Documentos adicionais

- [`ARQUITETURA.md`](./ARQUITETURA.md): visão técnica detalhada de módulos e fluxos.
- [`docs/GUIA-INICIANTE.md`](./docs/GUIA-INICIANTE.md): passo a passo para quem está começando.
- [`docs/SEGURANCA-API.md`](./docs/SEGURANCA-API.md): como proteger chave de API sem complicação.
- [`docs/CHECKLIST-PRODUCAO.md`](./docs/CHECKLIST-PRODUCAO.md): checklist prático antes de publicar.

---

Documentação inicial consolidada para facilitar onboarding técnico, manutenção e evolução do produto.