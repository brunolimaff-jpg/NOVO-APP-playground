# Planejamento UX — Features 1, 2 e 3

## Princípios de Design Adotados

1. **Progressive Disclosure** — informação aparece sob demanda, nunca sobrecarrega
2. **Zero Anxiety** — nenhum elemento novo compete com o fluxo principal de chat
3. **Contextual Relevance** — dados aparecem QUANDO e ONDE fazem sentido
4. **Mobile-first** — toda feature funciona perfeitamente em tela pequena
5. **Consistent Patterns** — reutilizar padrões visuais que o usuário já conhece (drawers, cards, badges)

---

## Feature 1: Clima & Safra Intelligence

### Onde NÃO colocar
- **NÃO** como widget fixo na sidebar — polui visualmente, compete com sessões
- **NÃO** como painel lateral permanente — ocupa espaço precioso no desktop
- **NÃO** como modal popup — interrompe o fluxo de trabalho

### Onde colocar (decisão UX)

**Abordagem: Inline Contextual Card dentro do chat**

O clima aparece DENTRO do fluxo de conversa, como um card rico renderizado após o bot mencionar uma empresa com município identificado. Isso é natural porque:
- O usuário já está focado no chat
- O dado climático tem contexto imediato (a empresa sendo analisada)
- Não exige navegação extra nem nova área na interface

### Layout Desktop (>768px)

```
┌─────────────────────────────────────────────────┐
│ 🤖 Bot Message: "Análise da Fazenda XYZ..."     │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ 🌤️ Clima — Ribeirão Preto, SP               │ │
│ │                                               │ │
│ │ Hoje  Seg   Ter   Qua   Qui   Sex   Sáb     │ │
│ │ 32°   30°   28°   31°   33°   29°   27°     │ │
│ │ ☀️    🌤️    🌧️    ☀️    ☀️    🌧️    🌤️      │ │
│ │ ▁▃▅▇█▇▅▃▁▃▅▇  ← chuva (mm) mini-gráfico    │ │
│ │                                               │ │
│ │ 💡 Gemini: "Período seco nos próximos 5      │ │
│ │ dias favorece colheita de soja. Janela ideal  │ │
│ │ para visita técnica."                         │ │
│ │                                     [▾ mais]  │ │
│ └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

- **Largura**: 100% do bubble do bot (max-w-3xl herdado)
- **Altura collapsed**: ~120px (previsão compacta + insight IA)
- **Altura expanded**: ~220px (detalhes: umidade, vento, UV, histórico)
- **Cores**: fundo `bg-sky-50/50 dark:bg-sky-950/30`, borda `border-sky-200/50`
- **Ícones**: emoji nativos (sem dependência extra)
- **Mini-gráfico de chuva**: barras SVG inline, 7 dias, altura proporcional

### Layout Mobile (<768px)

```
┌────────────────────────────┐
│ 🌤️ Clima — Rib. Preto, SP │
│                             │
│ Hoje 32° ☀️  Seg 30° 🌤️    │
│ Ter  28° 🌧️  Qua 31° ☀️    │
│ ▁▃▅▇█▇▅  chuva (mm)        │
│                             │
│ 💡 "Período seco favorece  │
│ colheita..."    [▾ mais]    │
└────────────────────────────┘
```

- **Grid de dias**: 2 colunas (em vez de 7 inline)
- **Insight IA**: truncado em 2 linhas com "ver mais"
- **Touch target**: card inteiro é tappable para expandir (min 44px)
- **Sem scroll horizontal**: tudo cabe na viewport

### Interação e Comportamento

1. **Trigger automático**: quando o Gemini detecta município na análise, injeta o card clima após a resposta
2. **Trigger manual**: botão discreto `🌤️` no header do chat (ao lado do ⚔️ War Room), abre input de cidade
3. **Cache**: 30 min (Open-Meteo atualiza a cada hora)
4. **Offline**: mostra último dado cacheado com badge "dados de X min atrás"
5. **Animação**: fade-in suave (300ms), consistente com `animate-fade-in` existente
6. **Expandir/Colapsar**: chevron `▾`/`▴`, transição height 200ms ease

### Componentes a criar

| Arquivo | Responsabilidade |
|---|---|
| `components/WeatherInsight.tsx` | Card visual (apresentação) |
| `services/weatherService.ts` | Fetch Open-Meteo + cache + parse |
| `utils/weatherUtils.ts` | Mapear códigos WMO → emoji, formatar dados |

### API Open-Meteo — Endpoint

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=-21.17&longitude=-47.81
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode
  &timezone=America/Sao_Paulo
  &forecast_days=7
```

Sem chave. Sem rate limit agressivo. Resposta ~2KB.

Para converter cidade → coordenadas:
```
GET https://geocoding-api.open-meteo.com/v1/search
  ?name=Ribeirão+Preto&country=BR&count=1
```

### Integração com Gemini

Após receber os dados climáticos, incluir no prompt do Gemini:
```
[CONTEXTO CLIMÁTICO - {cidade}]
Previsão 7 dias: {dados formatados}
Analise o impacto climático na operação agrícola desta empresa.
Considere: janela de plantio/colheita, riscos, oportunidade de visita.
```

---

## Feature 2: News Radar em Tempo Real

### Onde NÃO colocar
- **NÃO** como feed separado/página nova — fragmenta a experiência
- **NÃO** como notificações push constantes — gera ansiedade
- **NÃO** como ticker/marquee no topo — distrai do foco principal

### Onde colocar (decisão UX)

**Abordagem Dupla: Badge no CRM + Seção expandível no CRM Detail**

O News Radar é sobre MONITORAMENTO de empresas do pipeline. O lugar natural é o CRM, onde o usuário já gerencia seus prospects.

#### Ponto 1: Badge no card do Kanban

```
┌─────────────────────────┐
│ Fazenda XYZ     PORTA 78│
│ Agropecuária grande...  │
│ 🟢 Saudável   🔴 2 news │  ← badge vermelho = notícia negativa
│ Atualizado há 2h        │     badge verde = notícia positiva
└─────────────────────────┘     badge cinza = neutro
```

- **Badge pequeno**: `rounded-full px-2 py-0.5 text-xs` — não compete com o score PORTA
- **Cores semânticas**: 🔴 negativo, 🟢 positivo, ⚪ neutro (consistente com health do CRM)
- **Número**: quantidade de notícias novas desde última visualização
- **Sem animação piscante**: badge estático, sem pulse — reduz ansiedade

#### Ponto 2: Seção no CRM Detail (principal)

```
Desktop CRM Detail (right panel):
┌─────────────────────────────────────┐
│ 📋 Fazenda XYZ                      │
│ ─────────────────────────────────── │
│ [Info] [Notas] [Sessões] [📰 Radar]│  ← nova tab
│ ─────────────────────────────────── │
│                                      │
│ 📰 Radar de Notícias                │
│                                      │
│ ┌─ 🟢 Positiva · há 3h ──────────┐ │
│ │ "Fazenda XYZ expande operação   │ │
│ │ em Goiás com R$50M"             │ │
│ │ Fonte: Valor Econômico          │ │
│ │ 💡 Oportunidade: expansão pode  │ │
│ │ demandar novo ERP regional      │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─ 🔴 Negativa · há 1d ──────────┐ │
│ │ "Grupo XYZ enfrenta processo    │ │
│ │ trabalhista de R$2M"            │ │
│ │ Fonte: Folha de SP              │ │
│ │ 💡 Risco: pode atrasar decisão  │ │
│ │ de compra. Monitorar.           │ │
│ └─────────────────────────────────┘ │
│                                      │
│ [🔄 Atualizar] Última busca: 14:30  │
│ ⚙️ Monitoramento: [ON ●○ OFF]       │
└─────────────────────────────────────┘
```

### Layout Mobile

```
┌────────────────────────────┐
│ [Info][Notas][📰 Radar]    │  ← tabs scrolláveis
├────────────────────────────┤
│ 📰 Radar de Notícias       │
│                             │
│ 🟢 há 3h                   │
│ "Fazenda XYZ expande..."   │
│ Valor Econômico             │
│ 💡 Expansão = oportunidade  │
│ ───────────────────────     │
│ 🔴 há 1d                   │
│ "Processo trabalhista..."   │
│ Folha de SP                 │
│ 💡 Risco: atrasar compra   │
│                             │
│ [🔄 Atualizar]  14:30      │
└────────────────────────────┘
```

- Cards full-width, separados por divider sutil
- Scroll vertical nativo, sem paginação
- Touch: card tappable → abre link da fonte no browser

### Interação e Comportamento

1. **Busca via Gemini Grounding**: Google Search tool já disponível
2. **Frequência**: busca ao abrir CRM Detail (se última busca > 2h) ou botão manual
3. **Classificação**: Gemini analisa sentimento + relevância comercial
4. **Cache**: localStorage por CNPJ, expira em 2h
5. **Toggle**: `newsRadarEnabled` já existe no tipo `CRMCard` — ativar
6. **Limite**: máximo 5 notícias por empresa (evita overload)
7. **Estado vazio**: "Nenhuma notícia encontrada. Isso é bom!" (tom positivo)

### Componentes a criar

| Arquivo | Responsabilidade |
|---|---|
| `components/NewsRadar.tsx` | Seção de notícias no CRM Detail |
| `components/NewsBadge.tsx` | Badge compacto no card do Kanban |
| `services/newsRadarService.ts` | Busca via Gemini Grounding + parse + cache |

---

## Feature 3: Market Pulse — Painel Econômico

### Onde NÃO colocar
- **NÃO** como página separada → ninguém vai navegar até lá
- **NÃO** substituindo o EmptyStateHome → o form de nova investigação é essencial
- **NÃO** como sidebar permanente → compete com SessionsSidebar

### Onde colocar (decisão UX)

**Abordagem: Seção abaixo do form no EmptyStateHome + Pill compacta no header**

O Market Pulse é informação de "aquecimento" — o vendedor olha ao começar o dia. O EmptyState é a tela que ele vê primeiro.

#### Ponto 1: EmptyStateHome (principal)

```
Desktop EmptyStateHome:
┌─────────────────────────────────────────────────┐
│          🦅 Senior Scout 360                     │
│     "Bom dia, Bruno. Pronto pra campo?"         │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ [Nome da empresa]                             │ │
│ │ [CNPJ] [Validar]                              │ │
│ │ [Cidade          ] [UF]                       │ │
│ │ [        Iniciar Investigação        ]        │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ─── 📊 Pulso do Mercado ─────────────────────── │
│                                                  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ │
│ │ 💵    │ │ 💶    │ │ 📈    │ │ 🌾    │ │ 🌽     │ │
│ │Dólar  │ │Euro   │ │Selic  │ │Soja   │ │Milho   │ │
│ │R$5,12 │ │R$5,58 │ │14,25% │ │R$148  │ │R$72    │ │
│ │▲ 0,3% │ │▼ 0,1% │ │= 0%   │ │▲ 2,1% │ │▼ 0,5%  │ │
│ └──────┘ └──────┘ └──────┘ └──────┘ └────────┘ │
│                                                  │
│ 💡 "Dólar em alta favorece exportadores de soja. │
│ Considere priorizar prospects do segmento COP."  │
│                                     Atualiz. 9h  │
└─────────────────────────────────────────────────┘
```

- **Grid**: `grid-cols-5` desktop, `grid-cols-3` tablet, `grid-cols-2` mobile
- **Card**: `rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50`
- **Variação**: verde (▲ alta), vermelho (▼ baixa), cinza (= estável)
- **Insight IA**: uma frase do Gemini contextualizando para agronegócio

#### Ponto 2: Pill no Header (desktop only)

```
┌─────────────────────────────────────────────────┐
│ ☰  Investigação: Fazenda XYZ    💵5,12 🌾148    │
└─────────────────────────────────────────────────┘
```

- Apenas 2 indicadores: dólar + soja
- Clicável: abre popover com todos os indicadores
- **Mobile: NÃO mostrar** — espaço limitado, só no EmptyState

### Layout Mobile

```
┌────────────────────────────┐
│ ── 📊 Pulso do Mercado ──  │
│                             │
│ ┌────────┐ ┌────────┐      │
│ │ 💵 Dólar│ │ 💶 Euro │     │
│ │ R$5,12  │ │ R$5,58  │     │
│ │ ▲ 0,3%  │ │ ▼ 0,1%  │     │
│ └────────┘ └────────┘      │
│ ┌────────┐ ┌────────┐      │
│ │ 📈 Selic│ │ 🌾 Soja │     │
│ │ 14,25%  │ │ R$148   │     │
│ │ = 0%    │ │ ▲ 2,1%  │     │
│ └────────┘ └────────┘      │
│ ┌────────┐                  │
│ │ 🌽Milho │                 │
│ │ R$72    │                 │
│ │ ▼ 0,5%  │                 │
│ └────────┘                  │
│                             │
│ 💡 "Dólar em alta favorece │
│ exportadores de soja."      │
└────────────────────────────┘
```

### Interação e Comportamento

1. **Fetch ao montar EmptyState**: busca dados BACEN + commodities
2. **Cache**: 1 hora (dados macro não mudam em minutos)
3. **Fallback**: "Dados indisponíveis" com botão retry (sem travar UI)
4. **Loading**: skeleton shimmer nos cards
5. **Insight IA**: gerado 1x ao carregar, cacheado com os dados
6. **Sem auto-refresh**: atualiza só quando EmptyState remonta

### APIs Utilizadas

```
# Dólar (PTAX)
GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/2?formato=json

# Euro
GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.21619/dados/ultimos/2?formato=json

# Selic Meta
GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json

# IPCA mensal
GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/2?formato=json
```

Commodities (soja/milho): Gemini com grounding para preço atual como fallback.

### Componentes a criar

| Arquivo | Responsabilidade |
|---|---|
| `components/MarketPulse.tsx` | Grid de indicadores + insight IA |
| `components/MarketPulseCard.tsx` | Card individual de indicador |
| `components/MarketPulsePill.tsx` | Pill compacta no header (desktop) |
| `services/marketPulseService.ts` | Fetch BACEN + cache + variação % |

---

## Resumo Comparativo UX

| Feature | Superfície | Ansiedade | Usabilidade | Navegação nova? |
|---|---|---|---|---|
| Clima & Safra | Inline no chat | Muito baixa | Alta (zero cliques) | Não |
| News Radar | Badge CRM + Tab Detail | Baixa (estático) | Alta (no CRM) | Não |
| Market Pulse | EmptyState + pill header | Muito baixa (passivo) | Alta (visível) | Não |

**Princípio central: Nenhuma feature adiciona um novo "lugar" na interface.** Todas se encaixam em superfícies existentes.

---

## Ordem de Implementação

### Fase 1: Services (sem UI)
1. `services/weatherService.ts`
2. `services/newsRadarService.ts`
3. `services/marketPulseService.ts`

### Fase 2: Componentes visuais
4. `components/WeatherInsight.tsx`
5. `components/MarketPulse.tsx` + `MarketPulseCard.tsx`
6. `components/NewsRadar.tsx` + `NewsBadge.tsx`

### Fase 3: Integração
7. `WeatherInsight` no `MessageRow.tsx`
8. `MarketPulse` no `EmptyStateHome.tsx`
9. `NewsRadar` no `CRMDetail.tsx` (nova tab)
10. `NewsBadge` no `CRMPipeline.tsx`
11. `MarketPulsePill` no header do `ChatInterface.tsx`

### Fase 4: IA Enhancement
12. Prompt de clima no `geminiService.ts`
13. Prompt de notícias no `newsRadarService.ts`
14. Prompt de insight de mercado no `marketPulseService.ts`

### Fase 5: Testes
15. Testes unitários para os 3 services
16. Testes de componente para os cards visuais
