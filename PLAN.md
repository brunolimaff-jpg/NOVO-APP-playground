# Planejamento UX — Features 4 e 5: COMEX Trade Profiler + AI Meeting Prep

> Features 1-3 (Clima, News Radar, Market Pulse) já implementadas.

## Princípios de Design (mantidos)

1. **Progressive Disclosure** — informação sob demanda
2. **Zero Anxiety** — não compete com o fluxo principal
3. **Contextual Relevance** — dados aparecem onde fazem sentido
4. **Mobile-first** — funciona em tela pequena
5. **Consistent Patterns** — reutilizar drawers, cards, badges existentes

---

## Feature 4: COMEX Trade Profiler

### Contexto técnico existente

- `api/comex.ts` já existe como serverless function — recebe CNPJ, retorna `ComexResult`:
  ```ts
  { isExportador: boolean, cnpj?, anoReferencia?, faixaValorEstimado?, principaisNCMs?, message? }
  ```
- Atualmente é mockado (determinístico baseado na soma dos dígitos do CNPJ)
- Está **desativado** no frontend (menção em CLAUDE.md: "desativa temporariamente a chamada da api comex")
- Brasil API já usada para buscar CNAE/razão social (complementar)
- O CRM já armazena `cnpj` e `cnpjs[]` por card

### Decisão UX: Onde colocar

#### Onde NÃO colocar
- **NÃO** como página separada → dados COMEX são sobre UMA empresa, não sobre um painel geral
- **NÃO** no EmptyStateHome → é informação específica de empresa, não de aquecimento
- **NÃO** como modal standalone → interrompe o fluxo sem necessidade

#### Onde colocar: DOIS pontos de entrada

**Ponto 1: Card inline no chat (similar ao WeatherInsight)**

Quando o bot analisa uma empresa com CNPJ e o sistema detecta que ela é exportadora, um card COMEX aparece inline na mensagem:

```
Desktop — dentro do bubble do bot:
┌─────────────────────────────────────────────────┐
│ 🤖 Bot: "Análise da Agroexport Ltda..."         │
│                                                  │
│ [Score PORTA] [Cliente Senior] [Clima]           │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ 🚢 Perfil COMEX — Exportadora                │ │
│ │                                               │ │
│ │ Faixa: US$ 10M–50M  Ref: 2025               │ │
│ │ Produtos: Soja em grãos, Farelo de Soja      │ │
│ │                                               │ │
│ │ 💡 "Exportador de grande porte. Módulo de    │ │
│ │ câmbio e comex pode ser diferencial na       │ │
│ │ proposta. Avaliar necessidade de hedge."      │ │
│ │                                    [▾ mais]   │ │
│ └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Ponto 2: Badge/seção no CRM Detail**

Na coluna direita do CRM Detail, acima do News Radar, um card compacto:

```
CRM Detail — coluna direita:
┌─────────────────────────────────────┐
│ [Score PORTA box]                    │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ 🚢 COMEX                        │ │
│ │ ✅ Exportadora · US$ 10M–50M    │ │
│ │ Soja, Farelo de Soja · Ref 2025 │ │
│ │                         [▾ ver]  │ │
│ └─────────────────────────────────┘ │
│                                      │
│ [📰 News Radar]                     │
│ [Etapa do funil]                     │
└─────────────────────────────────────┘
```

Se NÃO é exportadora:
```
│ ┌─────────────────────────────────┐ │
│ │ 🚢 COMEX                        │ │
│ │ Não listada como exportadora    │ │
│ │ Ref 2025 · MDIC                  │ │
│ └─────────────────────────────────┘ │
```

### Layout Mobile

```
┌────────────────────────────┐
│ 🚢 COMEX — Exportadora     │
│ US$ 10M–50M · 2025         │
│ Soja, Farelo de Soja       │
│ 💡 "Módulo câmbio..."      │
└────────────────────────────┘
```

- Card full-width, compacto (sem grid complexo)
- Touch: card inteiro tappable para expandir
- Mesma paleta do WeatherInsight (consistência)

### Interação e Comportamento

1. **Trigger automático**: quando o sistema processa um CNPJ na investigação, faz a chamada COMEX
2. **Trigger manual no CRM**: ao abrir card com CNPJ, busca automaticamente
3. **Cache**: localStorage por CNPJ, expira em 24h (dados anuais, raramente mudam)
4. **Fallback**: se API não disponível (local dev), mostra "Consulta COMEX indisponível — disponível em produção"
5. **Loading**: skeleton inline (1 linha, 80px altura)
6. **Dados enriquecem o PORTA**: alimentar dimensão O (Operação) se exportadora

### Cores e Visual

- Exportadora: fundo `bg-indigo-50/50 dark:bg-indigo-950/20`, borda `border-indigo-200/50`
- Não exportadora: fundo neutro (slate), texto discreto
- Badge no kanban: `🚢` ao lado do health se exportadora (não se não for)

### Componentes a criar

| Arquivo | Responsabilidade |
|---|---|
| `components/ComexProfile.tsx` | Card visual inline no chat + versão compacta CRM |
| `services/comexService.ts` | Fetch `/api/comex` + cache + parse + fallback |

### API

```
# Produção (Vercel):
GET /api/comex?cnpj=12345678000190

# Local: não funciona (serverless) → fallback gracioso
```

### Integração com Gemini

O resultado COMEX é adicionado ao contexto do Gemini como enriquecimento:
```
[PERFIL COMEX]
Exportadora: SIM
Faixa estimada: US$ 10M–50M (ref 2025)
Principais NCMs: Soja em grãos, Farelo de Soja
→ Considere isso na análise de porte, tecnologia e oportunidades de módulos.
```

---

## Feature 5: AI Meeting Prep — Briefing Automático

### Contexto técnico existente

- **FollowUpModal**: agenda follow-up com .ics/Outlook (3/7/15/30 dias)
- **EmailModal**: envia dossiê por email via Apps Script
- **War Room**: sub-chat fullscreen com sidebar (padrão reutilizável)
- **Export PDF/DOC/MD**: já existe em `useChat.ts`
- **CRM Detail**: já tem notas de prospecção, dados Spotter, sessões vinculadas
- **Header do chat**: tem botões 📝 (DOC), 📅 (follow-up), ⚔️ (War Room), ⚙️ (settings)
- **Score PORTA + clima + COMEX + News**: dados contextuais já coletados

### Decisão UX: Onde colocar

#### Onde NÃO colocar
- **NÃO** como modal complexo com muitos campos → o prep deve ser AUTOMÁTICO, não um formulário
- **NÃO** como sub-chat (War Room style) → é geração one-shot, não diálogo
- **NÃO** substituindo o export PDF → PDF é do dossiê de chat, prep é focado na reunião
- **NÃO** no EmptyState → precisa de dados de uma empresa específica

#### Onde colocar: BOTÃO no CRM Detail + BOTÃO no header do chat

**Ponto 1: CRM Detail — botão "Preparar Reunião" no footer**

O vendedor está revisando o card CRM de uma empresa antes da reunião. O botão natural fica no footer, ao lado de "Fechar" e "Excluir":

```
Desktop CRM Detail Footer:
┌─────────────────────────────────────────────────────┐
│ [🗑 Excluir]    [📋 Preparar Reunião]    [Fechar]   │
└─────────────────────────────────────────────────────┘
```

Ao clicar, abre um **drawer lateral direito** (mesmo padrão do SettingsDrawer) com o briefing gerado:

```
Desktop — MeetingBriefing Drawer (w-96):
┌────────────────────────────────────┐
│ 📋 Briefing de Reunião       [✕]  │
│ ────────────────────────────────── │
│                                     │
│ 🏢 FAZENDA XYZ                     │
│ CNPJ: 12.345.678/0001-90           │
│ Ribeirão Preto, SP                  │
│ Score PORTA: 78/100 (PRD)           │
│                                     │
│ ── CONTEXTO ─────────────────────  │
│ Agropecuária de grande porte,      │
│ exportadora na faixa US$ 10M-50M.  │
│ Utiliza ERP legado (TOTVS Protheus)│
│ com módulos financeiro e fiscal.    │
│                                     │
│ ── PONTOS DE DOR ────────────────  │
│ • Integração manual entre ERP e    │
│   sistema de gestão de campo       │
│ • Sem módulo de COMEX integrado    │
│ • Folha + ponto em sistema apart.  │
│                                     │
│ ── OBJEÇÕES PROVÁVEIS ───────────  │
│ • "Já temos TOTVS, migração é     │
│   arriscada" → Resposta: ...       │
│ • "Custo de licenciamento" →       │
│   Resposta: ...                     │
│                                     │
│ ── PERGUNTAS-CHAVE ──────────────  │
│ 1. Quantas fazendas operam hoje?   │
│ 2. Qual o volume de exportação?    │
│ 3. Como gerenciam a logística?     │
│                                     │
│ ── NOTÍCIAS RECENTES ────────────  │
│ 🟢 "Expansão em Goiás" (3h atrás) │
│ 🔴 "Processo trabalhista" (1d)     │
│                                     │
│ ── CLIMA ATUAL ──────────────────  │
│ Próx. 3 dias: seco, 30-32°C       │
│ Janela favorável para visita.       │
│                                     │
│ ─────────────────────────────────  │
│ [📄 Exportar PDF] [📋 Copiar]      │
│ [📧 Enviar por email]              │
└────────────────────────────────────┘
```

**Ponto 2: Header do chat — botão 📋 (quando tem sessão ativa)**

Na barra de botões do header, ao lado do 📝 (DOC) e 📅 (follow-up):

```
Header do chat (quando hasReport):
┌─────────────────────────────────────────────────┐
│ ☰  Investigação: Fazenda XYZ   📝 📋 📅 | ⚔️ ⚙️│
└─────────────────────────────────────────────────┘
                                  ↑
                          Novo: Meeting Prep
```

- Mesmo estilo dos botões existentes (`p-1.5 text-sm`)
- Title: "Preparar briefing de reunião"
- Abre o mesmo drawer `MeetingBriefing`
- **Mobile**: os botões ficam apertados → 📋 vai pra dentro do SettingsDrawer como ação

### Layout Mobile — MeetingBriefing

```
Mobile — Drawer fullscreen:
┌────────────────────────────┐
│ ← Voltar    📋 Briefing    │
├────────────────────────────┤
│                             │
│ 🏢 FAZENDA XYZ              │
│ PORTA 78 · Exportadora     │
│                             │
│ ── CONTEXTO ──────────     │
│ Agropecuária de grande     │
│ porte, exportadora...      │
│                             │
│ ── PONTOS DE DOR ────      │
│ • Integração manual...     │
│ • Sem COMEX integrado...   │
│                             │
│ ── OBJEÇÕES ─────────      │
│ • "Migração arriscada"     │
│   → Senior oferece...      │
│                             │
│ ── PERGUNTAS-CHAVE ──      │
│ 1. Quantas fazendas?       │
│ 2. Volume exportação?      │
│                             │
│ ─────────────────────      │
│ [📄 PDF] [📋 Copiar]       │
│ [📧 Email]                  │
└────────────────────────────┘
```

- **Fullscreen** no mobile (mesmo padrão do War Room)
- **Scroll** nativo vertical
- **Botões de ação** fixos no bottom
- **← Voltar**: fecha o drawer (não é necessário confirmar)

### Interação e Comportamento

1. **Geração one-shot**: ao abrir, Gemini gera o briefing completo de uma vez
2. **Dados consolidados automaticamente**:
   - Score PORTA + justificativas (se disponível)
   - Dados cadastrais (CNPJ, cidade, UF, website)
   - Notas do CRM (prospecção, Spotter)
   - Sessões vinculadas (resumo das investigações)
   - COMEX profile (se exportadora)
   - News Radar (últimas notícias)
   - Clima (próximos dias)
   - Concorrentes detectados
3. **Cache**: briefing cacheado por card+timestamp, expira em 4h
4. **Loading**: skeleton com seções placeholder + mensagem "Preparando briefing..."
5. **Exportar PDF**: reutiliza `jspdf` já instalado — one-pager A4
6. **Copiar**: clipboard como texto formatado
7. **Email**: reutiliza o fluxo do `EmailModal` com o conteúdo do briefing
8. **Regenerar**: botão discreto no topo para forçar nova geração

### Prompt para o Gemini

```
Você é um preparador de reuniões comerciais para o agronegócio.
Com base nos dados abaixo, gere um BRIEFING DE REUNIÃO estruturado.

DADOS DA EMPRESA:
{nome, cnpj, cidade, UF, website}

SCORE PORTA: {score}/100 ({segmento})
{justificativas por dimensão}

PERFIL COMEX: {exportadora? faixa? produtos?}

NOTAS CRM:
{prospectionNotes}
{spotterRaw}

CONCORRENTES DETECTADOS:
{lista de ERPs/softwares identificados}

NOTÍCIAS RECENTES:
{resumo de notícias com sentimento}

CLIMA PRÓXIMOS DIAS:
{previsão resumida}

FORMATO DO BRIEFING:
## CONTEXTO (2-3 frases sobre a empresa)
## PONTOS DE DOR (3-5 bullets com oportunidades de venda)
## OBJEÇÕES PROVÁVEIS (2-3 objeções com respostas sugeridas)
## PERGUNTAS-CHAVE (3-5 perguntas para fazer na reunião)
## RESUMO DE NOTÍCIAS (se houver)
## CONDIÇÃO CLIMÁTICA (1 frase sobre janela de visita)

Seja direto, objetivo, em português. Foco em gerar insights acionáveis.
```

### Componentes a criar

| Arquivo | Responsabilidade |
|---|---|
| `components/MeetingBriefing.tsx` | Drawer de briefing (principal) |
| `services/meetingPrepService.ts` | Consolidação de dados + prompt Gemini + cache |

### Fluxo de dados

```
MeetingBriefing.tsx
  → meetingPrepService.consolidateData(card, sessions)
    ├── card.latestScorePorta
    ├── card.stages.prospeccao.crmNotes
    ├── card.stages.prospeccao.technicalNotes (Spotter)
    ├── comexService.getComexProfile(cnpj)
    ├── newsRadarService (cache ou fetch)
    ├── weatherService (cache ou fetch)
    └── sessions[].messages (resumo)
  → meetingPrepService.generateBriefing(consolidatedData)
    → sendMessageToGemini(prompt, [], systemPrompt)
  → MeetingBriefing renders markdown result
```

---

## Resumo Comparativo UX — Features 4 e 5

| Feature | Superfície principal | Superfície secundária | Ansiedade | Usabilidade |
|---|---|---|---|---|
| COMEX Profiler | Card inline no chat | Card compacto no CRM Detail | Muito baixa (contextual) | Alta (zero navegação) |
| Meeting Prep | Drawer no CRM Detail | Botão 📋 no header do chat | Baixa (ação explícita) | Alta (one-click → briefing) |

### Decisão-chave: nenhuma feature cria navegação nova

- COMEX usa o mesmo padrão do WeatherInsight (card inline)
- Meeting Prep usa o mesmo padrão do SettingsDrawer (drawer lateral)
- Ambos se conectam ao CRM Detail que já é o "hub" da empresa

---

## Ordem de Implementação

### Fase 1: Services
1. `services/comexService.ts` — fetch API + cache + fallback local dev
2. `services/meetingPrepService.ts` — consolidação + prompt Gemini + cache

### Fase 2: Componentes
3. `components/ComexProfile.tsx` — card visual (inline + compacto)
4. `components/MeetingBriefing.tsx` — drawer de briefing

### Fase 3: Integração
5. `ComexProfile` no `MessageRow.tsx` (inline, após CNPJ detectado)
6. `ComexProfile` compacto no `CRMDetail.tsx` (coluna direita)
7. Botão "Preparar Reunião" no footer do `CRMDetail.tsx`
8. Botão 📋 no header do `ChatInterface.tsx`
9. `MeetingBriefing` como drawer lazy-loaded

### Fase 4: Testes
10. Testes unitários para comexService e meetingPrepService
