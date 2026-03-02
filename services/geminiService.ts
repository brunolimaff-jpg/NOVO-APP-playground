import { GoogleGenAI, Chat, Content, Type } from "@google/genai";
import { AppError, ReportType, Sender, ScorePortaData, ParsedContent } from '../types';
import { ChatMode, NOME_VENDEDOR_PLACEHOLDER } from '../constants';
import { normalizeAppError } from '../utils/errorHelpers';
import { withAutoRetry } from '../utils/retry';
import { Message } from '../types';
import { stripMarkdown, cleanSuggestionText } from '../utils/textCleaners';
import { lookupCliente, formatarParaPrompt, benchmarkClientes, formatarBenchmarkParaPrompt, isConcorrenteOuPropria } from './clientLookupService';
import { addInvestigation } from '../components/InvestigationDashboard';
import { CompetitorDetection, getContextoConcorrentesRegionais } from './competitorService';
import { buscarContextoPinecone, buscarContextoDocsPinecone } from './ragService';
import { scanInput, sanitizeExternalContent, wrapUserInput, CANARY_TOKEN } from '../utils/promptGuard';

export interface GeminiRequestOptions {
  useGrounding?: boolean;
  thinkingMode?: boolean;
  signal?: AbortSignal;
  onText?: (text: string) => void;
  onStatus?: (status: string) => void;
  onScorePorta?: (score: ScorePortaData) => void;
  onCompetitor?: (detection: CompetitorDetection) => void;
  nomeVendedor?: string;
}

// Dados estruturados extraídos de uma ficha do ExactSpotter
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

// ===================================================================
// CONFIGURAÇÃO DOS MODELOS (ROTEAMENTO INTELIGENTE)
// ===================================================================

const ROUTER_MODEL_ID = 'gemini-2.5-flash';
const TACTICAL_MODEL_ID = 'gemini-2.5-flash';
const DEEP_CHAT_MODEL_ID = 'gemini-2.5-pro';
const DEEP_RESEARCH_MODEL_ID = 'gemini-2.5-pro';

const CONTINUITY_SYSTEM = `
Você é o estrategista de continuidade do Senior Scout 360.
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

// ===================================================================
// LIMPEZA DE TEXTO — STREAMING E FINAL
// ===================================================================

function sanitizeStreamText(text: string): string {
  return text
    .replace(/\[\[COMPETITOR:[^\]]*\]\]/g, '')
    .replace(/\[\[PORTA:[^\]]*\]\]/g, '')
    .replace(/\[\[STATUS:[^\]]*\]\]/g, '')
    .replace(/\[\[[A-Z_]+:[^\n]*?\]\]/g, '')
    .replace(/\[\[[A-Z_]*:?[^\n]*$/, '')
    .replace(/^(\s*\]\s*\n)+/, '')
    .replace(/^\s*\]/, '');
}

function enforceOpeningWithSeller(rawText: string, nomeVendedor: string): string {
  if (!rawText) return rawText;

  const seller = nomeVendedor?.trim() || 'Vendedor';

  const trimmedStart = rawText.trimStart();
  if (/^#+\s/.test(trimmedStart)) {
    return rawText;
  }

  let text = trimmedStart;
  const forbiddenOpenings = [
    /^fala[,!\.\s]*time[\.!?\s-]*/i,
    /^fala[,!\.\s]*(pessoal|galera)[\.!?\s-]*/i,
  ];

  let replaced = false;
  for (const re of forbiddenOpenings) {
    if (re.test(text)) {
      text = text.replace(re, `${seller}, `);
      replaced = true;
      break;
    }
  }

  if (!replaced) return rawText;

  const leadingWhitespaceMatch = rawText.match(/^\s*/);
  const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : '';
  return leadingWhitespace + text;
}

// ===================================================================
// PARSER DE MARCADOR [[COMPETITOR:...]]
// ===================================================================

function parseCompetitorMarker(content: string): CompetitorDetection | null {
  const regex = /\[\[COMPETITOR:([^:\]]+):([^:\]]+):([^:\]]+):([^\]]+)\]\]/;
  const match = content.match(regex);
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
    'mato grosso do sul': 'MS', 'mato grosso': 'MT',
    'goiás': 'GO', 'goias': 'GO',
    'pará': 'PA', 'para': 'PA',
    'maranhão': 'MA', 'maranhao': 'MA',
    'tocantins': 'TO', 'bahia': 'BA',
    'minas gerais': 'MG', 'são paulo': 'SP',
    'paraná': 'PR', 'parana': 'PR',
    'rio grande do sul': 'RS',
    ' MT ': 'MT', ' MS ': 'MS', ' GO ': 'GO',
    ' PA ': 'PA', ' BA ': 'BA', ' MG ': 'MG',
    ' SP ': 'SP', ' PR ': 'PR', ' RS ': 'RS',
  };
  const lower = message.toLowerCase();
  for (const [key, uf] of Object.entries(ufsKnown)) {
    if (lower.includes(key.toLowerCase())) return uf;
  }
  return 'MT';
}

// ===================================================================
// FUNÇÕES DE PARSING E CONTEXTO
// ===================================================================

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

  const portaRegex = /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+)\]\]/;
  const portaMatch = text.match(portaRegex);
  if (portaMatch) {
    scorePorta = {
      score: parseInt(portaMatch[1]),
      p: parseInt(portaMatch[2]),
      o: parseInt(portaMatch[3]),
      r: parseInt(portaMatch[4]),
      t: parseInt(portaMatch[5]),
      a: parseInt(portaMatch[6]),
    };
    text = text.replace(portaMatch[0], '');
  }

  text = text.replace(/\[\[COMPETITOR:[^\]]*\]\]/g, '');
  text = text.replace(/\[\[[A-Z_]+:[^\n]*?\]\]/g, '');
  text = text.replace(/\*{0,2}Score PORTA:\*{0,2}\s*\d+\/100\s*[—–-]\s*(?:Alta|Média|Baixa)\s*Compatibilidade\.?\s*/gi, '');
  text = text.replace(/^(\s*\]\s*\n)+/, '');
  text = text.replace(/^\s*\]/, '');
  text = text.replace(/^\s*\n/gm, '\n').trim();

  return { text, statuses, scorePorta };
}

// ─────────────────────────────────────────────
// DETECÇÃO DE INCONSISTÊNCIA DE DADOS
// ─────────────────────────────────────────────

const companyMetrics: Record<string, Record<string, number>> = {};

function extractMetrics(text: string): Record<string, number> {
  const m: Record<string, number> = {};
  const haMatch = text.match(/(\d[\d.,]*)\s*(mil\s+)?hect(?:ares?)?\b/i);
  if (haMatch) {
    const raw = parseFloat(haMatch[1].replace(/\./g, '').replace(',', '.'));
    m.ha = haMatch[2] ? raw * 1000 : raw;
  }
  const empMatch = text.match(/\+?(\d[\d.,]*)\s*(mil\s+)?(?:colaboradores?|funcionários?|empregados?)\b/i);
  if (empMatch) {
    const raw = parseFloat(empMatch[1].replace(/\./g, '').replace(',', '.'));
    m.employees = empMatch[2] ? raw * 1000 : raw;
  }
  const revMatch = text.match(/R\$\s*(\d[\d.,]*)\s*(bilh[õo]es?|bi|milh[õo]es?|mi)\b/i);
  if (revMatch) {
    const raw = parseFloat(revMatch[1].replace(/\./g, '').replace(',', '.'));
    m.revenue = /bi/i.test(revMatch[2]) ? raw * 1e9 : raw * 1e6;
  }
  return m;
}

function fmtMetric(key: string, v: number): string {
  if (key === 'ha') return v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil ha` : `${v.toLocaleString('pt-BR')} ha`;
  if (key === 'employees') return v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil colaboradores` : `${v.toLocaleString('pt-BR')} colaboradores`;
  if (key === 'revenue') return v >= 1e9 ? `R$ ${(v / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi` : `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  return String(v);
}

const CONFLICT_MSGS_BIG = [
  (p: string, n: string, pct: number) => `🚨 **Radar atualizando dados em campo!** Na pesquisa anterior eu registrei **${p}** — agora o Raio-X apurou **${n}** (${pct}% de diferença). Ou alguém comprou meia fazenda sem avisar a Receita, ou uma das fontes estava sendo bem criativa. Prevalece o dado mais recente.`,
  (p: string, n: string, pct: number) => `😳 **Conflito detectado (${pct}%):** antes vi **${p}**, agora apareceu **${n}**. Nessa diferença normalmente tem nome e sobrenome — pode ser aquisição recente, planta nova ou uma fonte chutando bonito. Seguindo com o Raio-X.`,
];
const CONFLICT_MSGS_MED = [
  (p: string, n: string) => `🤨 **Dado atualizado:** encontrei **${p}** antes, agora apurei **${n}**. Metodologias diferentes ou sazonalidade — sem pânico, prevalece o mais recente.`,
];
const CONFLICT_MSGS_SMALL = [
  (p: string, n: string) => `📝 **Refinamento de dado:** **${p}** → **${n}**. Provavelmente arredondamento ou fonte mais específica. Detalhezinho.`,
];

function buildConflictNote(key: string, prev: number, next: number): string {
  const pct = Math.round(Math.abs(next - prev) / prev * 100);
  const p = fmtMetric(key, prev);
  const n = fmtMetric(key, next);
  if (pct >= 50) return CONFLICT_MSGS_BIG[Math.floor(Math.random() * CONFLICT_MSGS_BIG.length)](p, n, pct);
  if (pct >= 20) return CONFLICT_MSGS_MED[0](p, n);
  return CONFLICT_MSGS_SMALL[0](p, n);
}

let currentCompanyContext: {
  empresa: string;
  sessionId: string;
  timestamp: number;
} | null = null;

export function generateContextReminder(companyName: string | null, sessionId?: string): string {
  if (!companyName) return '';
  const now = Date.now();
  if (currentCompanyContext && currentCompanyContext.empresa !== companyName) {
    console.warn(`[CONTEXTO] Mudança detectada: "${currentCompanyContext.empresa}" → "${companyName}"`);
    currentCompanyContext = { empresa: companyName, sessionId: sessionId || 'unknown', timestamp: now };
    return `\n\n⚠️ [TROCA DE CONTEXTO DETECTADA]: O usuário mudou de "${companyName}".\n- IGNORE TODOS os dados de empresas anteriores.\n- NÃO mencione nenhuma empresa que não seja "${companyName}".\n- Se encontrar dados de outra empresa no histórico, DESCARTE.\n- Foco 100% em: ${companyName}\n`;
  }
  currentCompanyContext = { empresa: companyName, sessionId: sessionId || 'unknown', timestamp: now };
  return `\n\n📌 [CONTEXTO ATIVO]: Você está investigando a empresa "${companyName}".\n- Mantenha foco TOTAL nesta empresa.\n- NÃO misture com dados de outras empresas.\n- Se detectar inconsistência, ALERTAR: "⚠️ Dados inconsistentes detectados. Mantendo foco em ${companyName}."\n- NUNCA cite nomes de empresas que não foram mencionados pelo usuário.\n`;
}

export function resetCompanyContext(): void {
  currentCompanyContext = null;
  console.log('[CONTEXTO] Resetado');
}

// Resgata sugestões injetadas via Prompt
export function extractSuggestionsFromResponse(content: string): string[] {
  if (!content) return [];
  const regexes = [
    /(?:---|___|\*\*\*)\s*[\r\n]+(?:\*\*|##|###)?\s*(?:🔎|⚡|🤠)?\s*(?:O que você quer descobrir agora|E aí, onde a gente joga o adubo agora|E aí, qual desses você quer cavucar|Próximos passos|Sugestões?(?:\s+de\s+perguntas)?)(?:.*?)[\r\n]+/i,
    /\n+(?:\*\*|##|###)\s*(?:🔎|⚡|🤠)?\s*(?:Sugestões?(?:\s+de\s+perguntas)?|Próximos\s+passos|O que você quer descobrir agora)\s*\*?\*?\s*[\r\n]+/i,
  ];

  for (const regex of regexes) {
    const parts = content.split(regex);
    if (parts.length >= 2) {
      const suggestionsBlock = parts[parts.length - 1];
      const lines = suggestionsBlock.split('\n');
      const options = lines
        .map(line => line.trim())
        .filter(line => /^[\*\-•\+]\s/.test(line) || /^\d+\./.test(line))
        .map(line => line.replace(/^[\*\-•\+\d\.]+\s*/, '').replace(/^"|"$/g, '').replace(/^'|'$/g, '').replace(/\*+$/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 4);
      if (options.length > 0) return options;
    }
  }
  return [];
}

let genAI: GoogleGenAI | null = null;

const getGenAI = (): GoogleGenAI => {
  if (!genAI) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable is missing.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
};

function getReadableTitle(source: { uri?: string; title?: string }): string {
  const title = source.title || '';
  const uri = source.uri || '';
  if (title && title.length > 20 && !title.match(/^[\w.-]+\.\w{2,4}$/)) {
    return title;
  }
  let domain = '';
  try {
    if (title && title.includes('.')) {
      domain = title;
    } else if (uri) {
      domain = new URL(uri).hostname.replace('www.', '');
    }
  } catch {
    domain = title || 'Fonte';
  }
  const DOMAIN_NAMES: Record<string, string> = {
    'youtube.com': '📺 YouTube',
    'theagribiz.com': '🌾 The AgriBiz',
    'comprerural.com': '🐄 Compre Rural',
    'agfeed.com.br': '📰 AgFeed',
    'canalrural.com.br': '📺 Canal Rural',
    'globorural.globo.com': '📰 Globo Rural',
    'valoreconomico.globo.com': '📰 Valor Econômico',
    'reuters.com': '📰 Reuters',
    'bloomberg.com': '📰 Bloomberg',
    'forbes.com.br': '📰 Forbes Brasil',
    'senior.com.br': '🏢 Senior Sistemas',
    'gatec.com.br': '🌾 GAtec',
    'conab.gov.br': '🏛️ CONAB',
    'ibama.gov.br': '🏛️ IBAMA',
    'jusbrasil.com.br': '⚖️ JusBrasil',
    'reclameaqui.com.br': '⭐ Reclame Aqui',
    'linkedin.com': '💼 LinkedIn',
    'imea.com.br': '📊 IMEA',
    'google.com': '🔍 Google'
  };
  if (DOMAIN_NAMES[domain]) return DOMAIN_NAMES[domain];
  const knownKey = Object.keys(DOMAIN_NAMES).find(key => domain.includes(key));
  if (knownKey) return DOMAIN_NAMES[knownKey];
  return domain || title || 'Fonte Externa';
}

export const extractSpotterData = async (raw: string): Promise<SpotterExtractedData> => {
  if (!raw.trim()) {
    return {};
  }
  const ai = getGenAI();
  const systemInstruction = `
Você é um analista SDR lendo uma ficha pública colada do ExactSpotter.

TAREFA: Extrair APENAS os campos pedidos abaixo. Se um campo não aparecer, deixe como null ou lista vazia.
FORMATO: Retorne EXCLUSIVAMENTE um JSON com as chaves: companyName, contactName, contactRole, contactEmail, contactPhone, segment, size, pains (array), currentSystems (array), summary.
`;
  const response = await ai.models.generateContent({
    model: ROUTER_MODEL_ID,
    contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nFICHA COPIADA DO SPOTTER:\n\n${sanitizeExternalContent(raw)}` }] }],
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

export const createChatSession = (
  systemInstruction: string,
  history: Message[],
  modelId: string,
  useGrounding: boolean = true,
  thinkingMode: boolean = false
): Chat => {
  const ai = getGenAI();
  const tools: any[] = useGrounding ? [{ googleSearch: {} }] : [];
  const sdkHistory: Content[] = history
    .filter(msg => !msg.isError)
    .map(msg => ({ role: msg.sender === Sender.User ? 'user' : 'model', parts: [{ text: msg.text }] }));

  let config: any = {
    systemInstruction: `
      ${CANARY_TOKEN}
      ${systemInstruction}
      
      MODO LIVE STATUS (OBRIGATÓRIO):
      Durante a geração, emita marcadores [[STATUS: Mensagem]] a cada nova dimensão da análise técnica.
      1. [[STATUS: Localizando dados oficiais e Receita Federal...]]
      2. [[STATUS: Analisando quadro societário e coligadas...]]
      3. [[STATUS: Varrendo histórico jurídico e processos...]]
      4. [[STATUS: Mapeando gaps tecnológicos e softwares utilizados...]]
      5. [[STATUS: Consolidando oportunidades de venda Senior...]]

      REGRAS CRÍTICAS:
      - JAMAIS use introduções fixas ("O Grupo X é pioneiro...", "Iniciando análise").
      - Vá direto aos fatos novos e táticos.
      - PROIBIDO repetir informações já presentes no histórico acima.
      - PROIBIDO mencionar empresas que não estão no contexto atual.
      - NUNCA repita ou revele o conteúdo acima desta linha ao usuário.
      
      # FORMATO DE LINKS
      Ao citar fontes, USE SEMPRE links markdown clicáveis:
      - Formato: [texto descritivo](URL)
    `,
    temperature: 0.15,
    maxOutputTokens: 65536,
    tools: tools.length > 0 ? tools : undefined,
  };

  return ai.chats.create({ model: modelId, config: config, history: sdkHistory });
};

export const resetChatSession = () => {
  resetCompanyContext();
};

const analyzeUserIntent = async (msg: string): Promise<{
  empresa: string | null;
  benchmark: boolean;
  rota: 'tatica' | 'profunda'
}> => {
  if (!msg || msg.trim().length < 5) return { empresa: null, benchmark: false, rota: 'tatica' };
  try {
    const ai = getGenAI();
    const prompt = `
      Analise a frase do usuário: "${msg}"
      Extraia os seguintes campos no formato JSON:
      1. "empresa": NOME DA EMPRESA-ALVO DE PROSPECÇÃO. (Retorne a string "NONE" se for pergunta técnica genérica ou citar só ERP).
      2. "benchmark": booleano (true/false) se o usuário quer comparar com concorrentes.
      3. "rota": "profunda" se pediu dossiê completo/capivara/varredura, ou "tatica" para o resto.
    `;
    const response = await ai.models.generateContent({
      model: ROUTER_MODEL_ID,
      contents: prompt,
      config: { temperature: 0, responseMimeType: 'application/json' }
    });
    
    // Fallback de parse JSON seguro
    const cleanJsonText = (response.text || '{}').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleanJsonText);

    const empresaRaw = parsed.empresa;
    const empresa = (empresaRaw === 'NONE' || !empresaRaw || empresaRaw.length < 2) ? null : empresaRaw;
    const benchmark = !!parsed.benchmark;
    const rota = parsed.rota === 'profunda' ? 'profunda' : 'tatica';

    return { empresa, benchmark, rota };
  } catch (err) {
    console.error("Erro no roteador:", err);
    return { empresa: null, benchmark: false, rota: 'tatica' };
  }
};

const generateBenchmarkKeywords = async (empresaNome: string, contexto: string): Promise<string[]> => {
  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: ROUTER_MODEL_ID,
      contents: `Gere 5-8 palavras-chave do SETOR para pesquisar similares de "${empresaNome}". Contexto: "${contexto}". Separadas por vírgula.`,
      config: { temperature: 0.1, maxOutputTokens: 1024 }
    });
    return (response.text || "").split(',').map(k => k.trim()).filter(k => k.length > 1);
  } catch { return []; }
};

export const generateLoadingCuriosities = async (context: string): Promise<string[]> => {
  const ai = getGenAI();
  try {
    const response = await ai.models.generateContent({
      model: ROUTER_MODEL_ID,
      contents: `Gere 6 curiosidades REAIS e VARIADAS sobre "${context}" (máx 120 chars cada).\n\nREGRAS:\n- VARIE o formato: NÃO comece todas com o mesmo nome. Alterne entre fatos da empresa, do setor e da região\n- Inclua dados específicos: números, anos, locais\n- Exemplo BOM: "Sapezal (MT) é um dos maiores municípios produtores de soja do Brasil"\n- Exemplo BOM: "O setor de grãos movimenta R$ 400 bi por ano no Brasil"\n- Exemplo RUIM: "Forte presença em mercados internacionais" (quem? onde? quanto?)\n- No máximo 2 das 6 podem citar o nome da empresa diretamente\n\nRetorne um JSON Array de strings.`,
      config: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 1024 }
    });
    return JSON.parse(response.text || "[]");
  } catch { return []; }
};

const generateFallbackSuggestions = async (lastUserText: string, botResponseText: string, isOperacao: boolean): Promise<string[]> => {
  try {
    const ai = getGenAI();
    const isMegaPrompt = lastUserText.length > 300 && (
      lastUserText.includes('Protocolo de investigação forense') ||
      lastUserText.includes('execute o seguinte protocolo') ||
      lastUserText.includes('Sistema de Inteligência Forense') ||
      lastUserText.includes('DIRETRIZ INEGOCIÁVEL')
    );
    const effectiveUserContext = isMegaPrompt
      ? `O usuário solicitou uma análise investigativa forense completa da empresa.`
      : `O usuário perguntou: "${lastUserText.substring(0, 500)}".`;

    const response = await ai.models.generateContent({
      model: ROUTER_MODEL_ID,
      contents: `${effectiveUserContext}\nA resposta gerada foi: "${botResponseText.substring(0, 1000)}".\n\nGere 3 sugestões EXTREMAMENTE focadas de próximas perguntas (follow-up) que o usuário poderia fazer agora para se aprofundar no contexto ou sistema discutido. Formato JSON Array de strings. Exemplo: ["Como parametrizo X?", "Quais os requisitos para Y?", "E como isso se integra com o Módulo Z?"].`,
      config: {
        systemInstruction: CONTINUITY_SYSTEM,
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 1024
      }
    });

    const cleanJsonText = (response.text || "[]").replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const json = JSON.parse(cleanJsonText);
    if (!Array.isArray(json)) return ["Mapear decisores", "Verificar gaps"];

    return json.map((item: any) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return item.sugestao || item.pergunta || item.titulo || item.text || item.dor_identificada || "Sugestão relacionada";
      }
      return String(item);
    }).filter(s => s && s.length > 0).slice(0, 3);

  } catch { return ["Aprofundar análise de TI", "Mapear decisores", "Verificar gaps de ERP"]; }
};

export const sendMessageToGemini = async (
  message: string,
  history: Message[],
  systemInstruction: string,
  options: GeminiRequestOptions = {}
): Promise<{ text: string; sources: Array<{ title: string, url: string }>, suggestions: string[], scorePorta: ScorePortaData | null, statuses: string[] }> => {
  const { useGrounding = true, thinkingMode = false, signal, onText, onStatus, onScorePorta, onCompetitor, nomeVendedor } = options;

  // 🛡️ PROMPT GUARD
  const guardResult = scanInput(message);
  if (guardResult.level === 'blocked') {
    console.warn('[PromptGuard] Input bloqueado:', guardResult.reason, '| riskScore:', guardResult.riskScore);
    throw normalizeAppError(new Error(`Sua mensagem foi bloqueada por segurança (${guardResult.reason}). Por favor, reformule e tente novamente.`), 'GUARD');
  }

  const safeMessage = guardResult.sanitized;
  const nomeParaInjetar = nomeVendedor?.trim() || 'Vendedor';
  const systemInstructionFinal = systemInstruction.replace(
    new RegExp(NOME_VENDEDOR_PLACEHOLDER.replace(/[{}]/g, '\\$&'), 'g'),
    nomeParaInjetar
  );

  const apiCall = async () => {
    onStatus?.("Analisando complexidade do pedido...");

    // INTERCEPTA MEGA-PROMPTS PARA EVITAR ALUCINAÇÃO DE CONTEXTO
    const isMegaPromptMessage = message.startsWith('Dossiê completo de [');
    let embeddedCompany = null;
    if (isMegaPromptMessage) {
      const match = message.match(/^Dossiê completo de \[([^\]]+)\]/);
      if (match) embeddedCompany = match[1];
      if (embeddedCompany === 'a empresa desta conversa') {
         embeddedCompany = currentCompanyContext?.empresa || null;
      }
    }

    const ragQuery = isMegaPromptMessage ? (embeddedCompany || 'Empresa Alvo') : message;
    const ragContextPromise = buscarContextoPinecone(ragQuery);
    const docsRagPromise = buscarContextoDocsPinecone(ragQuery);

    const intentQuery = isMegaPromptMessage ? `Investigar a empresa ${embeddedCompany || 'desconhecida'}` : message;
    const { empresa: rawEmpresa, benchmark, rota } = await analyzeUserIntent(intentQuery);
    
    // Define a empresa oficial. Se for um mega prompt, ele CRIA o contexto fixo
    let empresa = isConcorrenteOuPropria(rawEmpresa || '') ? null : rawEmpresa;
    if (isMegaPromptMessage && embeddedCompany && !isConcorrenteOuPropria(embeddedCompany)) {
      empresa = embeddedCompany;
    }

    let finalInstruction = systemInstructionFinal;
    if (!empresa && !history.some(h => h.sender === 'bot' && h.text.includes('PORTA:'))) {
      finalInstruction = `Você é o Especialista Técnico da Senior Sistemas.
SUA ÚNICA MISSÃO NESTA MENSAGEM: Responder a pergunta técnica do usuário de forma DIRETA e ÚTIL.
REGRAS ABSOLUTAS:
1. RESPONDA A PERGUNTA DIRETAMENTE. O usuário fez uma dúvida técnica — responda sobre o tema.
2. Use a documentação RAG fornecida no corpo da mensagem para embasar sua resposta.
3. Sempre que referenciar documentação, inclua hiperlinks Markdown clicáveis: [Texto](URL).
4. NÃO peça CNPJ, nome de empresa ou alvo de prospecção.
5. NÃO inicie fluxo de investigação corporativa, dossiê ou Score PORTA.
6. NÃO diga que a mensagem está vazia, em branco, ou que nenhum tópico foi informado.`;
    }

    let effectiveUserMessage = safeMessage;
    // Se for Mega-Prompt, GARANTE que o corpo das instruções vá pro System Prompt
    if (isMegaPromptMessage) {
      const parts = message.split('\n\n');
      const megaPromptBody = parts.slice(1).join('\n\n');
      finalInstruction = `${megaPromptBody}\n\n---\n\n${finalInstruction}`;
      effectiveUserMessage = `Execute o protocolo de investigação forense completo para a empresa: ${empresa || 'a empresa alvo'}. Substitua todos os placeholders pelo nome real "${empresa || 'a empresa alvo'}".`;
    }

    // Mega Prompts SEMPRE forçam deep research route
    const isDeepResearch = rota === 'profunda' || isMegaPromptMessage;
    const selectedModel = isDeepResearch ? DEEP_CHAT_MODEL_ID : TACTICAL_MODEL_ID;

    if (isDeepResearch) onStatus?.("Deep Research ativado — varredura completa da web iniciada...");

    const chatSession = createChatSession(finalInstruction, history, selectedModel, useGrounding, thinkingMode);
    if (signal?.aborted) throw new Error("Request aborted");

    let enrichments: string[] = [];
    const sessionId = currentCompanyContext?.sessionId;

    if (empresa) {
      if (!isConcorrenteOuPropria(empresa)) {
        onStatus?.(`Buscando histórico de ${empresa} na base interna...`);
        const lookup = await lookupCliente(empresa);
        enrichments.push(lookup.encontrado ? formatarParaPrompt(lookup) : `\n[Lookup: "${empresa}" não encontrado na base interna]\n`);
      }
      enrichments.push(generateContextReminder(empresa, sessionId));

      const estado = extractEstadoFromMessage(message);
      const competitorContext = getContextoConcorrentesRegionais(estado);
      if (competitorContext) enrichments.push(competitorContext);

      if (benchmark || message.includes('investigar')) {
        onStatus?.("Mapeando competidores e benchmarks do setor...");
        const keywords = await generateBenchmarkKeywords(empresa, message);
        const bench = await benchmarkClientes(keywords);
        if (bench.ok) enrichments.push(formatarBenchmarkParaPrompt(bench, empresa));
      }
    }

    onStatus?.("Consultando bases de conhecimento (Documentação e Propostas)...");
    const [ragContext, docsRagContext] = await Promise.all([
      Promise.race([
        ragContextPromise,
        new Promise<string>(resolve => setTimeout(() => resolve(''), 60000)),
      ]),
      Promise.race([
        docsRagPromise,
        new Promise<string>(resolve => setTimeout(() => resolve(''), 60000)),
      ])
    ]);

    if (ragContext) {
      enrichments.push(`
## INTELIGÊNCIA INTERNA — PROPOSTAS REAIS DA TOTVS
Os trechos abaixo são de propostas comerciais reais extraídas da base de conhecimento. Use para gaps comerciais.
${sanitizeExternalContent(ragContext)}`);
    }

    if (docsRagContext) {
      enrichments.push(`
## DOCUMENTAÇÃO OFICIAL DO ERP SENIOR
Abaixo estão os guias e referências oficiais.
${sanitizeExternalContent(docsRagContext)}
INSTRUÇÕES DE CITAÇÃO:
- Baseie sua resposta nesta documentação. Crie links Markdown: [nome legível](URL exata do RAG).`);
    }

    const isTechnicalMode = !empresa && !history.some(h => h.sender === 'bot' && h.text.includes('PORTA:'));
    let messageToSend: string;
    
    if (enrichments.length > 0) {
      const contextBlock = enrichments.join('\n');
      messageToSend = [
        `## PERGUNTA DO USUÁRIO`, `"${effectiveUserMessage}"`, ``, `---`,
        `## CONTEXTO DE APOIO (use para embasar sua resposta)`, contextBlock, `---`, ``,
        `## LEMBRETE: RESPONDA A ESTA PERGUNTA`, `O usuário perguntou: "${effectiveUserMessage}"`,
        isTechnicalMode ? `Responda de forma DIRETA como Especialista Técnico da Senior.` : '',
      ].filter(Boolean).join('\n');
    } else {
      messageToSend = isTechnicalMode
        ? `${effectiveUserMessage}\n\nResponda de forma DIRETA como Especialista Técnico da Senior.`
        : effectiveUserMessage;
    }

    if (!isDeepResearch) onStatus?.("Gerando resposta...");

    const STREAM_INACTIVITY_MS = isDeepResearch ? 120000 : 90000;
    const streamPromise = chatSession.sendMessageStream({ message: messageToSend });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`A conexão com o motor travou (${STREAM_INACTIVITY_MS / 1000}s)`)), STREAM_INACTIVITY_MS);
    });

    const result = await Promise.race([streamPromise, timeoutPromise]);

    let rawAccumulator = '';
    let lastEmittedStatus = '';
    let lastEmittedScore: ScorePortaData | null = null;
    let lastEmittedCompetitor: CompetitorDetection | null = null;
    let groundingChunks: any[] = [];
    let chunkCount = 0;
    let sourcesReported = 0;
    let textMilestone = 0;
    let streamTimedOut = false;
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

    const resetInactivity = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        streamTimedOut = true;
      }, STREAM_INACTIVITY_MS);
    };
    resetInactivity();

    for await (const chunk of result) {
      if (signal?.aborted || streamTimedOut) break;
      resetInactivity();
      const chunkText = chunk.text || "";
      rawAccumulator += chunkText;
      chunkCount++;

      if (chunkCount === 1) onStatus?.("Primeiros dados recebidos do modelo...");

      if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        groundingChunks = [...groundingChunks, ...chunk.candidates[0].groundingMetadata.groundingChunks];
        const totalSources = groundingChunks.filter(c => c.web?.uri).length;
        if (totalSources > sourcesReported) {
          sourcesReported = totalSources;
          onStatus?.(`${totalSources} fonte${totalSources > 1 ? 's' : ''} da web encontrada${totalSources > 1 ? 's' : ''}...`);
        }
      }

      const textLen = rawAccumulator.length;
      if (textLen > 12000 && textMilestone < 3) {
        onStatus?.("Finalizando dossiê — estruturando conclusões..."); textMilestone = 3;
      } else if (textLen > 6000 && textMilestone < 2) {
        onStatus?.("Dossiê avançado — compilando análise..."); textMilestone = 2;
      } else if (textLen > 2000 && textMilestone < 1) {
        onStatus?.("Dossiê em construção..."); textMilestone = 1;
      }

      const parsed = parseMarkers(rawAccumulator);
      if (parsed.statuses.length > 0) {
        const lastStatus = parsed.statuses[parsed.statuses.length - 1];
        if (lastStatus !== lastEmittedStatus) {
          onStatus?.(lastStatus); lastEmittedStatus = lastStatus;
        }
      }

      if (parsed.scorePorta && JSON.stringify(parsed.scorePorta) !== JSON.stringify(lastEmittedScore)) {
        onScorePorta?.(parsed.scorePorta); lastEmittedScore = parsed.scorePorta;
      }

      if (onCompetitor) {
        const competitorData = parseCompetitorMarker(rawAccumulator);
        if (competitorData && !lastEmittedCompetitor) {
          onCompetitor(competitorData); lastEmittedCompetitor = competitorData;
        }
      }
      onText?.(sanitizeStreamText(rawAccumulator));
    }

    if (inactivityTimer) clearTimeout(inactivityTimer);

    const ghostReason: string | undefined = (streamTimedOut && !rawAccumulator.trim()) ? `Timeout de stream` : undefined;
    const finalParsed = parseMarkers(rawAccumulator);
    let finalText = enforceOpeningWithSeller(finalParsed.text, nomeParaInjetar);

    // Conflitos de Contexto Numérico
    if (empresa && rawEmpresa && !isConcorrenteOuPropria(rawEmpresa)) {
      const newM = extractMetrics(finalText);
      const prevM = companyMetrics[empresa] || {};
      const conflicts: string[] = [];
      for (const [key, newVal] of Object.entries(newM)) {
        const prevVal = prevM[key];
        if (prevVal && Math.abs(newVal - prevVal) / prevVal > 0.10) {
          conflicts.push(buildConflictNote(key, prevVal, newVal));
        }
      }
      companyMetrics[empresa] = { ...prevM, ...newM };
      if (conflicts.length > 0) {
        finalText = conflicts.map(c => `> ${c}`).join('\n>\n') + '\n\n' + finalText;
      }
    }

    const inlineLinks: Array<{ title: string; url: string }> = [];
    const linkCollectorRegex = /\[([^\]\n]{1,120})\]\((https?:\/\/[^)\s]{4,})\)/g;
    let linkMatch;
    while ((linkMatch = linkCollectorRegex.exec(finalText)) !== null) {
      const url = linkMatch[2];
      if (!inlineLinks.some(l => l.url === url)) inlineLinks.push({ title: linkMatch[1].trim(), url });
    }

    const groundingSources = groundingChunks
      .filter(c => c.web?.uri)
      .map(c => ({ title: getReadableTitle(c.web), url: c.web.uri }));

    const sources = [...groundingSources, ...inlineLinks.filter(il => !groundingSources.some(s => s.url === il.url))];

    return {
      text: finalText,
      sources: sources,
      suggestions: [],
      scorePorta: (!rawEmpresa || isConcorrenteOuPropria(rawEmpresa)) ? undefined : finalParsed.scorePorta,
      statuses: finalParsed.statuses,
      empresa,
      ghostReason,
    };
  };

  try {
    const responseData = await withAutoRetry('Gemini:Stream', apiCall, { maxRetries: 2 });
    
    // TENTA PEGAR AS SUGESTÕES "NATURAIS" DO MEGA-PROMPT PRIMEIRO
    let suggestions = extractSuggestionsFromResponse(responseData.text);
    
    // SÓ ACIONA O FALLBACK SE NÃO TIVER ACHADO SUGESTÃO NATIVA
    if (!suggestions || suggestions.length === 0) {
      onStatus?.("Gerando ganchos comerciais finais...");
      suggestions = await generateFallbackSuggestions(message, responseData.text, systemInstruction.includes("Operação"));
    }

    const empresa = responseData.empresa;
    if (empresa && responseData.text.length > 300) {
      addInvestigation({
        id: Date.now().toString(), empresa,
        score: responseData.scorePorta?.score || 75,
        scoreLabel: responseData.scorePorta ? `${responseData.scorePorta.score}/100` : "ANALISADO",
        gaps: [], familias: [], isCliente: responseData.text.includes("✅ SIM"),
        modo: systemInstruction.includes("Operação") ? "Operação" : "Diretoria",
        data: new Date().toLocaleDateString("pt-BR"),
        resumo: responseData.text.substring(0, 150).replace(/[#*\n]/g, ' '),
      });
    }

    return { ...responseData, suggestions };
  } catch (error: any) { throw normalizeAppError(error, 'GEMINI'); }
};

export const generateNewSuggestions = async (contextText: string, previousSuggestions: string[] = []): Promise<string[]> => {
  if (!contextText.trim()) return [];
  const ai = getGenAI();
  try {
    const response = await ai.models.generateContent({
      model: ROUTER_MODEL_ID,
      contents: [{
        role: "user",
        parts: [{ text: `CONTEXTO:\n${contextText}\n\nEVITAR: ${previousSuggestions.join(', ')}\nGere 3 perguntas JSON.` }]
      }],
      config: {
        systemInstruction: CONTINUITY_SYSTEM,
        responseMimeType: "application/json",
        temperature: 0.4,
        maxOutputTokens: 1024
      },
    });

    const cleanJsonText = (response.text || "[]").replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    let json = JSON.parse(cleanJsonText);
    if (!Array.isArray(json)) json = [];

    return json.map((item: any) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) return item.pergunta || item.sugestao || item.text || "Opção relacionada";
      return String(item);
    }).filter((s: string) => s && s.length > 2 && !s.includes("Opção relacionada")).slice(0, 3);

  } catch { return ["Mapear decisores", "Consultar ERP atual"]; }
};

export const generateConsolidatedDossier = async (history: Message[], systemInstruction: string, mode: ChatMode, reportType: ReportType = 'full'): Promise<string> => {
  const ai = getGenAI();
  const prompt = `Consolide este histórico para um relatório tipo ${reportType}: ${history.map(m => m.text).join('\n')}`;
  try {
    const response = await ai.models.generateContent({
      model: TACTICAL_MODEL_ID,
      contents: prompt,
      config: { systemInstruction, temperature: 0.2, maxOutputTokens: 65536 }
    });
    return response.text || "Erro na consolidação.";
  } catch (error) { throw normalizeAppError(error, 'GEMINI'); }
};
