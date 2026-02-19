import { ChatMode } from "../constants";

// ==========================================
// 1. TIPOS E ESTRUTURAS
// ==========================================

export type Pillar = 'GATEC' | 'ERP' | 'HCM' | 'INTEGRACAO' | 'CONCILIACAO' | 'GERAL';

interface InsightDatabase {
  diretoria: string[];
  operacao: string[];
}

// Rastreamento global de fatos mostrados para evitar repetição
const shownFacts = new Set<string>();

export function resetShownFacts() {
  shownFacts.clear();
}

/**
 * Remove prefixos comuns (Você sabia?, Fato:, etc) para deixar a frase limpa.
 */
export function cleanFactPrefix(fact: string): string {
  return fact
    .replace(/^(Você sabia\?|Dado:|Fato:|Insight:|Radar:|Nota:|Contexto:|Tendência:|Curiosidade:)\s*/i, '')
    .replace(/^["']|["']$/g, '') // Remove aspas
    .trim();
}

/**
 * Obtém o próximo fato de um pool, garantindo não-repetição até esgotar o pool.
 */
export function getNextFact(pool: string[]): string {
  // Filtra apenas os que ainda não foram mostrados
  const available = pool.filter(f => !shownFacts.has(f));
  
  // Se todos foram mostrados, reseta para permitir repetição
  if (available.length === 0) {
    shownFacts.clear();
    const random = pool[Math.floor(Math.random() * pool.length)];
    shownFacts.add(random);
    return random;
  }

  // Escolhe aleatório entre os disponíveis
  const fact = available[Math.floor(Math.random() * available.length)];
  shownFacts.add(fact);
  
  return fact;
}

export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// ==========================================
// 2. BANCO DE FATOS INSTITUCIONAIS
// ==========================================

const SENIOR_FACTS = [
  "A Senior Sistemas atende mais de 13.000 grupos econômicos em 6 setores econômicos.",
  "Em 2025, a Senior adquiriu a CIGAM Software por R$ 162,5 milhões.",
  "A Senior possui parceria com o BTG Pactual através da Senior Capital.",
  "O ERP Senior consolida múltiplos CNPJs de um grupo em uma única visão contábil.",
  "O módulo fiscal do ERP Senior é atualizado automaticamente para mudanças na legislação.",
  "A Senior oferece integração nativa com SPED Fiscal, SPED Contábil, eSocial e EFD-Reinf.",
  "O HCM Senior gerencia contratos de safra com admissão e demissão em lote.",
  "O módulo de SST do HCM controla todas as NRs obrigatórias.",
  "A Senior integra agro (GAtec) + corporativo (ERP) + pessoas (HCM) em uma plataforma única.",
  "A Senior adquiriu a Mega Sistemas em 2018 e a Novasoft em 2021.",
  "O Senior Flow é a plataforma de hiperautomação com BPM, GED e assinatura digital.",
  "O CONNECT do Senior Flow cria APIs REST com agentes de IA.",
  "O Senior SIGN permite assinatura com certificado ICP-Brasil e reconhecimento facial.",
  "O Senior Flow atende mais de 1.500 empresas de médio e grande porte.",
  "O GED do Senior Flow organiza documentos com busca inteligente por IA."
].map(cleanFactPrefix);

const GATEC_FACTS = [
  "O SimpleFarm permite gestão completa de talhões e rastreabilidade lote-a-lote.",
  "O Mapfy oferece análise geoespacial com mapas de produtividade.",
  "O GAtec Industrial gerencia beneficiamento de algodão, café e grãos.",
  "A integração balança-campo elimina digitação manual no recebimento.",
  "O GAtec suporta agricultura de precisão com mapas de taxa variável.",
  "A rastreabilidade atende RTRS, GlobalGAP e RainForest Alliance.",
  "O GAtec controla operações de algodoeira com classificação HVI.",
  "O SimpleFarm acompanha custos por talhão, safra e cultura.",
  "O módulo de armazenagem controla silos com secagem e expedição.",
  "O GAtec se integra nativamente ao ERP Senior.",
  "O Mapfy cruza dados de múltiplas safras para análise de tendência.",
  "O GAtec gerencia planejamento de insumos por talhão.",
  "A gestão de colheita conecta dados da colhedora em tempo real.",
  "O GAtec suporta operações multi-fazenda em uma única instância.",
  "Dashboards mostram custo/ha, produtividade/ha e margem por cultura."
].map(cleanFactPrefix);

const AGRO_FACTS = [
  "O Mato Grosso responde por 17% do VBP do agro brasileiro — Fonte: IBGE, 2024.",
  "O Brasil exportou mais de 100 milhões de toneladas de soja em 2024 — Fonte: CONAB.",
  "O setor agropecuário brasileiro cresceu 15,1% em 2023 — Fonte: IBGE.",
  "A safra brasileira de grãos deve atingir 298 milhões de toneladas — Fonte: CONAB.",
  "O Brasil é o maior exportador de soja do mundo.",
  "O agronegócio representa cerca de 25% do PIB brasileiro.",
  "O Mato Grosso lidera a produção nacional de soja e algodão.",
  "O Rio Grande do Sul é o maior produtor de arroz irrigado do Brasil.",
  "O Paraná é o maior produtor de trigo e milho safrinha.",
  "O cerrado brasileiro é a fronteira agrícola mais expansiva do mundo."
].map(cleanFactPrefix);

// ==========================================
// 3. BANCO DE STATUS E CURIOSIDADES
// ==========================================

export const INSIGHTS: Record<Pillar, InsightDatabase> = {
  GATEC: {
    diretoria: shuffleArray([
      "Consultando dados de rastreabilidade agrícola...",
      "Verificando certificações RTRS e GlobalGAP...",
      "Mapeando tecnologias de campo e maquinário...",
      ...GATEC_FACTS,
      ...AGRO_FACTS.slice(0, 3)
    ]),
    operacao: shuffleArray([
      "Contando os alqueires da fazenda...",
      "Vendo se tem tecnologia ou só caderno de campo...",
      "Checando se o trator é novo ou tá no arame...",
      "Olhando a qualidade da semente...",
      "Vendo se usam mapa de produtividade ou só olhômetro...",
      "Contando os pivôs de irrigação...",
      "Olhando a frota de colheitadeiras..."
    ])
  },
  ERP: {
    diretoria: shuffleArray([
      "Consultando situação fiscal e tributária...",
      "Verificando compliance e obrigações acessórias...",
      "Cruzando dados de faturamento e porte...",
      ...SENIOR_FACTS.filter(f => f.includes('ERP') || f.includes('Senior') || f.includes('fiscal'))
    ]),
    operacao: shuffleArray([
      "Vendo se o Leão tá mordendo...",
      "Caçando nota fiscal perdida...",
      "Olhando se o sistema atual é gambiarra...",
      "Conferindo o caixa e os boletos...",
      "Checando se consolidam balanço no Excel..."
    ])
  },
  HCM: {
    diretoria: shuffleArray([
      "Estimando quadro de colaboradores...",
      "Verificando passivos trabalhistas e sindicais...",
      "Analisando estrutura de RH e segurança...",
      ...SENIOR_FACTS.filter(f => f.includes('HCM') || f.includes('eSocial') || f.includes('RH'))
    ]),
    operacao: shuffleArray([
      "Contando a peãozada...",
      "Vendo se tem processo no TRT...",
      "Olhando se o RH funciona ou é bagunça...",
      "Checando se pagam insalubridade...",
      "Vendo quem manda de verdade..."
    ])
  },
  INTEGRACAO: {
    diretoria: shuffleArray([
      "Verificando conectividade e infraestrutura...",
      "Analisando APIs e integrações bancárias...",
      "Checando maturidade digital...",
      "Avaliando arquitetura de sistemas...",
      ...SENIOR_FACTS.filter(f => f.includes('Flow') || f.includes('CONNECT') || f.includes('SIGN'))
    ]),
    operacao: shuffleArray([
      "Vendo se os sistemas conversam ou brigam...",
      "Caçando planilha de Excel solta...",
      "Olhando se tem sinal de internet na sede...",
      "Vendo se a tecnologia é moderna ou a lenha...",
      "Testando a conexão...",
      "Vendo se ainda assinam papel na caneta..."
    ])
  },
  CONCILIACAO: {
    diretoria: shuffleArray([
      "Analisando logística e escoamento...",
      "Verificando frota e custos de transporte...",
      "Mapeando armazéns e silos...",
      "Cruzando rotas e fretes...",
      ...AGRO_FACTS.filter(f => f.includes('export') || f.includes('logística'))
    ]),
    operacao: shuffleArray([
      "Olhando os caminhões no pátio...",
      "Vendo se a soja escoa ou empaca...",
      "Contando os silos cheios...",
      "Checando o preço do frete...",
      "Vendo pra onde vai a carga..."
    ])
  },
  GERAL: {
    diretoria: shuffleArray([
      "Consultando fontes estratégicas...",
      "Gerando inteligência competitiva...",
      "Consolidando informações do grupo...",
      ...SENIOR_FACTS.slice(0, 5),
      ...GATEC_FACTS.slice(0, 3),
      ...AGRO_FACTS.slice(0, 2)
    ]),
    operacao: shuffleArray([
      "Ligando o radar...",
      "Puxando a capivara completa...",
      "Aquecendo os motores...",
      "Buscando as capivaras jurídicas e fiscais...",
      "Olhando o mapa do fazendeiro...",
      "Xequeando o CNPJ na Receita..."
    ])
  }
};

// ==========================================
// 4. LÓGICA DE SELEÇÃO
// ==========================================

function detectPillarFromStage(stage: string): Pillar {
  const s = stage.toLowerCase();
  
  if (s.match(/field|farm|crop|harvest|planting|machine|campo|lavoura|safra|plantio|colheita|rastreabil/)) return 'GATEC';
  if (s.match(/fiscal|tax|accounting|finance|procurement|stock|inventory|contabil|financeiro|imposto|compra|estoque/)) return 'ERP';
  if (s.match(/hr|people|employee|workforce|payroll|rh|gente|folha|ponto|colaborador|trabalhista/)) return 'HCM';
  if (s.match(/integration|api|connect|platform|fintech|bank|integracao|plataforma|banco|flow|bpm|ged/)) return 'INTEGRACAO';
  if (s.match(/logistics|wms|tms|freight|delivery|supply|logistica|frete|transporte|escoamento/)) return 'CONCILIACAO';
  
  return 'GERAL';
}

export function getInsightPool(mode: ChatMode, stage?: string): string[] {
  const pillar = stage ? detectPillarFromStage(stage) : 'GERAL';
  return INSIGHTS[pillar][mode];
}

export function getLongWaitMessages(mode: ChatMode): string[] {
  const messages = {
    diretoria: [
      "A análise está profunda. Buscando dados específicos...",
      "Cruzando informações de filiais e grupo econômico...",
      "Verificando múltiplas fontes para garantir precisão...",
      "Consultando bases de dados de compliance e risco..."
    ],
    operacao: [
      "Eita que o buraco é mais embaixo. Tô cavucando fundo.",
      "A fazenda é grande. Tô rodando os pastos tudo.",
      "O sistema tá pensando. Mas vai sair coisa boa.",
      "Tô peneirando a informação pra não vir cascalho."
    ]
  };
  return messages[mode];
}

export function humanizeStage(stage: string): string {
  const map: Record<string, string> = {
    'search': 'Buscando Dados',
    'analysis': 'Analisando',
    'generation': 'Gerando Relatório',
    'consolidation': 'Consolidando',
    'init': 'Iniciando',
    'saving': 'Salvando'
  };
  
  const lowerStage = stage.toLowerCase();
  for (const key of Object.keys(map)) {
    if (lowerStage.includes(key)) return map[key];
  }

  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

/**
 * NOVO: Obtém frase aleatória do banco, com não-repetição.
 */
export function getRandomInsight(mode: ChatMode, stage?: string): string {
  const pool = getInsightPool(mode, stage);
  return getNextFact(pool);
}
