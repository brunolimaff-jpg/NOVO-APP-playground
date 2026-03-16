# Plano de Code-Splitting & Otimização de Bundle

## Diagnóstico Atual

| Métrica | Valor | Meta |
|---------|-------|------|
| Bundle principal (`index-*.js`) | **1.5 MB** | < 400 KB |
| Mermaid total (core + diagramas) | **~3 MB** | Lazy, só quando renderizar diagrama |
| html2canvas | **198 KB** | Lazy (só PDF export) |
| react-markdown + deps | **156 KB** | Chunk separado |
| Total dist (uncompressed) | **5.5 MB** | < 2 MB |
| Chunks com React.lazy | 7 componentes | 12+ componentes |

### O que já funciona bem
- React/ReactDOM em vendor chunk separado
- CRMDetail, CRMPipeline, WarRoom, SettingsDrawer, MeetingBriefing, InvestigationDashboard = lazy
- Mermaid importado via dynamic import no MarkdownRenderer
- `loadWithChunkRetry` para resiliência pós-deploy

### Gargalos principais no bundle de 1.5 MB
1. **constants.ts (1.061 linhas, ~52 KB)** — prompts enormes eagerly loaded
2. **geminiService.ts (852 linhas)** — função pesada no bundle principal
3. **ChatInterface.tsx (650 linhas)** — importa eagerly MessageRow → ScorePorta, WeatherInsight, ComexProfile, etc.
4. **MarkdownRenderer.tsx (425 linhas)** — puxa react-markdown + remark/rehype (~156 KB)
5. **MessageRow importa 10+ componentes eagerly** — muitos são condicionais
6. **Sem manualChunks** para libs pesadas (framer-motion, react-virtuoso, @clerk, @google/genai)
7. **html2canvas (198 KB)** no bundle sem necessidade

---

## Plano de Implementação (7 etapas)

### Etapa 1 — manualChunks no Vite (impacto: ALTO, risco: BAIXO)
**Arquivo:** `vite.config.ts`

Separar bibliotecas pesadas em chunks dedicados com cache independente:

```typescript
manualChunks: {
  vendor: ['react', 'react-dom'],
  'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-raw', 'rehype-sanitize'],
  'vendor-motion': ['framer-motion'],
  'vendor-virtuoso': ['react-virtuoso'],
  'vendor-clerk': ['@clerk/clerk-react'],
  'vendor-genai': ['@google/genai'],
},
```

**Resultado:** Bundle principal reduz ~300-400 KB, browsers cacheiam vendors separadamente.

### Etapa 2 — Lazy-load de componentes condicionais no MessageRow (impacto: ALTO, risco: BAIXO)
**Arquivo:** `components/MessageRow.tsx`

Componentes que só renderizam condicionalmente devem ser lazy:
- `ScorePorta` (271 linhas) — só quando há `scorePorta`
- `WeatherInsight` (192 linhas) — só quando há `weatherData`
- `ComexProfile` (169 linhas) — só quando há CNPJ
- `ClienteSeniorScore` (154 linhas) — só quando há `clienteSeniorData`
- `GhostMessageBlock` (67 linhas) — só quando ghost
- `ErrorMessageCard` (156 linhas) — só quando há erro

```tsx
const ScorePorta = React.lazy(() => import('./ScorePorta'));
const WeatherInsight = React.lazy(() => import('./WeatherInsight'));
const ComexProfile = React.lazy(() => import('./ComexProfile'));
const ClienteSeniorScore = React.lazy(() => import('./ClienteSeniorScore'));
```

Cada um envolvido em `<Suspense fallback={null}>`.

**Resultado:** ~800+ linhas de componentes removidas do bundle crítico.

### Etapa 3 — Extrair prompts para módulo lazy (impacto: ALTO, risco: MÉDIO)
**Arquivos:** `constants.ts` → novo `prompts/systemPrompts.ts`

`constants.ts` tem ~52 KB, ~80% são strings de prompt que só são necessárias ao enviar mensagem.

1. Manter em `constants.ts`: `APP_NAME`, `APP_VERSION`, `MODE_LABELS`, `DEFAULT_MODE` (~50 linhas)
2. Mover prompts para `prompts/systemPrompts.ts`
3. Em `App.tsx`, trocar import estático por dynamic import dentro de `processMessage`

```typescript
// App.tsx — dentro de processMessage
const { getSystemPrompt } = await import('./prompts/systemPrompts');
const prompt = getSystemPrompt(mode, nomeVendedor);
```

**Resultado:** ~40 KB removidos do bundle inicial.

### Etapa 4 — MarkdownRenderer como chunk separado (impacto: MÉDIO, risco: MÉDIO)
**Arquivo:** `components/SectionalBotMessage.tsx`

MarkdownRenderer puxa react-markdown + remark + rehype (156 KB). Lazy-load no primeiro render de mensagem bot:

```tsx
const MarkdownRenderer = React.lazy(() => import('./MarkdownRenderer'));
<Suspense fallback={<div className="animate-pulse h-4 bg-gray-200 rounded w-3/4" />}>
  <MarkdownRenderer content={section.content} />
</Suspense>
```

**Resultado:** ~156 KB sai do bundle principal, carrega apenas quando há mensagem bot.

### Etapa 5 — Lazy-load de modais no App.tsx (impacto: MÉDIO, risco: BAIXO)
**Arquivo:** `App.tsx`

Modais importados eagerly que são condicionais:
- `EmailModal` (69 linhas) — só quando `showEmailModal`
- `FollowUpModal` (232 linhas) — só quando `showFollowUp`
- `AuthModal` (7 linhas)

```tsx
const EmailModal = React.lazy(() => loadWithChunkRetry(() => import('./components/EmailModal')));
const FollowUpModal = React.lazy(() => loadWithChunkRetry(() => import('./components/FollowUpModal')));
```

**Resultado:** ~300 linhas removidas do bundle inicial.

### Etapa 6 — Lazy-load sub-features no CRMDetail (impacto: MÉDIO, risco: BAIXO)
**Arquivo:** `components/CRMDetail.tsx`

Sub-componentes do CRMDetail que só aparecem condicionalmente:
- `SectorAnalysis` (280 linhas) — drawer on-demand
- `NewsRadar` (175 linhas) — só quando expandido
- `MarketPulse` (136 linhas) — só quando expandido
- `SafraTimeline` (158 linhas) — contextual
- `RegulatoryRadar` (154 linhas) — contextual

```tsx
const SectorAnalysis = React.lazy(() => import('./SectorAnalysis'));
const NewsRadar = React.lazy(() => import('./NewsRadar'));
const MarketPulse = React.lazy(() => import('./MarketPulse'));
```

**Resultado:** CRMDetail chunk reduz de 51 KB para ~25 KB.

### Etapa 7 — Otimização de Mermaid (impacto: MÉDIO, risco: ALTO)
**Arquivo:** `components/MarkdownRenderer.tsx`

Mermaid carrega TODOS os diagramas (3 MB total). Maioria dos usuários só usa flowchart.

Usar import seletivo do mermaid v10:
```typescript
import mermaid from 'mermaid/dist/mermaid.core.mjs';
await mermaid.registerExternalDiagrams([
  import('mermaid/dist/flowDiagram-v2.mjs'),
  import('mermaid/dist/sequenceDiagram.mjs'),
]);
```

> **Risco alto** — depende da API interna do mermaid. Testar extensivamente.

**Resultado:** Mermaid reduz de ~3 MB para ~500 KB.

---

## Resumo de Impacto

| Etapa | Redução estimada | Risco | Prioridade |
|-------|-----------------|-------|------------|
| 1. manualChunks | -300 KB do principal | Baixo | 1 |
| 2. Lazy MessageRow children | -100 KB do principal | Baixo | 2 |
| 3. Prompts lazy | -40 KB do principal | Médio | 3 |
| 4. MarkdownRenderer lazy | -156 KB do principal | Médio | 4 |
| 5. Modais lazy | -30 KB do principal | Baixo | 5 |
| 6. CRM sub-features lazy | -50 KB do CRMDetail | Baixo | 6 |
| 7. Mermaid tree-shaking | -2.5 MB total | Alto | 7 |
| **Total** | **~676 KB do principal + ~2.5 MB total** | — | — |

**Bundle principal estimado pós-otimização:** ~400-500 KB (gzipped ~130-150 KB)

## Ordem de execução
1 → 2 → 5 → 3 → 4 → 6 → 7

Etapas 1, 2 e 5 são baixo risco e alto retorno — prioridade máxima.
Etapa 7 (Mermaid) é opcional e de risco alto — fazer por último.
