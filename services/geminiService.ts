import { GoogleGenAI, Chat, Content, Type } from "@google/genai";
import { AppError, ReportType, Sender, ScorePortaData, ParsedContent } from '../types';
import { ChatMode } from '../constants';
import { normalizeAppError } from '../utils/errorHelpers';
import { withAutoRetry } from '../utils/retry';
import { Message } from '../types';
import { stripMarkdown, cleanSuggestionText, cleanStatusMarkers } from '../utils/textCleaners';
import { lookupCliente, formatarParaPrompt, benchmarkClientes, formatarBenchmarkParaPrompt } from './clientLookupService';
import { addInvestigation } from '../components/InvestigationDashboard';

export interface GeminiRequestOptions {
  useGrounding?: boolean;
  thinkingMode?: boolean;
  signal?: AbortSignal;
  onText?: (text: string) => void;
  onStatus?: (status: string) => void;
  onScorePorta?: (score: ScorePortaData) => void;
}

// ===================================================================
// CONFIGURAÇÃO DOS MODELOS (ROTEAMENTO INTELIGENTE)
// ===================================================================

// O "Maestro" - Rápido, barato, decide para onde a pergunta vai
const ROUTER_MODEL_ID = 'gemini-2.5-flash'; 

// Rota 1: Tática (Mais rápido, focado em ferramentas e respostas pontuais)
const TACTICAL_MODEL_ID = 'gemini-3.1-pro-preview-customtools';

// Rota 2: Dossiê Profundo (Lento, mas cruza dados da web inteira)
const DEEP_RESEARCH_MODEL_ID = 'deep-research-pro-preview-12-2025';

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

  text = text.replace(/^\s*\n/gm, '\n').trim();
  return { text, statuses, scorePorta };
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
    return `\n\n⚠️ [TROCA DE CONTEXTO DETECTADA]: O usuário mudou de "${currentCompanyContext.empresa}" para "${companyName}".\n- IGNORE TODOS os dados de empresas anteriores.\n- NÃO mencione nenhuma empresa que não seja "${companyName}".\n- Se encontrar dados de outra empresa no histórico, DESCARTE.\n- Foco 100% em: ${companyName}\n`;
  }
  currentCompanyContext = { empresa: companyName, sessionId: sessionId || 'unknown', timestamp: now };
  return `\n\n📌 [CONTEXTO ATIVO]: Você está investigando a empresa "${companyName}".\n- Mantenha foco TOTAL nesta empresa.\n- NÃO misture com dados de outras empresas.\n- Se detectar inconsistência, ALERTAR: "⚠️ Dados inconsistentes detectados. Mantendo foco em ${companyName}."\n- NUNCA cite nomes de empresas que não foram mencionados pelo usuário.\n`;
}

export function resetCompanyContext(): void {
  currentCompanyContext = null;
  console.log('[CONTEXTO] Resetado');
}

export function extractSuggestionsFromResponse(content: string): string[] {
  const suggestions: string[] = [];
  const suggestionsMatch = content.match(/\*\*Sugestões\*\*\n([\s\S]*?)(?=\n---|\n\*\*|$)/i);
  if (suggestionsMatch) {
    const lines = suggestionsMatch[1].split('\n');
    lines.forEach(line => {
      const match = line.match(/^-\s*"([^"]+)"/);
      if (match) {
        suggestions.push(match[1]);
      }
    });
  }
  return suggestions;
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

export const createChatSession = (
  systemInstruction: string, 
  history: Message[],
  modelId: string, // Agora recebe o modelo dinamicamente
  useGrounding: boolean = true,
  thinkingMode: boolean = false 
): Chat => {
  const ai = getGenAI();
  const tools: any[] = useGrounding ? [{ googleSearch: {} }] : [];

  const sdkHistory: Content[] = history
    .filter(msg => !msg.isError)
    .map(msg => ({
      role: msg.sender === Sender.User ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

  let config: any = {
    systemInstruction: `
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
      
      # FORMATO DE LINKS
      Ao citar fontes, USE SEMPRE links markdown clicáveis:
      - Formato: [texto descritivo](URL)
    `,
    temperature: 0.15,
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
      Extraia 3 informações separadas por "|":
      1. NOME DA EMPRESA (limpo, sem LTDA/SA. Se não houver, responda NONE)
      2. BENCHMARK: O usuário quer comparar com concorrentes? (SIM/NAO)
      3. ROTA: Responda PROFUNDA se o usuário pediu um "dossiê completo", "investigação completa", "capivara", "varredura" ou quer saber TUDO sobre a empresa. Responda TATICA se for uma pergunta específica, pontual ou continuação de conversa.
    `;

    const response = await ai.models.generateContent({
      model: ROUTER_MODEL_ID,
      contents: prompt,
      config: { temperature: 0, maxOutputTokens: 200 }
    });
    
    const text = (response.text || 'NONE|NAO|TATICA').trim().replace(/["'`]+/g, '');
    const parts = text.split('|');
    
    const empresaRaw = (parts[0] || '').trim();
    const empresa = (empresaRaw === 'NONE' || empresaRaw.length < 2) ? null : empresaRaw;
    const benchmark = parts[1]?.trim() === 'SIM';
    const rota = parts[2]?.trim() === 'PROFUNDA' ? 'profunda' : 'tatica';

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
      config: { temperature: 0.1, maxOutputTokens: 200 }
    });
    return (response.text || "").split(',').map(k => k.trim()).filter(k => k.length > 1);
  } catch { return []; }
};

export const generateLoadingCuriosities = async (context: string): Promise<string[]> => {
  const ai = getGenAI();
  try {
    const response = await ai.models.generateContent({
      model: ROUTER_MODEL_ID,
      contents: `Gere 6 curiosidades REAIS e VARIADAS sobre "${context}" (máx 120 chars cada).

REGRAS:
- VARIE o formato: NÃO comece todas com o mesmo nome. Alterne entre fatos da empresa, do setor e da região
- Inclua dados específicos: números, anos, locais
- Exemplo BOM: "Sapezal (MT) é um dos maiores municípios produtores de soja do Brasil"
- Exemplo BOM: "O setor de grãos movimenta R$ 400 bi por ano no Brasil"
- Exemplo RUIM: "Forte presença em mercados internacionais" (quem? onde? quanto?)
- No máximo 2 das 6 podem citar o nome da empresa diretamente

Retorne um JSON Array de strings.`,
      config: { responseMimeType: 'application/json', temperature: 0.8 }
    });
    return JSON.parse(response.text || "[]");
  } catch { return []; }
};

const generateFallbackSuggestions = async (lastUserText: string, botResponseText: string, isOperacao: boolean): Promise<string[]> => {
  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: ROUTER_MODEL_ID, 
      contents: `Gere 3 sugestões JSON baseadas nesta resposta: "${botResponseText.substring(0, 1000)}"`,
      config: { 
        systemInstruction: CONTINUITY_SYSTEM,
        responseMimeType: 'application/json', 
        temperature: 0.3 
      }
    });
    
    const json = JSON.parse(response.text || "[]");
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
): Promise<{ text: string; sources: Array<{title: string, url: string}>, suggestions: string[], scorePorta: ScorePortaData | null, statuses: string[] }> => {
  const { useGrounding = true, thinkingMode = false, signal, onText, onStatus, onScorePorta } = options;

  const apiCall = async () => {
    onStatus?.("Analisando complexidade do pedido...");
    const { empresa, benchmark, rota } = await analyzeUserIntent(message);

    const selectedModel = rota === 'profunda' ? DEEP_RESEARCH_MODEL_ID : TACTICAL_MODEL_ID;
    
    const isDeepResearch = rota === 'profunda';

    if (isDeepResearch) {
      onStatus?.("Deep Research ativado — varredura completa da web iniciada...");
    }

    const chatSession = createChatSession(systemInstruction, history, selectedModel, useGrounding, thinkingMode);
    if (signal?.aborted) throw new Error("Request aborted");

    let messageToSend = message;
    let enrichments: string[] = [];

    const sessionId = currentCompanyContext?.sessionId;

    if (empresa) {
      onStatus?.(`Buscando histórico de ${empresa} na base interna...`);
      const lookup = await lookupCliente(empresa);
      enrichments.push(lookup.encontrado ? formatarParaPrompt(lookup) : `\n[Lookup: "${empresa}" não encontrado na base interna]\n`);

      enrichments.push(generateContextReminder(empresa, sessionId));

      if (benchmark || message.includes('investigar')) {
        onStatus?.("Mapeando competidores e benchmarks do setor...");
        const keywords = await generateBenchmarkKeywords(empresa, message);
        const bench = await benchmarkClientes(keywords);
        if (bench.ok) enrichments.push(formatarBenchmarkParaPrompt(bench, empresa));
      }
    }

    if (enrichments.length > 0) messageToSend = enrichments.join('\n') + `\n\nUSUÁRIO: ${message}`;

    if (isDeepResearch) {
      onStatus?.("IA varrendo a web — pode levar alguns minutos...");
    } else {
      onStatus?.("Gerando resposta...");
    }

    const result = await chatSession.sendMessageStream({ message: messageToSend });
    let rawAccumulator = '';
    let lastEmittedStatus = '';
    let lastEmittedScore: ScorePortaData | null = null;
    let groundingChunks: any[] = [];
    let chunkCount = 0;
    let sourcesReported = 0;
    let textMilestone = 0; // 0=nenhum, 1=2k, 2=6k, 3=12k

    for await (const chunk of result) {
      if (signal?.aborted) break;
      const chunkText = chunk.text || "";
      rawAccumulator += chunkText;
      chunkCount++;

      // Status real: primeiro chunk recebido
      if (chunkCount === 1) {
        onStatus?.("Primeiros dados recebidos do modelo...");
      }

      if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        const newChunks = chunk.candidates[0].groundingMetadata.groundingChunks;
        groundingChunks = [...groundingChunks, ...newChunks];

        // Status real: fontes encontradas na web
        const totalSources = groundingChunks.filter(c => c.web?.uri).length;
        if (totalSources > sourcesReported) {
          sourcesReported = totalSources;
          onStatus?.(`${totalSources} fonte${totalSources > 1 ? 's' : ''} da web encontrada${totalSources > 1 ? 's' : ''} — analisando...`);
        }
      }

      // Status real: marcos de tamanho do dossiê
      const textLen = rawAccumulator.length;
      if (textLen > 12000 && textMilestone < 3) {
        onStatus?.("Finalizando dossiê — estruturando conclusões...");
        textMilestone = 3;
      } else if (textLen > 6000 && textMilestone < 2) {
        onStatus?.("Dossiê avançado — compilando análise detalhada...");
        textMilestone = 2;
      } else if (textLen > 2000 && textMilestone < 1) {
        onStatus?.("Dossiê em construção — gerando análise...");
        textMilestone = 1;
      }

      const parsed = parseMarkers(rawAccumulator);

      // Status real: markers do próprio modelo [[STATUS: ...]]
      if (parsed.statuses.length > 0) {
        const lastStatus = parsed.statuses[parsed.statuses.length - 1];
        if (lastStatus !== lastEmittedStatus) {
          onStatus?.(lastStatus);
          lastEmittedStatus = lastStatus;
        }
      }

      if (parsed.scorePorta && parsed.scorePorta !== lastEmittedScore) {
        onScorePorta?.(parsed.scorePorta);
        lastEmittedScore = parsed.scorePorta;
      }

      const { cleanText } = cleanStatusMarkers(rawAccumulator);
      onText?.(cleanText.replace(/\[\[?S?T?A?T?U?S?:?.*$/, ''));
    }

    const finalParsed = parseMarkers(rawAccumulator);
    return {
      text: finalParsed.text,
      sources: groundingChunks.filter(c => c.web?.uri).map(c => ({ title: getReadableTitle(c.web), url: c.web.uri })),
      suggestions: [],
      scorePorta: finalParsed.scorePorta,
      statuses: finalParsed.statuses,
      empresa,
    };
  };

  try {
    const responseData = await withAutoRetry('Gemini:Stream', apiCall, { maxRetries: 2 });
    onStatus?.("Gerando ganchos comerciais finais...");
    const suggestions = await generateFallbackSuggestions(message, responseData.text, systemInstruction.includes("Operação"));

    const empresa = responseData.empresa;
    if (empresa && responseData.text.length > 300) {
      addInvestigation({
        id: Date.now().toString(),
        empresa,
        score: responseData.scorePorta?.score || 75,
        scoreLabel: responseData.scorePorta ? `${responseData.scorePorta.score}/100` : "ANALISADO",
        gaps: [], familias: [],
        isCliente: responseData.text.includes("✅ SIM"),
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
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
        temperature: 0.4 
      },
    });
    
    const jsonText = response.text || "[]";
    let json = JSON.parse(jsonText);
    if (!Array.isArray(json)) json = [];

    return json.map((item: any) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return item.pergunta || item.sugestao || item.text || "Opção relacionada";
      }
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
      config: { systemInstruction, temperature: 0.2 }
    });
    return response.text || "Erro na consolidação.";
  } catch (error) { throw normalizeAppError(error, 'GEMINI'); }
};

// ===================================================================
// WAR ROOM / OSINT - Execução de prompts de inteligência competitiva
// ===================================================================

export const runWarRoomOSINT = async (prompt: string): Promise<string> => {
  const DEEP_RESEARCH_MODEL_ID = 'deep-research-pro-preview-12-2025';
  const systemPrompt = "Você é um Diretor de Inteligência Competitiva e Hacker OSINT. Varra a web inteira em busca de dados públicos para montar dossiês estratégicos de concorrentes. Use Deep Research para cruzar informações de tribunais, CVM, portais de carreira, fóruns e notícias.";

  try {
    const chatSession = createChatSession(systemPrompt, [], DEEP_RESEARCH_MODEL_ID, true, false);
    const result = await chatSession.sendMessageStream({ message: prompt } as any);

    let finalReport = '';
    for await (const chunk of result) {
      finalReport += chunk.text || "";
    }

    return finalReport || "Nenhum dado retornado pela varredura.";
  } catch (error: any) {
    console.error("[WarRoom OSINT] Erro:", error);
    throw new Error(error.message || "Falha na conexão OSINT");
  }
};
