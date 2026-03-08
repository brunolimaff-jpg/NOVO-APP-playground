import {
  AppError,
  DEEP_DIVE_SOURCES,
  Message,
  ParsedContent,
  PortaFeedAdjustment,
  PortaFlag,
  PortaFlagFeed,
  PortaSegmentFeed,
  PortaSegmento,
  ReportType,
  ScorePortaData,
  Sender,
} from '../types';
import { ChatMode, NOME_VENDEDOR_PLACEHOLDER } from '../constants';
import { normalizeAppError } from '../utils/errorHelpers';
import { withAutoRetry } from '../utils/retry';
import { parsePortaMarkerV2, stripPortaMarkers } from '../utils/porta';
import {
  lookupCliente,
  formatarParaPrompt,
  benchmarkClientes,
  formatarBenchmarkParaPrompt,
  isConcorrenteOuPropria,
  BenchmarkResponse,
  LookupResponse,
} from './clientLookupService';
import { addInvestigation } from '../components/InvestigationDashboard';
import { CompetitorDetection, getContextoConcorrentesRegionais } from './competitorService';
import { buscarContextoPinecone, buscarContextoDocsPinecone } from './ragService';
import { scanInput, sanitizeExternalContent, CANARY_TOKEN } from '../utils/promptGuard';
import { parseLoadingCuriosities } from '../utils/loadingCuriosities';
import { proxyChatSendMessage, proxyGenerateContent } from './geminiProxy';
import {
  addFeedAdjustment,
  addFlagFeed,
  addSegmentFeed,
  generatePortaContextForDeepDive,
  getPortaState,
  initPortaState,
  resetPortaState,
  setBaseScore,
} from './portaStateService';

export { parsePortaMarkerV2 } from '../utils/porta';

export interface GeminiRequestOptions {
  useGrounding?: boolean;
  thinkingMode?: boolean;
  signal?: AbortSignal;
  onText?: (text: string) => void;
  onStatus?: (status: string) => void;
  onScorePorta?: (score: ScorePortaData) => void;
  onCompetitor?: (detection: CompetitorDetection) => void;
  nomeVendedor?: string;
  sessionId?: string;
  hintedCompany?: string | null;
}

export interface SpotterExtractedData {
  companyName?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  segment?: string;
  size?: string;
  pains?: string[];
  currentSystems?: string[];
  summary?: string;
}

import { MODEL_IDS } from '../config/models';

const ROUTER_MODEL_ID = MODEL_IDS.router;
const TACTICAL_MODEL_ID = MODEL_IDS.tactical;
const DEEP_CHAT_MODEL_ID = MODEL_IDS.deepChat;
const DEEP_RESEARCH_MODEL_ID = MODEL_IDS.deepResearch;

const CONTINUITY_SYSTEM = `
Você é o estrategista de continuidade do 🦅 Senior Scout 360.
Sua missão é criar ganchos comerciais que forcem o cliente a admitir um gap de gestão ou tecnologia.

DIRETRIZES DE PENSAMENTO:
1. ANCORAGEM OBRIGATÓRIA: Cada pergunta deve conter ao menos UM dado específico do contexto.
2. FOCO EM VENDAS (SENIOR): Direcione para sistemas: ERP, HCM, WMS ou GATec.
3. ESTILO "SNIPER": Se o contexto diz que a empresa cresceu, pergunte sobre o caos que isso gera.

PROIBIÇÕES:
- PROIBIDO: Iniciar perguntas com "Como você..." (muito vago).
- PROIBIDO: Perguntas genéricas que sirvam para qualquer empresa.

Responda EXCLUSIVAMENTE em Português (Brasil) usando um Array JSON de strings.
`;

function sanitizeStreamText(text: string): string {
  return stripPortaMarkers(
    text
      .replace(/\[\[COMPETITOR:[^\]]*\]\]/g, '')
      .replace(/\[\[PORTA_FEED_[^\]]*\]\]/g, '')
      .replace(/\[\[PORTA_FLAG:[^\]]*\]\]/g, '')
      .replace(/\[\[PORTA_SEG:[^\]]*\]\]/g, '')
      .replace(/\[\[STATUS:[^\]]*\]\]/g, '')
      .replace(/\[\[[A-Z_]+:[^\n]*?\]\]/g, '')
      .replace(/\[\[[A-Z_]*:?[^\n]*$/, '')
      .replace(/^(\s*\]\s*\n)+/, '')
      .replace(/^\s*\]/, ''),
  );
}

interface ParsedPortaFeeds {
  adjustments: Omit<PortaFeedAdjustment, 'timestamp'>[];
  flags: Omit<PortaFlagFeed, 'timestamp'>[];
  segments: Omit<PortaSegmentFeed, 'timestamp'>[];
}

type DeepDiveSource = (typeof DEEP_DIVE_SOURCES)[keyof typeof DEEP_DIVE_SOURCES] | 'UNKNOWN';

function normalizeFeedToken(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
}

function parseFeedInt(raw: string | undefined): number | null {
  const cleaned = normalizeFeedToken(raw);
  const match = cleaned.match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampFeedValue(value: number): number {
  return Math.min(10, Math.max(0, value));
}

function parseFeedPairs(raw: string | undefined): { subScores?: Record<string, number>; metadata?: Record<string, string> } {
  const extras = normalizeFeedToken(raw);
  if (!extras) return {};
  const pieces = extras.split(':').map(part => part.trim()).filter(Boolean);
  if (pieces.length < 2) return {};

  const subScores: Record<string, number> = {};
  const metadata: Record<string, string> = {};
  for (let i = 0; i < pieces.length - 1; i += 2) {
    const key = normalizeFeedToken(pieces[i]);
    const valueRaw = normalizeFeedToken(pieces[i + 1]);
    const valueNum = parseFeedInt(valueRaw);
    if (!key) continue;
    if (valueNum !== null && /^\d+$/.test(valueRaw.replace(/[^\d]/g, ''))) {
      subScores[key] = valueNum;
    } else {
      metadata[key] = valueRaw;
    }
  }
  return {
    subScores: Object.keys(subScores).length > 0 ? subScores : undefined,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

export function parsePortaFeeds(content: string, source: string): ParsedPortaFeeds {
  const result: ParsedPortaFeeds = {
    adjustments: [],
    flags: [],
    segments: [],
  };

  const pushAdjustment = (adjustment: Omit<PortaFeedAdjustment, 'timestamp'>) => {
    result.adjustments.push(adjustment);
  };

  const feedORRegex = /\[\[PORTA_FEED_([OR]):(?:\[)?(\d+)(?:\])?(?::([^:\]]+):(?:\[)?([^\]]*)(?:\])?)?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = feedORRegex.exec(content)) !== null) {
    const dimension = match[1] as 'O' | 'R';
    const value = clampFeedValue(Number.parseInt(match[2], 10));
    const key = normalizeFeedToken(match[3]);
    const rawValue = normalizeFeedToken(match[4]);
    const metadata = key && rawValue ? { [key]: rawValue } : undefined;
    pushAdjustment({
      source,
      dimension,
      suggestedValue: value,
      justification: `Deep dive ${source} sugere ${dimension}=${value}`,
      metadata,
    });
  }

  const tFeedRegex = /\[\[PORTA_FEED_T:(?:\[)?(\d+)(?:\])?:T1:(?:\[)?(\d+)(?:\])?:T2:(?:\[)?(\d+)(?:\])?:T3:(?:\[)?(\d+)(?:\])?(?::STACK:(?:\[)?([^\]]+)(?:\])?)?\]\]/g;
  while ((match = tFeedRegex.exec(content)) !== null) {
    const tFinal = clampFeedValue(Number.parseInt(match[1], 10));
    const t1 = clampFeedValue(Number.parseInt(match[2], 10));
    const t2 = clampFeedValue(Number.parseInt(match[3], 10));
    const t3 = clampFeedValue(Number.parseInt(match[4], 10));
    const stack = normalizeFeedToken(match[5]);
    pushAdjustment({
      source,
      dimension: 'T',
      suggestedValue: tFinal,
      justification: `Deep dive ${source}: T1(stack)=${t1}, T2(dor)=${t2}, T3(liberdade)=${t3}`,
      subScores: { T1: t1, T2: t2, T3: t3 },
      metadata: stack ? { STACK: stack } : undefined,
    });
  }

  const aFeedRegex = /\[\[PORTA_FEED_A:(?:\[)?(\d+)(?:\])?:A1:(?:\[)?(\d+)(?:\])?:A2:(?:\[)?(\d+)(?:\])?(?::GERACAO:(?:\[)?([^\]]+)(?:\])?)?\]\]/g;
  while ((match = aFeedRegex.exec(content)) !== null) {
    const aFinal = clampFeedValue(Number.parseInt(match[1], 10));
    const a1 = clampFeedValue(Number.parseInt(match[2], 10));
    const a2 = clampFeedValue(Number.parseInt(match[3], 10));
    const geracao = normalizeFeedToken(match[4]);
    pushAdjustment({
      source,
      dimension: 'A',
      suggestedValue: aFinal,
      justification: `Deep dive ${source}: A1(cultural)=${a1}, A2(timing)=${a2}, Geração=${geracao || 'N/A'}`,
      subScores: { A1: a1, A2: a2 },
      metadata: geracao ? { GERACAO: geracao } : undefined,
    });
  }

  const pFeedRegex = /\[\[PORTA_FEED_P:(?:\[)?(\d+)(?:\])?(?::HA:(?:\[)?([^\]:]*)(?:\])?)?(?::CNPJS:(?:\[)?([^\]:]*)(?:\])?)?(?::FAT:(?:\[)?([^\]]*)(?:\])?)?\]\]/g;
  while ((match = pFeedRegex.exec(content)) !== null) {
    const pFinal = clampFeedValue(Number.parseInt(match[1], 10));
    const metadata: Record<string, string> = {};
    const ha = normalizeFeedToken(match[2]);
    const cnpjs = normalizeFeedToken(match[3]);
    const fat = normalizeFeedToken(match[4]);
    if (ha) metadata.HA = ha;
    if (cnpjs) metadata.CNPJS = cnpjs;
    if (fat) metadata.FAT = fat;
    pushAdjustment({
      source,
      dimension: 'P',
      suggestedValue: pFinal,
      justification: `Deep dive ${source} sugere P=${pFinal}`,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    });
  }

  const genericFeedRegex = /\[\[PORTA_FEED_([PORTA])(?:_[A-Z0-9]+)?:(?:\[)?(\d+)(?:\])?(?::([^\]]+))?\]\]/g;
  while ((match = genericFeedRegex.exec(content)) !== null) {
    const dimension = match[1] as 'P' | 'O' | 'R' | 'T' | 'A';
    const hasSpecific = result.adjustments.some(a => a.dimension === dimension);
    if (hasSpecific) continue;
    const suggestedValue = clampFeedValue(Number.parseInt(match[2], 10));
    const { subScores, metadata } = parseFeedPairs(match[3]);
    pushAdjustment({
      source,
      dimension,
      suggestedValue,
      justification: `Deep dive ${source} sugere ${dimension}=${suggestedValue}`,
      subScores,
      metadata,
    });
  }

  const proxyRegex = /\[\[PORTA_FEED_P_PROXY:FUNC:(?:\[)?(\d+)(?:\])?\]\]/g;
  while ((match = proxyRegex.exec(content)) !== null) {
    const value = normalizeFeedToken(match[1]);
    const existing = result.adjustments.find(a => a.dimension === 'P');
    if (existing) {
      existing.metadata = { ...(existing.metadata || {}), FUNCIONARIOS: value };
    }
  }

  const flagRegex = /\[\[PORTA_FLAG:(TRAD|LOCK|NOFIT):(?:\[)?(SIM|NAO|NÃO)(?:\])?(?::[^\]]+)?\]\]/g;
  while ((match = flagRegex.exec(content)) !== null) {
    result.flags.push({
      source,
      flag: match[1] as PortaFlag,
      active: match[2] === 'SIM',
      justification: `Deep dive ${source} ${match[2] === 'SIM' ? 'ativou' : 'desativou'} flag ${match[1]}`,
    });
  }

  const tradFlagRegex = /\[\[PORTA_FLAG:TRAD:(?:\[)?(SIM|NAO|NÃO)(?:\])?:NATUREZA:(?:\[)?(PRODUCAO|TRADING|MISTA)(?:\])?\]\]/g;
  while ((match = tradFlagRegex.exec(content)) !== null) {
    result.flags = result.flags.filter(flag => flag.flag !== 'TRAD');
    result.flags.push({
      source,
      flag: 'TRAD',
      active: match[1] === 'SIM',
      justification: `Natureza da receita: ${match[2]}`,
    });
  }

  const segmentRegex = /\[\[PORTA_SEG:(?:\[)?(PRD|AGI|COP)(?:\])?\]\]/g;
  while ((match = segmentRegex.exec(content)) !== null) {
    result.segments.push({
      source,
      segmento: match[1] as PortaSegmento,
      justification: `Deep dive ${source} inferiu segmento ${match[1]}`,
    });
  }

  return result;
}

export function cleanPortaFeedMarkers(text: string): string {
  return stripPortaMarkers(text);
}

function isDeepDiveMessage(message: string, isMegaPromptMessage: boolean): boolean {
  if (!isMegaPromptMessage) return false;
  const deepDiveHints = [
    'INTELIGÊNCIA OPERACIONAL',
    'ARQUITETURA DE TI',
    'COMPLIANCE, RISCO FISCAL',
    'TEIA SOCIETÁRIA',
    'RH, SST E GESTÃO DE PESSOAS',
    'CADEIA DE COMANDO',
  ];
  return deepDiveHints.some(hint => message.includes(hint));
}

function getDeepDiveSource(message: string): DeepDiveSource {
  if (message.includes('INTELIGÊNCIA OPERACIONAL') || message.includes('Raio-X')) return DEEP_DIVE_SOURCES.RAIO_X;
  if (message.includes('ARQUITETURA DE TI') || message.includes('Tech Stack')) return DEEP_DIVE_SOURCES.TECH;
  if (message.includes('COMPLIANCE') || message.includes('RISCOS')) return DEEP_DIVE_SOURCES.COMPLIANCE;
  if (message.includes('TEIA SOCIETÁRIA') || message.includes('M&A')) return DEEP_DIVE_SOURCES.EXPANSAO;
  if (message.includes('RH, SST') || message.includes('SINDICATOS')) return DEEP_DIVE_SOURCES.RH;
  if (message.includes('CADEIA DE COMANDO') || message.includes('DECISORES')) return DEEP_DIVE_SOURCES.DECISORES;
  return 'UNKNOWN';
}

function enforceOpeningWithSeller(rawText: string, nomeVendedor: string): string {
  if (!rawText) return rawText;
  const seller = nomeVendedor?.trim() || 'Vendedor';
  const trimmedStart = rawText.trimStart();
  if (/^#+\s/.test(trimmedStart)) return rawText;

  let text = trimmedStart;
  const forbiddenOpenings = [/^fala[,!\.\s]*time[\.!?\s-]*/i, /^fala[,!\.\s]*(pessoal|galera)[\.!?\s-]*/i];
  let replaced = false;
  for (const re of forbiddenOpenings) {
    if (re.test(text)) {
      text = text.replace(re, `${seller}, `);
      replaced = true;
      break;
    }
  }
  if (!replaced) return rawText;
  const match = rawText.match(/^\s*/);
  return (match ? match[0] : '') + text;
}

function parseCompetitorMarker(content: string): CompetitorDetection | null {
  const match = content.match(/\[\[COMPETITOR:([^:\]]+):([^:\]]+):([^:\]]+):([^\]]+)\]\]/);
  if (!match) return null;
  return {
    encontrado: true,
    nomeERP: match[1].trim(),
    nivelAmeaca: match[2].trim() as 'alto' | 'medio' | 'baixo',
    revendaLocal: match[3].trim(),
    confianca: match[4].trim() as 'alta' | 'media' | 'baixa',
  };
}

function extractEstadoFromMessage(message: string): string {
  const ufsKnown: Record<string, string> = {
    'mato grosso do sul': 'MS',
    'mato grosso': 'MT',
    goiás: 'GO',
    goias: 'GO',
    pará: 'PA',
    para: 'PA',
    maranhão: 'MA',
    maranhao: 'MA',
    tocantins: 'TO',
    bahia: 'BA',
    'minas gerais': 'MG',
    'são paulo': 'SP',
    paraná: 'PR',
    parana: 'PR',
    'rio grande do sul': 'RS',
    ' MT ': 'MT',
    ' MS ': 'MS',
    ' GO ': 'GO',
    ' PA ': 'PA',
    ' BA ': 'BA',
    ' MG ': 'MG',
    ' SP ': 'SP',
    ' PR ': 'PR',
    ' RS ': 'RS',
  };
  const lower = message.toLowerCase();
  for (const [key, uf] of Object.entries(ufsKnown)) {
    if (lower.includes(key.toLowerCase())) return uf;
  }
  return 'MT';
}

function isOpenQuestionMessage(message: string): boolean {
  const text = (message || '').trim().toLowerCase();
  if (!text) return false;
  if (text.endsWith('?')) return true;
  return /^(onde|como|qual|quais|quem|quando|por que|porque|quanto)\b/.test(text);
}

export function parseMarkers(content: string): ParsedContent {
  let text = content;
  const statuses: string[] = [];
  let scorePorta: ScorePortaData | null = null;

  const statusRegex = /\[\[STATUS:([^\]]+)\]\]/g;
  let statusMatch;
  while ((statusMatch = statusRegex.exec(content)) !== null) {
    statuses.push(statusMatch[1]);
    text = text.replace(statusMatch[0], '');
  }

  scorePorta = parsePortaMarkerV2(text);
  text = stripPortaMarkers(text);

  text = text.replace(/\[\[COMPETITOR:[^\]]*\]\]/g, '').replace(/\[\[[A-Z_]+:[^\n]*?\]\]/g, '');
  text = text.replace(
    /\*{0,2}Score PORTA:\*{0,2}\s*\d+\/100\s*[—–-]\s*(?:Alta|Média|Baixa)\s*Compatibilidade\.?\s*/gi,
    '',
  );
  text = text
    .replace(/^(\s*\]\s*\n)+/, '')
    .replace(/^\s*\]/, '')
    .replace(/^\s*\n/gm, '\n')
    .trim();
  return { text, statuses, scorePorta };
}

const companyMetrics: Record<string, Record<string, number>> = {};
function extractMetrics(text: string): Record<string, number> {
  const m: Record<string, number> = {};
  const haMatch = text.match(/(\d[\d.,]*)\s*(mil\s+)?hect(?:ares?)?\b/i);
  if (haMatch)
    m.ha = haMatch[2]
      ? parseFloat(haMatch[1].replace(/\./g, '').replace(',', '.')) * 1000
      : parseFloat(haMatch[1].replace(/\./g, '').replace(',', '.'));
  const empMatch = text.match(/\+?(\d[\d.,]*)\s*(mil\s+)?(?:colaboradores?|funcionários?|empregados?)\b/i);
  if (empMatch)
    m.employees = empMatch[2]
      ? parseFloat(empMatch[1].replace(/\./g, '').replace(',', '.')) * 1000
      : parseFloat(empMatch[1].replace(/\./g, '').replace(',', '.'));
  return m;
}

let currentCompanyContext: { empresa: string; sessionId: string; timestamp: number } | null = null;

export function generateContextReminder(companyName: string | null, sessionId?: string): string {
  if (!companyName) return '';
  currentCompanyContext = { empresa: companyName, sessionId: sessionId || 'unknown', timestamp: Date.now() };
  return `\n\n📌 [CONTEXTO ATIVO]: Você está investigando a empresa "${companyName}".\n- Mantenha foco TOTAL nesta empresa.\n- NUNCA cite nomes de empresas que não foram mencionados pelo usuário.\n`;
}

export function resetCompanyContext(): void {
  currentCompanyContext = null;
}

export function extractSuggestionsFromResponse(content: string): string[] {
  if (!content) return [];
  const regexes = [
    /(?:---|___|\*\*\*)\s*[\r\n]+(?:\*\*|##|###)?\s*(?:🔎|⚡|🤠)?\s*(?:O que você quer descobrir agora|E aí, onde a gente joga o adubo agora|E aí, qual desses você quer cavucar|Próximos passos|Sugestões?(?:\s+de\s+perguntas)?)(?:.*?)[\r\n]+/i,
    /\n+(?:\*\*|##|###)\s*(?:🔎|⚡|🤠)?\s*(?:Sugestões?(?:\s+de\s+perguntas)?|Próximos\s+passos|O que você quer descobrir agora)\s*\*?\*?\s*[\r\n]+/i,
  ];
  for (const regex of regexes) {
    const parts = content.split(regex);
    if (parts.length >= 2) {
      return parts[parts.length - 1]
        .split('\n')
        .map(l => l.trim())
        .filter(l => /^[\*\-•\+]\s/.test(l) || /^\d+\./.test(l))
        .map(l =>
          l
            .replace(/^[\*\-•\+\d\.]+\s*/, '')
            .replace(/^\"|'|'|\"$/g, '')
            .replace(/\*+$/, '')
            .trim(),
        )
        .filter(l => l.length > 0)
        .slice(0, 4);
    }
  }
  return [];
}

export const resetChatSession = () => {
  resetCompanyContext();
  resetPortaState();
};

const analyzeUserIntent = async (
  msg: string,
): Promise<{ empresa: string | null; benchmark: boolean; rota: 'tatica' | 'profunda' }> => {
  if (!msg || msg.trim().length < 5) return { empresa: null, benchmark: false, rota: 'tatica' };
  try {
    const prompt = `Analise a frase: "${msg}". Extraia (JSON): 1. "empresa": NOME DA EMPRESA (ou "NONE"). 2. "benchmark": boolean. 3. "rota": "profunda" ou "tatica".`;
    const response = await proxyGenerateContent({
      model: ROUTER_MODEL_ID,
      contents: prompt,
      config: { temperature: 0, responseMimeType: 'application/json' },
    });
    const parsed = JSON.parse(
      (response.text || '{}')
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim(),
    );
    return {
      empresa: !parsed.empresa || parsed.empresa === 'NONE' || parsed.empresa.length < 2 ? null : parsed.empresa,
      benchmark: !!parsed.benchmark,
      rota: parsed.rota === 'profunda' ? 'profunda' : 'tatica',
    };
  } catch {
    return { empresa: null, benchmark: false, rota: 'tatica' };
  }
};

const generateBenchmarkKeywords = async (empresaNome: string, contexto: string): Promise<string[]> => {
  try {
    const resp = await proxyGenerateContent({
      model: ROUTER_MODEL_ID,
      contents: `Gere 5 palavras-chave do SETOR de "${empresaNome}". Contexto: "${contexto}". Separadas por vírgula.`,
      config: { temperature: 0.1 },
    });
    return (resp.text || '')
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 1);
  } catch {
    return [];
  }
};

export const generateLoadingCuriosities = async (context: string): Promise<string[]> => {
  if (!context.trim()) return [];
  try {
    const response = await proxyGenerateContent({
      model: ROUTER_MODEL_ID,
      contents: `Você está gerando mensagens rápidas para o loading da investigação comercial.

Contexto da empresa-alvo: "${context}".

Retorne EXCLUSIVAMENTE um JSON com este formato:
{
  "empresa": ["..."],
  "senior": ["..."],
  "setor": ["..."],
  "regional": ["..."]
}

REGRAS:
- Gere entre 1 e 3 itens por chave.
- "empresa": fatos/sinais específicos da empresa-alvo.
- "senior": fatos sobre Senior Sistemas e aderência da oferta (ERP/HCM/GAtec).
- "setor"/"regional": contexto de mercado e região para reforçar diagnóstico.
- Frases curtas (máx 130 chars), concretas e sem linguagem genérica.
- Se não houver dado confiável, use formulação prudente (ex: "sinal de expansão em apuração").`,
      config: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 1024 },
    });
    return parseLoadingCuriosities(response.text || '', context);
  } catch {
    return [];
  }
};

const generateFallbackSuggestions = async (
  lastUserText: string,
  botResponseText: string,
  isOperacao: boolean,
  empresaAlvo: string | null,
): Promise<string[]> => {
  try {
    const isMegaPrompt =
      lastUserText.length > 300 &&
      (lastUserText.includes('Protocolo de investigação') || lastUserText.includes('DIRETRIZ'));

    // CORREÇÃO: Sempre forçar a inclusão do nome da empresa nas sugestões
    const empresaNome = empresaAlvo || 'a empresa alvo';
    const target = `da empresa ${empresaNome}`;

    const effectiveUserContext = isMegaPrompt
      ? `O usuário executou uma análise profunda (Raio-X/Dossiê) sobre ${empresaNome}.`
      : `O usuário, investigando ${empresaNome}, enviou a pergunta: "${lastUserText.substring(0, 500)}".`;

    const response = await proxyGenerateContent({
      model: ROUTER_MODEL_ID,
      contents: `${effectiveUserContext}\n\nA IA respondeu com esta análise:\n"${botResponseText.substring(0, 1000)}..."\n\n**REGRA OBRIGATÓRIA**: Cada sugestão DEVE mencionar "${empresaNome}" ou usar pronomes que deixem clara a referência à empresa (ex: "dessa empresa", "deles", "lá").\n\nGere 3 sugestões CURTAS E DIRETAS de perguntas (follow-up) que o usuário pode fazer para se aprofundar nesta resposta. \n\nExemplos BONS:\n- "Como ${empresaNome} gerencia acesso e balanças hoje?"\n- "Quais concorrentes dessa empresa em MT já usam WMS Senior?"\n- "${empresaNome} tem planos de novas aquisições nos próximos 12 meses?"\n\nExemplos RUINS (NÃO FAZER):\n- "Quais concorrentes em MT já usam o WMS?" (falta o nome da empresa)\n- "Como gerenciam acesso?" (muito genérico)\n\nRetorne APENAS um JSON Array de strings.`,
      config: {
        systemInstruction:
          'Você é o assistente B2B que sugere os próximos passos da investigação. SEMPRE mencione o nome da empresa nas sugestões.',
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const json = JSON.parse(
      (response.text || '[]')
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim(),
    );
    if (!Array.isArray(json)) return [`Mapear decisores ${target}`, `Verificar gaps técnicos de ${empresaNome}`];

    // Forçar substituição se a IA esqueceu
    return json
      .map((item: any) => (typeof item === 'string' ? item : item?.pergunta || item?.sugestao || 'Aprofundar análise'))
      .map((suggestion: string) => {
        // Se não menciona a empresa, forçar adição
        if (
          empresaAlvo &&
          !suggestion.toLowerCase().includes(empresaAlvo.toLowerCase()) &&
          !suggestion.includes('dessa empresa') &&
          !suggestion.includes('deles') &&
          !suggestion.includes('lá')
        ) {
          return suggestion.replace(/^(\w+)/, `$1 ${empresaAlvo}`);
        }
        return suggestion;
      })
      .slice(0, 3);
  } catch {
    const empresa = empresaAlvo || 'a empresa';
    return [
      `Aprofundar análise de ${empresa}`,
      `Mapear decisores de ${empresa}`,
      `Verificar gaps técnicos de ${empresa}`,
    ];
  }
};

export const sendMessageToGemini = async (
  message: string,
  history: Message[],
  systemInstruction: string,
  options: GeminiRequestOptions = {},
  canUseLookup: boolean = true,
): Promise<{
  text: string;
  sources: Array<{ title: string; url: string }>;
  suggestions: string[];
  scorePorta: ScorePortaData | null;
  statuses: string[];
  empresa?: string | null;
  ghostReason?: string;
}> => {
  const {
    useGrounding = true,
    thinkingMode = false,
    signal,
    onText,
    onStatus,
    onScorePorta,
    onCompetitor,
    nomeVendedor,
    sessionId,
    hintedCompany,
  } = options;

  const guardResult = scanInput(message);
  if (guardResult.level === 'blocked')
    throw normalizeAppError(new Error(`Mensagem bloqueada: ${guardResult.reason}.`), 'GUARD');

  const safeMessage = guardResult.sanitized;
  const isOpenQuestion = isOpenQuestionMessage(safeMessage);

  // AQUI FOI CORRIGIDO: Recoloquei a variável que tinha sumido
  const nomeParaInjetar = nomeVendedor?.trim() || 'Vendedor';
  const systemInstructionFinal = systemInstruction.replace(
    new RegExp(NOME_VENDEDOR_PLACEHOLDER.replace(/[{}]/g, '\\$&'), 'g'),
    nomeParaInjetar,
  );

  const apiCall = async () => {
    onStatus?.('Analisando complexidade do pedido...');

    const isMegaPromptMessage = message.startsWith('Dossiê completo de [');
    let embeddedCompany = null;
    if (isMegaPromptMessage) {
      const match = message.match(/^Dossiê completo de \[([^\]]+)\]/);
      if (match) embeddedCompany = match[1];
      if (embeddedCompany === 'a empresa desta conversa') {
        embeddedCompany = hintedCompany || currentCompanyContext?.empresa || null;
      }
    }

    const ragQuery = isMegaPromptMessage ? embeddedCompany || 'Empresa Alvo' : message;
    const ragContextPromise = buscarContextoPinecone(ragQuery);
    const docsRagPromise = buscarContextoDocsPinecone(ragQuery);

    const intentQuery = isMegaPromptMessage ? `Investigar a empresa ${embeddedCompany || 'desconhecida'}` : message;
    const { empresa: rawEmpresa, benchmark, rota } = await analyzeUserIntent(intentQuery);

    let empresa = isConcorrenteOuPropria(rawEmpresa || '') ? null : rawEmpresa;
    if (isMegaPromptMessage && embeddedCompany && !isConcorrenteOuPropria(embeddedCompany)) {
      empresa = embeddedCompany;
    }

    if (
      !empresa &&
      hintedCompany &&
      !isConcorrenteOuPropria(hintedCompany)
    ) {
      empresa = hintedCompany;
    }

    if (
      !empresa &&
      currentCompanyContext?.empresa &&
      (!sessionId || currentCompanyContext.sessionId === sessionId)
    ) {
      empresa = currentCompanyContext.empresa;
    }

    const currentSessionId = sessionId || currentCompanyContext?.sessionId || 'unknown';
    const portaState = getPortaState();
    if (
      empresa &&
      (!portaState || portaState.empresa !== empresa || portaState.sessionId !== currentSessionId)
    ) {
      initPortaState(empresa, currentSessionId);
    }

    let finalInstruction = systemInstructionFinal;
    if (!empresa && !history.some(h => h.sender === 'bot' && (h.scorePorta || h.text.includes('PORTA:')))) {
      finalInstruction = `Você é o Especialista Técnico da Senior Sistemas.
SUA ÚNICA MISSÃO: Responder a pergunta técnica de forma DIRETA. 
Use os links do RAG [Texto](URL). NÃO inicie fluxos de investigação, NÃO peça CNPJ.`;
    }

    if (isOpenQuestion) {
      finalInstruction = `${finalInstruction}

MODO RESPOSTA DIRETA (PERGUNTA ABERTA):
- Responda PRIMEIRO exatamente o que foi perguntado, de forma objetiva.
- NUNCA diga que a mensagem está vazia ou sem direcionamento quando houver pergunta.
- Só depois complemente com contexto adicional, se realmente útil.`;
    }

    let effectiveUserMessage = safeMessage;
    if (isMegaPromptMessage) {
      const parts = message.split('\n\n');
      finalInstruction = `${parts.slice(1).join('\n\n')}\n\n---\n\n${finalInstruction}`;
      effectiveUserMessage = `Execute o protocolo de investigação forense para a empresa: ${empresa || 'a empresa alvo'}.`;
    }

    const isDeepDive = isDeepDiveMessage(message, isMegaPromptMessage);

    const isDeepResearch = rota === 'profunda' || isMegaPromptMessage;
    if (isDeepResearch) onStatus?.('Deep Research ativado — varredura web iniciada...');
    if (signal?.aborted) throw new Error('Request aborted');

    let enrichments: string[] = [];
    if (empresa) {
      if (!isConcorrenteOuPropria(empresa)) {
        onStatus?.(`Buscando histórico de ${empresa}...`);
        const lookup: LookupResponse = canUseLookup
          ? await lookupCliente(empresa)
          : { ok: true, query: empresa, encontrado: false, total: 0, results: [] };
        enrichments.push(lookup.encontrado ? formatarParaPrompt(lookup) : `\n[Lookup: "${empresa}" não encontrado]\n`);
      }
      enrichments.push(generateContextReminder(empresa, currentSessionId));
      const competitorContext = getContextoConcorrentesRegionais(extractEstadoFromMessage(message));
      if (competitorContext) enrichments.push(competitorContext);
      if (benchmark || message.includes('investigar')) {
        onStatus?.('Mapeando benchmarks...');
        const bench: BenchmarkResponse = canUseLookup
          ? await benchmarkClientes(await generateBenchmarkKeywords(empresa, message))
          : { ok: true, mode: 'benchmark', keywords: [], total: 0, results: [] };
        if (bench.ok) enrichments.push(formatarBenchmarkParaPrompt(bench, empresa));
      }
    }

    onStatus?.('Consultando bases de conhecimento...');
    const [ragContext, docsRagContext] = await Promise.all([
      Promise.race([ragContextPromise, new Promise<string>(r => setTimeout(() => r(''), 60000))]),
      Promise.race([docsRagPromise, new Promise<string>(r => setTimeout(() => r(''), 60000))]),
    ]);

    if (ragContext) enrichments.push(`## INTELIGÊNCIA INTERNA (RAG)\n${sanitizeExternalContent(ragContext)}`);
    if (docsRagContext) enrichments.push(`## DOCUMENTAÇÃO SENIOR (RAG)\n${sanitizeExternalContent(docsRagContext)}`);

    const isTechnicalMode =
      !empresa && !history.some(h => h.sender === 'bot' && (h.scorePorta || h.text.includes('PORTA:')));
    let messageToSend =
      enrichments.length > 0
        ? `## PERGUNTA\n"${effectiveUserMessage}"\n\n---\n## CONTEXTO\n${enrichments.join('\n')}\n---\nO usuário perguntou: "${effectiveUserMessage}"`
        : effectiveUserMessage;

    if (isDeepDive) {
      const deepDiveSource = getDeepDiveSource(message);
      const portaContext = generatePortaContextForDeepDive(deepDiveSource);
      messageToSend = `${portaContext}\n\n---\n\n${messageToSend}`;
    }

    if (isTechnicalMode) messageToSend += `\n\nResponda diretamente como Especialista Senior.`;

    if (!isDeepResearch) onStatus?.('Gerando resposta...');
    const sdkHistory = history
      .filter(msg => !msg.isError)
      .map(msg => ({ role: msg.sender === Sender.User ? ('user' as const) : ('model' as const), text: msg.text }));

    const response = await proxyChatSendMessage(
      {
        model: isDeepResearch ? DEEP_CHAT_MODEL_ID : TACTICAL_MODEL_ID,
        history: sdkHistory,
        systemInstruction: `${CANARY_TOKEN}\n${finalInstruction}\nMODO LIVE STATUS (OBRIGATÓRIO):\nEmita marcadores [[STATUS: Mensagem]] a cada etapa da análise. Use links markdown [texto](URL).`,
        message: messageToSend,
        useGrounding,
        thinkingMode,
      },
      signal,
    );

    const rawAccumulator = response.text || '';
    const groundingChunks = Array.isArray(response.groundingChunks) ? response.groundingChunks : [];
    onText?.(sanitizeStreamText(rawAccumulator));

    const finalParsed = parseMarkers(rawAccumulator);
    finalParsed.statuses.forEach(status => onStatus?.(status));
    const competitorDetection = parseCompetitorMarker(rawAccumulator);
    if (competitorDetection) onCompetitor?.(competitorDetection);

    if (isDeepDive) {
      const source = getDeepDiveSource(message);
      const feeds = parsePortaFeeds(rawAccumulator, source);
      for (const adjustment of feeds.adjustments) addFeedAdjustment(adjustment);
      for (const flag of feeds.flags) addFlagFeed(flag);
      for (const segment of feeds.segments) addSegmentFeed(segment);
      const consolidated = getPortaState()?.consolidatedScore;
      if (consolidated) {
        finalParsed.scorePorta = consolidated;
      }
    } else if (finalParsed.scorePorta) {
      setBaseScore(finalParsed.scorePorta);
      const consolidated = getPortaState()?.consolidatedScore;
      if (consolidated) {
        finalParsed.scorePorta = consolidated;
      }
    }

    // Agora o nomeParaInjetar existe e não dará mais erro!
    let finalText = enforceOpeningWithSeller(finalParsed.text, nomeParaInjetar);
    finalText = cleanPortaFeedMarkers(finalText);
    if (finalParsed.scorePorta) onScorePorta?.(finalParsed.scorePorta);

    const inlineLinks: Array<{ title: string; url: string }> = [];
    const linkRegex = /\[([^\]\n]{1,120})\]\((https?:\/\/[^)\s]{4,})\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(finalText)) !== null) {
      if (!inlineLinks.some(l => l.url === linkMatch[2]))
        inlineLinks.push({ title: linkMatch[1].trim(), url: linkMatch[2] });
    }
    const sources = [
      ...groundingChunks.filter(c => c.web?.uri).map(c => ({ title: c.web.title || c.web.uri, url: c.web.uri })),
      ...inlineLinks,
    ];

    return {
      text: finalText,
      sources,
      suggestions: [],
      scorePorta: isDeepDive
        ? finalParsed.scorePorta
        : !rawEmpresa || isConcorrenteOuPropria(rawEmpresa)
          ? undefined
          : finalParsed.scorePorta,
      statuses: finalParsed.statuses,
      empresa,
      ghostReason: !rawAccumulator.trim() ? 'Timeout' : undefined,
    };
  };

  try {
    const responseData = await withAutoRetry('Gemini:Stream', apiCall, { maxRetries: 2 });

    let suggestions = extractSuggestionsFromResponse(responseData.text);

    if (!suggestions || suggestions.length === 0) {
      onStatus?.('Gerando ganchos comerciais finais...');
      suggestions = await generateFallbackSuggestions(
        message,
        responseData.text,
        systemInstruction.includes('Operação'),
        responseData.empresa || null,
      );
    }

    if (responseData.empresa && responseData.text.length > 300) {
      addInvestigation({
        id: Date.now().toString(),
        empresa: responseData.empresa,
        score: responseData.scorePorta?.score || 75,
        scoreLabel: responseData.scorePorta ? `${responseData.scorePorta.score}/100` : 'ANALISADO',
        gaps: [],
        familias: [],
        isCliente: responseData.text.includes('✅ SIM'),
        modo: systemInstruction.includes('Operação') ? 'Operação' : 'Diretoria',
        data: new Date().toLocaleDateString('pt-BR'),
        resumo: responseData.text.substring(0, 150).replace(/[#*\n]/g, ' '),
      });
    }
    return { ...responseData, suggestions };
  } catch (error: any) {
    throw normalizeAppError(error, 'GEMINI');
  }
};

export const generateNewSuggestions = async (
  contextText: string,
  previousSuggestions: string[] = [],
): Promise<string[]> => {
  if (!contextText.trim()) return [];
  try {
    const response = await proxyGenerateContent({
      model: ROUTER_MODEL_ID,
      contents: [
        {
          role: 'user',
          parts: [
            { text: `CONTEXTO:\n${contextText}\n\nEVITAR: ${previousSuggestions.join(', ')}\nGere 3 perguntas JSON.` },
          ],
        },
      ],
      config: { systemInstruction: CONTINUITY_SYSTEM, responseMimeType: 'application/json', temperature: 0.4 },
    });
    return JSON.parse(
      (response.text || '[]')
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim(),
    )
      .map((i: any) => (typeof i === 'string' ? i : i.pergunta || i.sugestao || 'Opção'))
      .slice(0, 3);
  } catch {
    return ['Mapear decisores', 'Consultar ERP atual'];
  }
};

export const generateConsolidatedDossier = async (
  history: Message[],
  systemInstruction: string,
  mode: ChatMode,
  reportType: ReportType = 'full',
): Promise<string> => {
  try {
    const response = await proxyGenerateContent({
      model: TACTICAL_MODEL_ID,
      contents: `Consolide este histórico: ${history.map(m => m.text).join('\n')}`,
      config: { systemInstruction, temperature: 0.2, maxOutputTokens: 65536 },
    });
    return response.text || 'Erro na consolidação.';
  } catch (error) {
    throw normalizeAppError(error, 'GEMINI');
  }
};

export const extractSpotterData = async (raw: string): Promise<SpotterExtractedData> => {
  if (!raw.trim()) {
    return {};
  }
  const systemInstruction = `
Você é um analista SDR lendo uma ficha pública colada do ExactSpotter.

TAREFA: Extrair APENAS os campos pedidos abaixo. Se um campo não aparecer, deixe como null ou lista vazia.
FORMATO: Retorne EXCLUSIVAMENTE um JSON com as chaves: companyName, contactName, contactRole, contactEmail, contactPhone, segment, size, pains (array), currentSystems (array), summary.
`;
  const response = await proxyGenerateContent({
    model: ROUTER_MODEL_ID,
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemInstruction}\n\nFICHA COPIADA DO SPOTTER:\n\n${sanitizeExternalContent(raw)}` }],
      },
    ],
    config: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 65536 },
  });
  try {
    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return {
      companyName: parsed.companyName || undefined,
      contactName: parsed.contactName || undefined,
      contactRole: parsed.contactRole || undefined,
      contactEmail: parsed.contactEmail || undefined,
      contactPhone: parsed.contactPhone || undefined,
      segment: parsed.segment || undefined,
      size: parsed.size || undefined,
      pains: Array.isArray(parsed.pains) ? parsed.pains : [],
      currentSystems: Array.isArray(parsed.currentSystems) ? parsed.currentSystems : [],
      summary: parsed.summary || undefined,
    };
  } catch (err) {
    console.error('Erro ao parsear JSON do Spotter:', err);
    return {};
  }
};
