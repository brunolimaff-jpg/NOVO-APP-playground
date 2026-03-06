# Arquitetura Técnica — 🦅 Senior Scout 360

Este documento detalha o desenho técnico da aplicação, os módulos principais e os fluxos de execução.

## 1. Contexto

O sistema combina:

- **Interface conversacional** (React);
- **Orquestração de IA** (Gemini + RAG);
- **Persistência local/remota** (IDB/localStorage + Apps Script);
- **Gestão de oportunidade** (mini CRM kanban).

## 2. Blocos principais

### Frontend (SPA)

- **`index.tsx`**
  - Bootstrap do app e registro dos providers globais.
- **`App.tsx`**
  - Orquestração de estado da sessão, mensagens, exportação, e CRM.
- **`components/*`**
  - Camada de interface (chat, mensagens, barra lateral, modais, war room, CRM).
- **`contexts/*`**
  - Auth, modo operacional e dados de CRM.
- **`hooks/*`**
  - Persistência local, tema, status online/offline, toast.

### Serviços de domínio

- **`services/geminiService.ts`**
  - Motor principal de perguntas/respostas com IA.
- **`services/ragService.ts`**
  - Cliente para funções serverless de RAG.
- **`services/sessionRemoteStore.ts`**
  - Operações de sessão remota (list/get/save).
- **`services/feedbackRemoteStore.ts`**
  - Envio de feedback de respostas.
- **`services/clientLookupService.ts`**
  - Lookup e benchmark de clientes.

### APIs serverless (Vercel)

- **`api/rag.ts`**
  - Embedding + consulta vetorial para contexto interno.
- **`api/docs-rag.ts`**
  - Embedding + consulta vetorial para documentação técnica.
- **`api/link-status.ts`**
  - Validação de links exibidos como fonte.

## 3. Sequência do fluxo de mensagem

```text
Usuário envia pergunta
   ↓
ChatInterface.onSendMessage
   ↓
App.handleSendMessage
   ↓
App.processMessage
   ├─ cria placeholder (isThinking)
   ├─ cria AbortController
   └─ chama sendMessageToGemini
          ↓
      geminiService.sendMessageToGemini
       ├─ scanInput (promptGuard)
       ├─ analyzeUserIntent
       ├─ lookup + benchmark + concorrentes
       ├─ RAG interno + docs RAG
       ├─ chamada ao modelo (stream)
       └─ parse de marcadores (STATUS/PORTA)
          ↓
App atualiza sessão/mensagem
   ├─ texto final
   ├─ fontes
   ├─ sugestões
   └─ metadados (score, ghost, etc.)
```

## 4. Persistência

### Local

- Hook `useSessionStorage`:
  - prioridade para IndexedDB (`scout360_sessions_v2`);
  - fallback para localStorage legado (`scout360_sessions_v1`).

### Remota

- `sessionRemoteStore` envia payload para Apps Script com ações:
  - `listSessions`
  - `getSession`
  - `saveSession`

### CRM

- `CRMContext` persiste cards em localStorage (`scout360_crm_cards_v1`) e em IDB por card.

## 5. Segurança e resiliência implementadas

- **Prompt guard** com:
  - sanitização de unicode;
  - deny-list de jailbreak;
  - rate-limit por sessão;
  - canary token para detecção de vazamento;
  - sanitização de conteúdo externo (RAG).

- **Resiliência de rede**
  - retries exponenciais (`withAutoRetry`);
  - timeouts explícitos;
  - fallback silencioso quando RAG falha;
  - tratamento de abort/cancelamento.

## 6. Contratos relevantes

### Resposta principal de IA (resumo)

Campos consumidos no app:

- `text`: texto final
- `sources`: array de `{ title, url }`
- `suggestions`: perguntas de continuidade
- `scorePorta`: score estruturado (quando existir)
- `statuses`: status de progresso
- `ghostReason`: motivo de resposta fantasma (ex.: timeout)

### Tipos base

Concentrados em `types.ts`:

- `Message`, `ChatSession`, `CRMCard`, `ScorePortaData`, `AppError`.

## 7. Gargalos e dívida técnica

1. `App.tsx` concentra muitas responsabilidades.
2. Prompts extensos em `constants.ts` aumentam custo de manutenção.
3. Uso de chave de IA no frontend deve ser eliminado em produção.
4. Endpoints de validação/consulta devem ser endurecidos com políticas de segurança.

## 8. Estratégia de evolução sugerida

- Separar `App.tsx` por bounded contexts:
  - sessão/chat,
  - exportações/compartilhamento,
  - CRM.
- Introduzir validação de payload com schema.
- Migrar prompts para versão remota/configurável.
- Consolidar observabilidade (tracing de latência por etapa do pipeline).
