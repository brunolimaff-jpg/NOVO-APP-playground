# Planejamento UX — Features 6-9: Inteligência Estratégica

> Features 1-5 já implementadas (Clima, News Radar, Market Pulse, COMEX, Meeting Prep).

## Princípios de Design (mantidos)

1. **Progressive Disclosure** — informação sob demanda
2. **Zero Anxiety** — não compete com o fluxo principal
3. **Contextual Relevance** — dados aparecem onde fazem sentido
4. **Mobile-first** — funciona em tela pequena
5. **Consistent Patterns** — reutilizar drawers, cards, badges existentes

---

## Feature 6: 🌾 Calendário Safra Inteligente

### O que é

Timeline visual das janelas de plantio e colheita por cultura (soja, milho, café, cana, algodão, trigo) e por região/UF. Cruza com clima atual e estágio do funil para indicar o **melhor timing de abordagem**.

### Por que é estratégico

- No agronegócio, timing é tudo: durante colheita, o produtor NÃO recebe vendedor
- AE que conhece o calendário da safra demonstra domínio do setor
- Cruza com dados já existentes: clima (Open-Meteo), localização (UF do card)

### Dados

- **Fonte primária**: dados estáticos CONAB — calendário agrícola por cultura e região
  - Estrutura: `{ crop: string, region: string, plantingStart: number, plantingEnd: number, harvestStart: number, harvestEnd: number }`
  - ~30 combinações (6 culturas x 5 regiões macro)
- **Enriquecimento**: Open-Meteo (clima atual) já disponível via `weatherService.ts`
- **Sem API externa necessária** — dados estáticos atualizados anualmente

### Decisão UX: Onde colocar

#### Onde NÃO colocar
- **NÃO** como página standalone → é contextual, sobre UMA empresa/região
- **NÃO** no kanban → informação complexa demais para card

#### Onde colocar: 2 superfícies

**Ponto 1: Seção no MeetingBriefing drawer**

Quando o briefing é gerado, uma seção "Janela Safra" aparece com a timeline da região da empresa:

```
MeetingBriefing drawer:
│ ── JANELA SAFRA ──────────────────── │
│                                       │
│ Região: MT (Mato Grosso)             │
│                                       │
│ Soja   [████████░░░░] Set-Jan → Fev-Mai │
│ Milho  [░░████████░░] Jan-Mar → Jun-Ago │
│ Algodão[░░░░████████] Nov-Jan → Mai-Jul │
│         J F M A M J J A S O N D      │
│                       ▲               │
│                   Hoje (Mar)           │
│                                       │
│ 💡 Colheita da soja em andamento.     │
│ Janela de abordagem ideal: abril.     │
│ Evite visitas durante plantio (set).  │
└───────────────────────────────────────┘
```

**Ponto 2: Card compacto no CRM Detail (coluna direita)**

Abaixo do COMEX Profile, um card resumido:

```
CRM Detail — coluna direita:
┌──────────────────────────────┐
│ 🌾 Safra — MT                │
│ Soja: colheita (Fev-Mai) ← agora │
│ 💡 Janela ideal: Abr-Mai     │
└──────────────────────────────┘
```

### Layout Mobile

- Timeline horizontal com scroll (touch-friendly)
- Card compacto: mesma info, stacked verticalmente
- Cores: `bg-amber-50/30 dark:bg-amber-950/20` (terra/agrícola)

### Componentes a criar

| Arquivo | Responsabilidade |
|---|---|
| `utils/safraCalendar.ts` | Dados estáticos CONAB + lógica de timing + helper de recomendação |
| `components/SafraTimeline.tsx` | Visualização timeline + card compacto CRM |

### Integração

1. `SafraTimeline` compacto no CRM Detail (coluna direita, abaixo COMEX)
2. `meetingPrepService.ts` enriquece com dados de safra no prompt
3. Sem chamada de API — dados estáticos locais

---

## Feature 7: 🏭 Raio-X Setorial (Industry Intelligence)

### O que é

Análise profunda do SETOR da empresa-alvo: tamanho de mercado, tendências, nível de adoção tecnológica, players principais, ameaças e oportunidades. Posiciona os módulos Senior contra as dores específicas daquele setor.

### Por que é estratégico

- AE que entende o mercado do prospect melhor que o próprio prospect ganha confiança
- Diferentes setores têm dores completamente diferentes (agropecuária ≠ agroindústria ≠ distribuidor)
- Gera insights que NÃO estão nos dados da empresa, mas no contexto de mercado

### Dados

- **Fonte primária**: Gemini + Google Search grounding (busca em tempo real)
- **CNAE**: disponível via BrasilAPI quando CNPJ validado (já usado em `api/comex.ts`)
- **Cache**: localStorage por CNAE, TTL 12h (dados setoriais mudam lentamente)

### Decisão UX: Onde colocar

#### Onde NÃO colocar
- **NÃO** inline no chat → é denso demais para uma mensagem
- **NÃO** como seção no MeetingBriefing → o briefing já é longo, raio-x é análise separada

#### Onde colocar: Drawer dedicado

**Botão "🏭 Raio-X Setorial" no CRM Detail footer** (ao lado do 📋 Preparar Reunião)

Abre drawer direito (mesmo padrão MeetingBriefing):

```
Desktop — SectorAnalysis Drawer (w-[28rem]):
┌───────────────────────────────────────┐
│ 🏭 Raio-X Setorial             [✕]   │
│ ─────────────────────────────────────│
│                                       │
│ 🏢 Scheffer · CNAE 01.11-3           │
│ Cultivo de cereais                    │
│                                       │
│ ── VISÃO DO SETOR ──────────────     │
│ O setor de cultivo de cereais no      │
│ Brasil movimenta R$ XX bi/ano,        │
│ com crescimento de X% a.a. ...        │
│                                       │
│ ── TENDÊNCIAS ──────────────────     │
│ • Agricultura de precisão em alta     │
│ • Consolidação de fazendas médias     │
│ • Digitalização de gestão de campo    │
│                                       │
│ ── ADOÇÃO TECNOLÓGICA ──────────     │
│ 📊 Nível: Médio-Alto                 │
│ • ERP: 60% das empresas do porte     │
│ • WMS: 35% (oportunidade)            │
│ • BI/Analytics: 25% (gap grande)     │
│                                       │
│ ── MÓDULOS SENIOR RELEVANTES ───     │
│ 🎯 ERP Industrial: aderência alta    │
│ 🎯 WMS: diferencial competitivo      │
│ 🎯 BI: janela de oportunidade        │
│ ⚠️ COMEX: se exportadora (sim)       │
│                                       │
│ ── RISCOS E AMEAÇAS ───────────      │
│ • Dependência de commodities          │
│ • Câmbio e logística                  │
│                                       │
│ ─────────────────────────────────    │
│ Gerado às 14:32 · CNAE 01.11-3      │
│ [📄 Exportar]    [📋 Copiar]         │
└───────────────────────────────────────┘
```

### Layout Mobile

- Drawer fullscreen (padrão MeetingBriefing)
- Scroll vertical natural
- Botões de ação fixos no bottom

### Dados necessários do CRMCard

- `cnpj` → para buscar CNAE via BrasilAPI
- `companyName` → contexto para Gemini
- `briefDescription` → enriquece a busca

**Gap identificado**: CRMCard não tem campo `cnae`. Solução:
- Buscar CNAE via BrasilAPI durante geração (já é feito na validação de CNPJ)
- Cachear resultado no service, não no card (evita migração de schema)

### Componentes a criar

| Arquivo | Responsabilidade |
|---|---|
| `services/sectorAnalysisService.ts` | Busca CNAE + prompt Gemini + cache |
| `components/SectorAnalysis.tsx` | Drawer com resultado renderizado |

### Prompt para Gemini

```
Você é um analista de inteligência de mercado especializado em agronegócio brasileiro.

EMPRESA: {companyName}
CNAE: {cnaeCode} — {cnaeDescription}
LOCALIZAÇÃO: {city}, {state}
PORTE ESTIMADO: {briefDescription}

Gere um RAIO-X SETORIAL com:

## Visão do Setor
Tamanho de mercado, crescimento, posição do Brasil, players principais.

## Tendências
3-5 tendências macro que afetam esse setor AGORA.

## Adoção Tecnológica
Nível de digitalização, % de empresas com ERP, gaps tecnológicos comuns.

## Módulos Senior Relevantes
Quais módulos Senior (ERP, WMS, Manufatura, Fiscal, RH, BI, COMEX) são mais aderentes
para esse setor e por quê. Use 🎯 para alta aderência, ⚠️ para situacional.

## Riscos e Ameaças
Fatores que podem dificultar a venda ou criar urgência.

Use Google Search para dados atualizados. Seja factual e cite fontes quando possível.
Foco em insights acionáveis para um vendedor de ERP.
```

---

## Feature 8: ⚖️ Radar Regulatório & Compliance

### O que é

Varredura inteligente do cenário regulatório que afeta a empresa-alvo: obrigações fiscais (SPED, REINF, NFe), trabalhistas (eSocial), ambientais (CAR, outorga), LGPD, e setor-específicas. Transforma compliance em **argumento de venda** — urgência real.

### Por que é estratégico

- Compliance NÃO é opcional — cria urgência legítima que o AE pode usar
- Regulações mudam constantemente — IA com Search grounding captura mudanças em tempo real
- Posiciona Senior como solução de conformidade, não só "mais um ERP"

### Dados

- **Fonte primária**: Gemini + Google Search grounding (legislação vigente)
- **Contexto**: CNAE, UF, porte, COMEX status (exportadora tem obrigações extras)
- **Cache**: localStorage por CNPJ, TTL 6h (regulações mudam, mas não por minuto)

### Decisão UX: Onde colocar

#### Onde NÃO colocar
- **NÃO** como drawer separado → fragmenta demais a experiência
- **NÃO** inline no chat → conteúdo denso, não conversacional

#### Onde colocar: Seção dentro do Raio-X Setorial + Card no CRM Detail

**Ponto 1: Seção dedicada no drawer do Raio-X Setorial**

Após "Riscos e Ameaças", uma seção "Radar Regulatório":

```
SectorAnalysis Drawer (continuação):
│                                       │
│ ── RADAR REGULATÓRIO ───────────     │
│                                       │
│ 🔴 URGENTE                           │
│ ┌─────────────────────────────────┐  │
│ │ REINF — Série R-4000            │  │
│ │ Obrigatório desde Jan/2024      │  │
│ │ Módulo Fiscal Senior: resolve   │  │
│ │ ⏰ Multa por descumprimento     │  │
│ └─────────────────────────────────┘  │
│                                       │
│ 🟡 ATENÇÃO                           │
│ ┌─────────────────────────────────┐  │
│ │ eSocial — SST (Saúde/Segurança) │  │
│ │ Eventos S-2210/S-2220/S-2240    │  │
│ │ Módulo RH Senior: aderente      │  │
│ └─────────────────────────────────┘  │
│                                       │
│ 🟢 INFORMATIVO                       │
│ ┌─────────────────────────────────┐  │
│ │ LGPD — Tratamento de dados      │  │
│ │ Em vigor desde 2020              │  │
│ │ Revisão de processos sugerida    │  │
│ └─────────────────────────────────┘  │
│                                       │
│ 💡 Use as obrigações 🔴 como gatilho │
│ de urgência na reunião.               │
```

**Ponto 2: Badge de urgência no CRM Detail**

Card compacto na coluna direita (abaixo da Safra):

```
CRM Detail — coluna direita:
┌──────────────────────────────┐
│ ⚖️ Compliance                │
│ 🔴 2 obrigações urgentes     │
│ REINF R-4000 · eSocial SST   │
│ 💡 Use como gatilho de venda  │
└──────────────────────────────┘
```

### Layout Mobile

- Dentro do drawer do Raio-X: scroll natural
- Card CRM: full-width, mesmo padrão dos outros cards
- Cards de regulação: tappable para expandir detalhes

### Componentes a criar

| Arquivo | Responsabilidade |
|---|---|
| `services/regulatoryService.ts` | Busca via Gemini + Search + cache por CNPJ |
| `components/RegulatoryRadar.tsx` | Cards de urgência (🔴🟡🟢) + versão compacta CRM |

### Integração

- Dados regulatórios são buscados JUNTO com o Raio-X Setorial (mesma chamada Gemini otimizada)
- O service pode unificar: `sectorAnalysisService.ts` gera TANTO o raio-x quanto o radar regulatório
- Componente `RegulatoryRadar.tsx` renderiza de forma independente para reuso

### Prompt para Gemini (parte do prompt do Raio-X)

```
## Radar Regulatório
Liste as 3-5 principais obrigações regulatórias que afetam esta empresa:
- Classifique cada uma como 🔴 URGENTE, 🟡 ATENÇÃO ou 🟢 INFORMATIVO
- Para cada uma, indique qual módulo Senior resolve
- Foque em: SPED, REINF, NFe, eSocial (SST, folha), LGPD, CAR (se agro),
  Siscomex (se exportadora), NR-31 (se rural)
- Use Google Search para verificar datas e prazos vigentes
```

---

## Feature 9: 📊 Inteligência Competitiva do Prospect

### O que é

Análise do mercado DO prospect (não da Senior): quem são os concorrentes do prospect, como ele está posicionado, e como a Senior pode ajudá-lo a ganhar vantagem competitiva. Diferente do War Room (Senior vs concorrentes) — aqui é sobre o JOGO COMPETITIVO DO CLIENTE.

### Por que é estratégico

- AE que entende os concorrentes do prospect fala a língua do CEO
- Cria argumentos de venda baseados em competitividade, não em features
- "Seus concorrentes já usam ERP integrado — ficar sem é risco competitivo"

### Dados

- **Fonte primária**: Gemini + Google Search grounding
- **COMEX**: se concorrentes do prospect também exportam (dados já no sistema)
- **News Radar**: cruzar notícias de concorrentes do prospect
- **Cache**: localStorage por companyName, TTL 8h

### Decisão UX: Onde colocar

#### Onde NÃO colocar
- **NÃO** em drawer separado → já teremos Raio-X e MeetingBriefing como drawers
- **NÃO** como modal → interrompe o fluxo

#### Onde colocar: Seção dentro do Raio-X Setorial

É naturalmente complementar ao Raio-X — no mesmo drawer, após as tendências:

```
SectorAnalysis Drawer (continuação):
│                                       │
│ ── COMPETIDORES DO PROSPECT ────     │
│                                       │
│ Scheffer compete com:                 │
│                                       │
│ ┌─────────────────────────────────┐  │
│ │ 🏢 SLC Agrícola                 │  │
│ │ Porte: superior · 📈 crescendo  │  │
│ │ Tech: SAP S/4HANA               │  │
│ │ COMEX: exportadora US$ 100M+    │  │
│ │ ⚠️ "Scheffer precisa de ERP     │  │
│ │ integrado para competir"        │  │
│ └─────────────────────────────────┘  │
│                                       │
│ ┌─────────────────────────────────┐  │
│ │ 🏢 Amaggi                       │  │
│ │ Porte: superior · 📈 crescendo  │  │
│ │ Tech: TOTVS + sistemas próprios │  │
│ │ COMEX: exportadora US$ 500M+    │  │
│ └─────────────────────────────────┘  │
│                                       │
│ 💡 ARGUMENTO DE VENDA:               │
│ "Seus principais concorrentes já     │
│ operam com ERP integrado. A Senior   │
│ pode eliminar esse gap em 6 meses."  │
```

### Layout Mobile

- Cards de concorrentes stackados verticalmente
- Scroll natural dentro do drawer fullscreen
- Cores: `bg-purple-50/30 dark:bg-purple-950/20` (diferente do COMEX)

### Integração técnica

**Decisão-chave: unificar com Raio-X Setorial**

Em vez de 3 services separados (setor + regulatório + competitivo), criar UM service robusto:

```
sectorAnalysisService.ts
  → fetchCnaeFromBrasilAPI(cnpj)
  → generateSectorAnalysis(companyName, cnae, city, state, comexData)
    → Gemini prompt com 4 seções:
      1. Visão do Setor
      2. Tendências + Adoção Tech + Módulos Senior
      3. Radar Regulatório (com urgências)
      4. Competidores do Prospect
    → Parse do resultado em seções estruturadas
  → Cache por CNPJ (12h TTL)
```

### Componentes a criar

| Arquivo | Responsabilidade |
|---|---|
| `components/CompetitorIntel.tsx` | Cards de concorrentes do prospect |

### Prompt para Gemini (parte do prompt unificado)

```
## Competidores do Prospect
Identifique 2-4 concorrentes diretos de {companyName} no setor {cnaeDescription}.
Para cada um:
- Nome e porte relativo (superior/similar/inferior)
- Nível de adoção tecnológica (qual ERP/sistema usam, se público)
- Status COMEX (se exportador)
- Uma frase de impacto para o vendedor usar na reunião

Finalize com um ARGUMENTO DE VENDA que conecte a vantagem competitiva ao uso de ERP Senior.
```

---

## Arquitetura Unificada — Raio-X + Regulatório + Competitivo

As features 7, 8 e 9 são seções de UM ÚNICO drawer ("Raio-X Setorial") alimentado por UM ÚNICO service.

### Service unificado: `sectorAnalysisService.ts`

```typescript
interface SectorAnalysisData {
  companyName: string;
  cnae: { code: string; description: string } | null;
  sectorOverview: string;       // Markdown — Visão do Setor
  trends: string;               // Markdown — Tendências
  techAdoption: string;         // Markdown — Adoção Tech + Módulos Senior
  regulatoryItems: RegulatoryItem[];  // Estruturado — Radar Regulatório
  competitors: CompetitorInfo[];      // Estruturado — Competidores
  generatedAt: number;
}

interface RegulatoryItem {
  name: string;
  level: 'urgent' | 'attention' | 'info';
  description: string;
  seniorModule: string;
}

interface CompetitorInfo {
  name: string;
  relativeSize: string;
  techStack: string;
  comexStatus: string;
  insight: string;
}
```

### Fluxo

```
SectorAnalysis.tsx (drawer)
  → sectorAnalysisService.generateAnalysis(cnpj, companyName, ...)
    ├── fetchCnae(cnpj) via BrasilAPI
    ├── comexService.fetchComexProfile(cnpj) se não cached
    └── Gemini + Search grounding (1 chamada com prompt grande)
        → Parse JSON estruturado das seções
  → Renderiza:
    ├── SectorOverview (markdown)
    ├── TechAdoption (markdown)
    ├── RegulatoryRadar (cards 🔴🟡🟢)
    └── CompetitorIntel (cards de concorrentes)
```

### Componente drawer: `SectorAnalysis.tsx`

Drawer lateral direito (mesmo padrão MeetingBriefing):
- Header: "🏭 Raio-X Setorial" + empresa + CNAE
- Body: 4 seções com separadores visuais
- Footer: Exportar + Copiar
- Mobile: fullscreen
- Desktop: `w-full sm:w-96 md:w-[32rem]` (um pouco mais largo que MeetingBriefing por ter mais conteúdo)

---

## Resumo da Implementação

### Fase 1: Dados e Services

| Arquivo | Feature | Responsabilidade |
|---|---|---|
| `utils/safraCalendar.ts` | Safra | Dados estáticos CONAB + lógica de timing |
| `services/sectorAnalysisService.ts` | Raio-X + Regulatório + Competitivo | Busca CNAE + Gemini unificado + cache |

### Fase 2: Componentes

| Arquivo | Feature | Responsabilidade |
|---|---|---|
| `components/SafraTimeline.tsx` | Safra | Timeline visual + card compacto CRM |
| `components/SectorAnalysis.tsx` | Raio-X | Drawer principal com 4 seções |
| `components/RegulatoryRadar.tsx` | Regulatório | Cards de urgência (sub-componente) |
| `components/CompetitorIntel.tsx` | Competitivo | Cards de concorrentes (sub-componente) |

### Fase 3: Integração

1. `SafraTimeline` compacto no CRM Detail (coluna direita)
2. `meetingPrepService.ts` enriquece briefing com dados de safra
3. Botão "🏭 Raio-X Setorial" no CRM Detail footer
4. `SectorAnalysis` como drawer lazy-loaded
5. `RegulatoryRadar` compacto no CRM Detail (coluna direita)

### Ordem sugerida de implementação

```
1. safraCalendar.ts (sem dependência, dados estáticos)
2. SafraTimeline.tsx + integração CRM Detail
3. sectorAnalysisService.ts (Gemini + CNAE + cache)
4. RegulatoryRadar.tsx + CompetitorIntel.tsx (sub-componentes)
5. SectorAnalysis.tsx (drawer principal)
6. Integração: CRM Detail footer + drawer lazy-loaded
7. Enriquecer meetingPrepService com safra + regulatório
```

---

## Impacto Resumido

| # | Feature | Impacto | Surface | Tech |
|---|---------|---------|---------|------|
| 6 | Calendário Safra | **ALTO** | CRM Detail + MeetingBriefing | Dados estáticos CONAB |
| 7 | Raio-X Setorial | **ALTO** | Drawer dedicado | Gemini + BrasilAPI + Search |
| 8 | Radar Regulatório | **ALTO** | Dentro do Raio-X + CRM Detail | Gemini + Search grounding |
| 9 | Intel Competitiva | **ALTO** | Dentro do Raio-X | Gemini + Search grounding |
