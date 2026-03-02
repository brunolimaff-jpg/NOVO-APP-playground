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

export interface SpotterExtractedData {
  companyName?: string; contactName?: string; contactRole?: string;
  contactEmail?: string; contactPhone?: string; segment?: string;
  size?: string; pains?: string[]; currentSystems?: string[]; summary?: string;
}

const ROUTER_MODEL_ID = 'gemini-2.5-flash';
const TACTICAL_MODEL_ID = 'gemini-2.5-flash';
const DEEP_CHAT_MODEL_ID = 'gemini-3.1-pro-preview';
const DEEP_RESEARCH_MODEL_ID = 'gemini-3.1-pro-preview';

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
  if (/^#+\s/.test(trimmedStart)) return rawText;

  let text = trimmedStart;
  const forbiddenOpenings = [ /^fala[,!\.\s]*time[\.!?\s-]*/i, /^fala[,!\.\s]*(pessoal|galera)[\.!?\s-]*/i ];
  let replaced = false;
  for (const re of forbiddenOpenings) {
    if (re.test(text)) { text = text.replace(re, `${seller}, `); replaced = true; break; }
  }
  if (!replaced) return rawText;
  const match = rawText.match(/^\s*/);
  return (match ? match[0] : '') + text;
}

function parseCompetitorMarker(content: string): CompetitorDetection | null {
  const match = content.match(/\[\[COMPETITOR:([^:\]]+):([^:\]]+):([^:\]]+):([^\]]+)\]\]/);
  if (!match) return null;
  return {
    encontrado: true, nomeERP: match[1].trim(), nivelAmeaca: match[2].trim() as 'alto' | 'medio' | 'baixo',
    revendaLocal: match[3].trim(), confianca: match[4].trim() as 'alta' | 'media' | 'baixa',
  };
}

function extractEstadoFromMessage(message: string): string {
  const ufsKnown: Record<string, string> = {
    'mato grosso do sul': 'MS', 'mato grosso': 'MT', 'goiás': 'GO', 'goias': 'GO',
    'pará': 'PA', 'para': 'PA', 'maranhão': 'MA', 'maranhao': 'MA', 'tocantins': 'TO',
    'bahia': 'BA', 'minas gerais': 'MG', 'são paulo': 'SP', 'paraná': 'PR', 'parana': 'PR',
    'rio grande do sul': 'RS', ' MT ': 'MT', ' MS ': 'MS', ' GO ': 'GO', ' PA ': 'PA',
    ' BA ': 'BA', ' MG ': 'MG', ' SP ': 'SP', ' PR ': 'PR', ' RS ': 'RS',
  };
  const lower = message.toLowerCase();
  for (const [key, uf] of Object.entries(ufsKnown)) {
    if (lower.includes(key.toLowerCase())) return uf;
  }
  return 'MT';
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

  const portaMatch = text.match(/\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+)\]\]/);
  if (portaMatch) {
    scorePorta = {
      score: parseInt(portaMatch[1]), p: parseInt(portaMatch[2]), o: parseInt(portaMatch[3]),
      r: parseInt(portaMatch[4]), t: parseInt(portaMatch[5]), a: parseInt(portaMatch[6]),
    };
    text = text.replace(portaMatch[0], '');
  }

  text = text.replace(/\[\[COMPETITOR:[^\]]*\]\]/g, '').replace(/\[\[[A-Z_]+:[^\n]*?\]\]/g, '');
  text = text.replace(/\*{0,2}Score PORTA:\*{0,2}\s*\d+\/100\s*[—–-]\s*(?:Alta|Média|Baixa)\s*Compatibilidade\.?\s*/gi, '');
  text = text.replace(/^(\s*\]\s*\n)+/, '').replace(/^\s*\]/, '').replace(/^\s*\n/gm, '\n').trim();
  return { text, statuses, scorePorta };
}

const companyMetrics: Record<string, Record<string, number>> = {};
function extractMetrics(text: string): Record<string, number> {
  const m: Record<string, number> = {};
  const haMatch = text.match(/(\d[\d.,]*)\s*(mil\s+)?hect(?:ares?)?\b/i);
  if (haMatch) m.ha = haMatch[2] ? parseFloat(haMatch[1].replace(/\./g, '').replace(',', '.')) * 1000 : parseFloat(haMatch[1].replace(/\./g, '').replace(',', '.'));
  const empMatch = text.match(/\+?(\d[\d.,]*)\s*(mil\s+)?(?:colaboradores?|funcionários?|empregados?)\b/i);
  if (empMatch) m.employees = empMatch[2] ? parseFloat(empMatch[1].replace(/\./g, '').replace(',', '.')) * 1000 : parseFloat(empMatch[1].replace(/\./g, '').replace(',', '.'));
  return m;
}

let currentCompanyContext: { empresa: string; sessionId: string; timestamp: number; } | null = null;

export function generateContextReminder(companyName: string | null, sessionId?: string): string {
  if (!companyName) return '';
  currentCompanyContext = { empresa: companyName, sessionId: sessionId || 'unknown', timestamp: Date.now() };
  return `\n\n📌 [CONTEXTO ATIVO]: Você está investigando a empresa "${companyName}".\n- Mantenha foco TOTAL nesta empresa.\n- NUNCA cite nomes de empresas que não foram mencionados pelo usuário.\n`;
}

export function resetCompanyContext(): void { currentCompanyContext = null; }

export function extractSuggestionsFromResponse(content: string): string[] {
  if (!content) return [];
  const regexes = [
    /(?:---|___|\*\*\*)\s*[\r\n]+(?:\*\*|##|###)?\s*(?:🔎|⚡|🤠)?\s*(?:O que você quer descobrir agora|E aí, onde a gente joga o adubo agora|E aí, qual desses você quer cavucar|Próximos passos|Sugestões?(?:\s+de\s+perguntas)?)(?:.*?)[\r\n]+/i,
    /\n+(?:\*\*|##|###)\s*(?:🔎|⚡|🤠)?\s*(?:Sugestões?(?:\s+de\s+perguntas)?|Próximos\s+passos|O que você quer descobrir agora)\s*\*?\*?\s*[\r\n]+/i,
  ];
  for (const regex of regexes) {
    const parts = content.split(regex);
    if (parts.length >= 2) {
      return parts[parts.length - 1].split('\n').map(l => l.trim()).filter(l => /^[\*\-•\+]\s/.test(l) || /^\d+\./.test(l))
        .map(l => l.replace(/^[\*\-•\+\d\.]+\s*/, '').replace(/^\"|'|'|\"$/g, '').replace(/\*+$/, '').trim()).filter(l => l.length > 0).slice(0, 4);
    }
  }
  return [];
}

let genAI: GoogleGenAI | null = null;
const getGenAI = (): GoogleGenAI => {
  if (!genAI) {
    if (!process.env.API_KEY) throw new Error("API_KEY missing.");
    genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return genAI;
};

export const createChatSession = (systemInstruction: string, history: Message[], modelId: string, useGrounding: boolean = true, thinkingMode: boolean = false): Chat => {
  const sdkHistory: Content[] = history.filter(msg => !msg.isError).map(msg => ({ role: msg.sender === Sender.User ? 'user' : 'model', parts: [{ text: msg.text }] }));
  return getGenAI().chats.create({
    model: modelId, history: sdkHistory,
    config: {
      systemInstruction: `${CANARY_TOKEN}\n${systemInstruction}\nMODO LIVE STATUS (OBRIGATÓRIO):\nEmita marcadores [[STATUS: Mensagem]] a cada etapa da análise. Use links markdown [texto](URL).`,
      temperature: 0.15, maxOutputTokens: 65536, tools: useGrounding ? [{ googleSearch: {} }] : undefined,
    }
  });
};

export const resetChatSession = () => resetCompanyContext();

const analyzeUserIntent = async (msg: string): Promise<{ empresa: string | null; benchmark: boolean; rota: 'tatica' | 'profunda' }> => {
  if (!msg || msg.trim().length < 5) return { empresa: null, benchmark: false, rota: 'tatica' };
  try {
    const prompt = `Analise a frase: "${msg}". Extraia (JSON): 1. "empresa": NOME DA EMPRESA (ou "NONE"). 2. "benchmark": boolean. 3. "rota": "profunda" ou "tatica".`;
    const response = await getGenAI().models.generateContent({ model: ROUTER_MODEL_ID, contents: prompt, config: { temperature: 0, responseMimeType: 'application/json' } });
    const parsed = JSON.parse((response.text || '{}').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    return {
      empresa: (!parsed.empresa || parsed.empresa === 'NONE' || parsed.empresa.length < 2) ? null : parsed.empresa,
      benchmark: !!parsed.benchmark,
      rota: parsed.rota === 'profunda' ? 'profunda' : 'tatica'
    };
  } catch { return { empresa: null, benchmark: false, rota: 'tatica' }; }
};

const generateBenchmarkKeywords = async (empresaNome: string, contexto: string): Promise<string[]> => {
  try {
    const resp = await getGenAI().models.generateContent({ model: ROUTER_MODEL_ID, contents: `Gere 5 palavras-chave do SETOR de "${empresaNome}". Contexto: "${contexto}". Separadas por vírgula.`, config: { temperature: 0.1 } });
    return (resp.text || "").split(',').map(k => k.trim()).filter(k => k.length > 1);
  } catch { return []; }
};

export const generateLoadingCuriosities = async (context: string): Promise<string[]> => {
  if (!context.trim()) return [];
  try {
    const response = await getGenAI().models.generateContent({
      model: ROUTER_MODEL_ID,
      contents: `Gere 6 curiosidades REAIS e VARIADAS sobre "${context}" (máx 120 chars cada).\n\nREGRAS:\n- VARIE o formato: NÃO comece todas com o mesmo nome. Alterne entre fatos da empresa, do setor e da região\n- Inclua dados específicos: números, anos, locais\n- Exemplo BOM: "Sapezal (MT) é um dos maiores municípios produtores de soja do Brasil"\n- Exemplo BOM: "O setor de grãos movimenta R$ 400 bi por ano no Brasil"\n- Exemplo RUIM: "Forte presença em mercados internacionais" (quem? onde? quanto?)\n- No máximo 2 das 6 podem citar o nome da empresa diretamente\n\nRetorne um JSON Array de strings.`,
      config: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 1024 }
    });
    return JSON.parse(response.text || "[]");
  } catch { return []; }
};

const generateFallbackSuggestions = async (lastUserText: string, botResponseText: string, isOperacao: boolean, empresaAlvo: string | null): Promise<string[]> => {
  try {
    const isMegaPrompt = lastUserText.length > 300 && (lastUserText.includes('Protocolo de investigação') || lastUserText.includes('DIRETRIZ'));
    
    // CORREÇÃO: Sempre forçar a inclusão do nome da empresa nas sugestões
    const empresaNome = empresaAlvo || 'a empresa alvo';
    const target = `da empresa ${empresaNome}`;
    
    const effectiveUserContext = isMegaPrompt 
      ? `O usuário executou uma análise profunda (Raio-X/Dossiê) sobre ${empresaNome}.` 
      : `O usuário, investigando ${empresaNome}, enviou a pergunta: "${lastUserText.substring(0, 500)}".`;

    const response = await getGenAI().models.generateContent({
      model: ROUTER_MODEL_ID,
      contents: `${effectiveUserContext}\n\nA IA respondeu com esta análise:\n"${botResponseText.substring(0, 1000)}..."\n\n**REGRA OBRIGATÓRIA**: Cada sugestão DEVE mencionar "${empresaNome}" ou usar pronomes que deixem clara a referência à empresa (ex: "dessa empresa", "deles", "lá").\n\nGere 3 sugestões CURTAS E DIRETAS de perguntas (follow-up) que o usuário pode fazer para se aprofundar nesta resposta. \n\nExemplos BONS:\n- "Como ${empresaNome} gerencia acesso e balanças hoje?"\n- "Quais concorrentes dessa empresa em MT já usam WMS Senior?"\n- "${empresaNome} tem planos de novas aquisições nos próximos 12 meses?"\n\nExemplos RUINS (NÃO FAZER):\n- "Quais concorrentes em MT já usam o WMS?" (falta o nome da empresa)\n- "Como gerenciam acesso?" (muito genérico)\n\nRetorne APENAS um JSON Array de strings.`,
      config: { systemInstruction: "Você é o assistente B2B que sugere os próximos passos da investigação. SEMPRE mencione o nome da empresa nas sugestões.", responseMimeType: 'application/json', temperature: 0.3 }
    });

    const json = JSON.parse((response.text || "[]").replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    if (!Array.isArray(json)) return [`Mapear decisores ${target}`, `Verificar gaps técnicos de ${empresaNome}`];
    
    // Forçar substituição se a IA esqueceu
    return json
      .map((item: any) => typeof item === 'string' ? item : item?.pergunta || item?.sugestao || "Aprofundar análise")
      .map((suggestion: string) => {
        // Se não menciona a empresa, forçar adição
        if (empresaAlvo && !suggestion.toLowerCase().includes(empresaAlvo.toLowerCase()) && 
            !suggestion.includes('dessa empresa') && !suggestion.includes('deles') && !suggestion.includes('lá')) {
          return suggestion.replace(/^(\w+)/, `$1 ${empresaAlvo}`);
        }
        return suggestion;
      })
      .slice(0, 3);
  } catch { 
    const empresa = empresaAlvo || 'a empresa';
    return [`Aprofundar análise de ${empresa}`, `Mapear decisores de ${empresa}`, `Verificar gaps técnicos de ${empresa}`]; 
  }
};

export const sendMessageToGemini = async (message: string, history: Message[], systemInstruction: string, options: GeminiRequestOptions = {}): Promise<{ text: string; sources: Array<{ title: string, url: string }>, suggestions: string[], scorePorta: ScorePortaData | null, statuses: string[], empresa?: string | null, ghostReason?: string }> => {
  const { useGrounding = true, thinkingMode = false, signal, onText, onStatus, onScorePorta, onCompetitor, nomeVendedor } = options;

  const guardResult = scanInput(message);
  if (guardResult.level === 'blocked') throw normalizeAppError(new Error(`Mensagem bloqueada: ${guardResult.reason}.`), 'GUARD');

  const safeMessage = guardResult.sanitized;
  
  // AQUI FOI CORRIGIDO: Recoloquei a variável que tinha sumido
  const nomeParaInjetar = nomeVendedor?.trim() || 'Vendedor';
  const systemInstructionFinal = systemInstruction.replace(new RegExp(NOME_VENDEDOR_PLACEHOLDER.replace(/[{}]/g, '\\$&'), 'g'), nomeParaInjetar);

  const apiCall = async () => {
    onStatus?.("Analisando complexidade do pedido...");

    const isMegaPromptMessage = message.startsWith('Dossiê completo de [');
    let embeddedCompany = null;
    if (isMegaPromptMessage) {
      const match = message.match(/^Dossiê completo de \[([^\]]+)\]/);
      if (match) embeddedCompany = match[1];
      if (embeddedCompany === 'a empresa desta conversa') embeddedCompany = currentCompanyContext?.empresa || null;
    }

    const ragQuery = isMegaPromptMessage ? (embeddedCompany || 'Empresa Alvo') : message;
    const ragContextPromise = buscarContextoPinecone(ragQuery);
    const docsRagPromise = buscarContextoDocsPinecone(ragQuery);

    const intentQuery = isMegaPromptMessage ? `Investigar a empresa ${embeddedCompany || 'desconhecida'}` : message;
    const { empresa: rawEmpresa, benchmark, rota } = await analyzeUserIntent(intentQuery);
    
    let empresa = isConcorrenteOuPropria(rawEmpresa || '') ? null : rawEmpresa;
    if (isMegaPromptMessage && embeddedCompany && !isConcorrenteOuPropria(embeddedCompany)) { empresa = embeddedCompany; }
    
    if (!empresa && currentCompanyContext?.empresa) {
       empresa = currentCompanyContext.empresa;
    }

    let finalInstruction = systemInstructionFinal;
    if (!empresa && !history.some(h => h.sender === 'bot' && h.text.includes('PORTA:'))) {
      finalInstruction = `Você é o Especialista Técnico da Senior Sistemas.
SUA ÚNICA MISSÃO: Responder a pergunta técnica de forma DIRETA. 
Use os links do RAG [Texto](URL). NÃO inicie fluxos de investigação, NÃO peça CNPJ.`;
    }

    let effectiveUserMessage = safeMessage;
    if (isMegaPromptMessage) {
      const parts = message.split('\n\n');
      finalInstruction = `${parts.slice(1).join('\n\n')}\n\n---\n\n${finalInstruction}`;
      effectiveUserMessage = `Execute o protocolo de investigação forense para a empresa: ${empresa || 'a empresa alvo'}.`;
    }

    const isDeepResearch = rota === 'profunda' || isMegaPromptMessage;
    if (isDeepResearch) onStatus?.("Deep Research ativado — varredura web iniciada...");

    const chatSession = createChatSession(finalInstruction, history, isDeepResearch ? DEEP_CHAT_MODEL_ID : TACTICAL_MODEL_ID, useGrounding, thinkingMode);
    if (signal?.aborted) throw new Error("Request aborted");

    let enrichments: string[] = [];
    if (empresa) {
      if (!isConcorrenteOuPropria(empresa)) {
        onStatus?.(`Buscando histórico de ${empresa}...`);
        const lookup = await lookupCliente(empresa);
        enrichments.push(lookup.encontrado ? formatarParaPrompt(lookup) : `\n[Lookup: "${empresa}" não encontrado]\n`);
      }
      enrichments.push(generateContextReminder(empresa, currentCompanyContext?.sessionId));
      const competitorContext = getContextoConcorrentesRegionais(extractEstadoFromMessage(message));
      if (competitorContext) enrichments.push(competitorContext);
      if (benchmark || message.includes('investigar')) {
        onStatus?.("Mapeando benchmarks...");
        const bench = await benchmarkClientes(await generateBenchmarkKeywords(empresa, message));
        if (bench.ok) enrichments.push(formatarBenchmarkParaPrompt(bench, empresa));
      }
    }

    onStatus?.("Consultando bases de conhecimento...");
    const [ragContext, docsRagContext] = await Promise.all([
      Promise.race([ragContextPromise, new Promise<string>(r => setTimeout(() => r(''), 60000))]),
      Promise.race([docsRagPromise, new Promise<string>(r => setTimeout(() => r(''), 60000))])
    ]);

    if (ragContext) enrichments.push(`## INTELIGÊNCIA INTERNA (RAG)\n${sanitizeExternalContent(ragContext)}`);
    if (docsRagContext) enrichments.push(`## DOCUMENTAÇÃO SENIOR (RAG)\n${sanitizeExternalContent(docsRagContext)}`);

    const isTechnicalMode = !empresa && !history.some(h => h.sender === 'bot' && h.text.includes('PORTA:'));
    let messageToSend = enrichments.length > 0 
      ? `## PERGUNTA\n"${effectiveUserMessage}"\n\n---\n## CONTEXTO\n${enrichments.join('\n')}\n---\nO usuário perguntou: "${effectiveUserMessage}"` 
      : effectiveUserMessage;
    
    if (isTechnicalMode) messageToSend += `\n\nResponda diretamente como Especialista Senior.`;

    if (!isDeepResearch) onStatus?.("Gerando resposta...");
    const STREAM_INACTIVITY_MS = isDeepResearch ? 120000 : 90000;
    const streamPromise = chatSession.sendMessageStream({ message: messageToSend });
    const timeoutPromise = new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout (${STREAM_INACTIVITY_MS / 1000}s)`)), STREAM_INACTIVITY_MS));
    const result = await Promise.race([streamPromise, timeoutPromise]);

    let rawAccumulator = '', lastEmittedStatus = '', textMilestone = 0, streamTimedOut = false, chunkCount = 0;
    let lastEmittedScore: ScorePortaData | null = null, lastEmittedCompetitor: CompetitorDetection | null = null;
    let groundingChunks: any[] = [], inactivityTimer: ReturnType<typeof setTimeout> | null = null;

    const resetInactivity = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => { streamTimedOut = true; }, STREAM_INACTIVITY_MS);
    };
    resetInactivity();

    for await (const chunk of result) {
      if (signal?.aborted || streamTimedOut) break;
      resetInactivity();
      rawAccumulator += chunk.text || "";
      chunkCount++;
      if (chunkCount === 1) onStatus?.("Recebendo dados...");

      if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        groundingChunks = [...groundingChunks, ...chunk.candidates[0].groundingMetadata.groundingChunks];
      }

      const len = rawAccumulator.length;
      if (len > 12000 && textMilestone < 3) { onStatus?.("Finalizando dossiê..."); textMilestone = 3; }
      else if (len > 6000 && textMilestone < 2) { onStatus?.("Compilando análise..."); textMilestone = 2; }
      else if (len > 2000 && textMilestone < 1) { onStatus?.("Dossiê em construção..."); textMilestone = 1; }

      const parsed = parseMarkers(rawAccumulator);
      if (parsed.statuses.length > 0 && parsed.statuses[parsed.statuses.length - 1] !== lastEmittedStatus) {
        onStatus?.(parsed.statuses[parsed.statuses.length - 1]); lastEmittedStatus = parsed.statuses[parsed.statuses.length - 1];
      }
      if (parsed.scorePorta && JSON.stringify(parsed.scorePorta) !== JSON.stringify(lastEmittedScore)) {
        onScorePorta?.(parsed.scorePorta); lastEmittedScore = parsed.scorePorta;
      }
      onText?.(sanitizeStreamText(rawAccumulator));
    }
    if (inactivityTimer) clearTimeout(inactivityTimer);

    const finalParsed = parseMarkers(rawAccumulator);
    
    // Agora o nomeParaInjetar existe e não dará mais erro!
    let finalText = enforceOpeningWithSeller(finalParsed.text, nomeParaInjetar);

    const inlineLinks: Array<{ title: string; url: string }> = [];
    const linkRegex = /\[([^\]\n]{1,120})\]\((https?:\/\/[^)\s]{4,})\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(finalText)) !== null) {
      if (!inlineLinks.some(l => l.url === linkMatch[2])) inlineLinks.push({ title: linkMatch[1].trim(), url: linkMatch[2] });
    }
    const sources = [...groundingChunks.filter(c => c.web?.uri).map(c => ({ title: c.web.title || c.web.uri, url: c.web.uri })), ...inlineLinks];

    return {
      text: finalText, sources, suggestions: [],
      scorePorta: (!rawEmpresa || isConcorrenteOuPropria(rawEmpresa)) ? undefined : finalParsed.scorePorta,
      statuses: finalParsed.statuses, empresa,
      ghostReason: (streamTimedOut && !rawAccumulator.trim()) ? "Timeout" : undefined
    };
  };

  try {
    const responseData = await withAutoRetry('Gemini:Stream', apiCall, { maxRetries: 2 });
    
    let suggestions = extractSuggestionsFromResponse(responseData.text);
    
    if (!suggestions || suggestions.length === 0) {
      onStatus?.("Gerando ganchos comerciais finais...");
      suggestions = await generateFallbackSuggestions(message, responseData.text, systemInstruction.includes("Operação"), responseData.empresa || null);
    }

    if (responseData.empresa && responseData.text.length > 300) {
      addInvestigation({
        id: Date.now().toString(), empresa: responseData.empresa,
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
  try {
    const response = await getGenAI().models.generateContent({
      model: ROUTER_MODEL_ID,
      contents: [{ role: "user", parts: [{ text: `CONTEXTO:\n${contextText}\n\nEVITAR: ${previousSuggestions.join(', ')}\nGere 3 perguntas JSON.` }] }],
      config: { systemInstruction: CONTINUITY_SYSTEM, responseMimeType: "application/json", temperature: 0.4 }
    });
    return JSON.parse((response.text || "[]").replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim())
      .map((i: any) => typeof i === 'string' ? i : i.pergunta || i.sugestao || "Opção").slice(0, 3);
  } catch { return ["Mapear decisores", "Consultar ERP atual"]; }
};

export const generateConsolidatedDossier = async (history: Message[], systemInstruction: string, mode: ChatMode, reportType: ReportType = 'full'): Promise<string> => {
  try {
    const response = await getGenAI().models.generateContent({
      model: TACTICAL_MODEL_ID, contents: `Consolide este histórico: ${history.map(m => m.text).join('\n')}`,
      config: { systemInstruction, temperature: 0.2, maxOutputTokens: 65536 }
    });
    return response.text || "Erro na consolidação.";
  } catch (error) { throw normalizeAppError(error, 'GEMINI'); }
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
  const response = await getGenAI().models.generateContent({
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
