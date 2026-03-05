// services/warRoomService.ts
// Motor standalone para o War Room com retry, timeout e controle de contexto

import { normalizeAppError } from '../utils/errorHelpers';
import { withAutoRetry } from '../utils/retry';
import { buscarContextoDocsPinecone } from './ragService';
import { proxyGenerateContent } from './geminiProxy';

// ─── TIPOS ───────────────────────────────────────────
export type WarRoomMode = 'tech' | 'killscript' | 'benchmark' | 'objections';

export interface WarRoomMessage {
    role: 'user' | 'model';
    text: string;
}

export interface WarRoomResult {
    text: string;
    sources: Array<{ title: string; url: string }>;
    outOfScope?: boolean; // true se a pergunta é fora do escopo do War Room
}

export interface WarRoomQueryOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
}

// ─── CONFIG ───────────────────────────────────────
const MODEL_ID = 'gemini-2.5-flash';
const DEFAULT_COMPETITOR_TARGET = 'concorrente principal';
const MODEL_TIMEOUT_MS = 30000;
const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 4000;
const MAX_USER_QUESTION_CHARS = 1600;
const MAX_DOCS_CHARS = 6000;
const DOCS_CACHE_TTL_MS = 120000;

type DocsCacheEntry = {
    value: string;
    expiresAt: number;
};

const _docsCache = new Map<string, DocsCacheEntry>();
const _docsInflight = new Map<string, Promise<string>>();

// ─── DETECTOR DE ESCOPO ──────────────────────────────────
const OUT_OF_SCOPE_PATTERNS = [
    /investigar?\s+(a\s+)?empresa/i,
    /dossi[eê]/i,
    /cnpj/i,
    /score\s+porta/i,
    /prospec[cç][aã]o/i,
    /varredura/i,
    /capivara/i,
    /quero\s+saber\s+tudo\s+sobre/i,
    /quadro\s+societ[aá]rio/i,
    /s[oó]cios?\s+d[aoe]/i,
    /receita\s+federal/i,
];

function isOutOfScope(message: string): boolean {
    return OUT_OF_SCOPE_PATTERNS.some(p => p.test(message));
}

function makeAbortError(): Error {
    const err = new Error('Request aborted');
    err.name = 'AbortError';
    return err;
}

function runWithTimeoutAndSignal<T>(
    task: () => Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        if (signal?.aborted) {
            reject(makeAbortError());
            return;
        }

        const timer = setTimeout(() => {
            reject(new Error(`Timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        const onAbort = () => {
            clearTimeout(timer);
            reject(makeAbortError());
        };

        signal?.addEventListener('abort', onAbort, { once: true });

        task()
            .then((value) => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                reject(error);
            });
    });
}

function normalizeTarget(target: string, message: string): string {
    const cleanTarget = (target || '').trim();
    if (cleanTarget) return cleanTarget;

    const inferred =
        message.match(/(?:vs|contra)\s+([A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ\s._/-]{1,60})/i)?.[1]
            ?.trim()
            .replace(/[.,;:!?]+$/, '') || '';

    return inferred || DEFAULT_COMPETITOR_TARGET;
}

function trimText(input: string, maxChars: number): string {
    if (!input) return '';
    const value = input.trim();
    if (value.length <= maxChars) return value;
    return value.slice(0, maxChars) + '...';
}

function buildHistorySnippet(history: WarRoomMessage[]): string {
    if (!history.length) return '';

    const recent = history.slice(-MAX_HISTORY_TURNS);
    let budget = MAX_HISTORY_CHARS;
    const chunks: string[] = [];

    for (let i = recent.length - 1; i >= 0; i -= 1) {
        const msg = recent[i];
        const prefix = msg.role === 'user' ? '**Usuário:** ' : '**Assistente:** ';
        const text = trimText(msg.text, 1200);
        const block = `${prefix}${text}\n\n`;
        if (block.length > budget) continue;
        chunks.unshift(block);
        budget -= block.length;
    }

    if (!chunks.length) return '';
    return `## CONVERSA ANTERIOR\n${chunks.join('')}---\n\n`;
}

async function getDocsContextCached(query: string): Promise<string> {
    const key = query.trim().toLowerCase();
    if (!key) return '';

    const now = Date.now();
    const cached = _docsCache.get(key);
    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    const inflight = _docsInflight.get(key);
    if (inflight) return inflight;

    const fetchPromise = (async () => {
        try {
            const docs = await buscarContextoDocsPinecone(query);
            const clean = trimText(docs || '', MAX_DOCS_CHARS);
            _docsCache.set(key, { value: clean, expiresAt: Date.now() + DOCS_CACHE_TTL_MS });
            return clean;
        } finally {
            _docsInflight.delete(key);
        }
    })();

    _docsInflight.set(key, fetchPromise);
    return fetchPromise;
}

function extractGroundingSources(response: any): Array<{ title: string; url: string }> {
    const groundingChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const dedupe = new Set<string>();
    const sources: Array<{ title: string; url: string }> = [];

    for (const chunk of groundingChunks) {
        const uri = chunk?.web?.uri;
        if (!uri || dedupe.has(uri)) continue;

        try {
            const parsed = new URL(uri);
            const title = chunk?.web?.title || parsed.hostname;
            dedupe.add(uri);
            sources.push({ title, url: uri });
        } catch {
            // ignora URI inválida sem quebrar a resposta inteira
        }
    }

    return sources;
}

// ─── PROMPTS POR MODO ───────────────────────────────────
const SYSTEM_PROMPTS: Record<WarRoomMode, (target: string) => string> = {
    tech: (_target) => `Você é o Especialista Técnico Sênior da Senior Sistemas.

MISSÃO ÚNICA: Responder dúvidas técnicas sobre ERP Senior, módulos, processos, integrações e arquitetura.

REGRAS ABSOLUTAS:
1. RESPONDA DIRETAMENTE à pergunta técnica do usuário.
2. Use a documentação RAG fornecida abaixo para embasar — inclua hiperlinks Markdown: [Texto](URL).
3. NUNCA peça CNPJ, nome de empresa ou alvo de prospecção.
4. NUNCA inicie investigação corporativa, dossiê ou Score PORTA.
5. NUNCA diga que a mensagem está vazia ou que não foi informado um tópico.
6. Se não encontrar na documentação, use seu conhecimento e sinalize: "[Informação complementar]".
7. Escreva em português brasileiro, tom técnico e consultivo.
8. Use markdown com headers, listas e tabelas para organizar o conteúdo.`,

    killscript: (target) => `Você é Estrategista Comercial da Senior Sistemas.

MISSÃO: Gerar scripts de venda táticos DEFENDENDO A SENIOR contra ${target}.

ATENÇÃO: VOCÊ TRABALHA PARA A SENIOR! Sempre defenda a Senior e ataque ${target}.

ESTRUTURA OBRIGATÓRIA:
### ⚔️ O Cenário
(Contexto da objeção/situação do vendedor)
### 🛡️ A Visão da ${target}
(O que ${target} diz/faz — pontos fortes e fracos)
### 🚀 O Contra-Ataque Senior
(Argumentos técnicos e comerciais — features, diferenciais, ROI da SENIOR)
### 🔪 Script de Vendas
(Frases prontas para usar na reunião defendendo a SENIOR)

REGRAS: Tom agressivo mas profissional. Dados concretos. Português BR. SEMPRE DEFENDA A SENIOR!`,

    benchmark: (target) => `Você é Analista Comparativo de ERPs trabalhando para a Senior Sistemas.

MISSÃO: Comparativo técnico detalhado mostrando VANTAGENS DA SENIOR sobre ${target}.

FORMATO OBRIGATÓRIO:
### 📊 Comparativo: Senior vs ${target}
| Critério | Senior | ${target} | Vantagem |
|----------|--------|-----------|----------|
(8-12 critérios: módulos, cloud, tecnologia, UX, preço, suporte, etc.)

### 💡 Resumo Executivo
(3-4 frases de conclusão destacando por que Senior é superior)

REGRAS: Dados reais. Honesto quando ${target} tiver vantagem, MAS sempre mostre como Senior compensa. Português BR.`,

    objections: (target) => `Você é Consultor de Vendas da Senior Sistemas especialista em rebater objeções.

MISSÃO: Rebater objeções DO CLIENTE que favorecem ${target}, DEFENDENDO A SENIOR.

ATENÇÃO: O cliente está comparando Senior vs ${target}. Sua missão é DEFENDER A SENIOR e mostrar por que ela é superior!

ESTRUTURA OBRIGATÓRIA:
### 🛡️ A Objeção
(Resuma o que o cliente disse a favor de ${target})
### ⚡ Por que é MITO ou meia-verdade
(Desmonte o argumento com dados e lógica, mostrando vantagens da SENIOR)
### 💬 O que responder na hora
(2-3 frases prontas DEFENDENDO A SENIOR)
### 🎯 Pergunta de Contra-Ataque
(Pergunta inteligente para virar o jogo a favor da SENIOR)

REGRAS: Confiante mas não arrogante. Reconheça objeções válidas MAS sempre mostre como Senior é melhor. Português BR. SEMPRE DEFENDA A SENIOR!`,
};

// ─── FUNÇÃO PRINCIPAL ───────────────────────────────────
export async function queryWarRoom(
    mode: WarRoomMode,
    message: string,
    history: WarRoomMessage[],
    target: string,
    onStatus?: (status: string) => void,
    options: WarRoomQueryOptions = {}
): Promise<WarRoomResult> {
    const { signal, timeoutMs = MODEL_TIMEOUT_MS } = options;

    if (signal?.aborted) {
        return { text: '⚠️ **Erro**\n\nSolicitação cancelada pelo usuário.', sources: [] };
    }

    // 1. Detecta escopo
    if (mode === 'tech' && isOutOfScope(message)) {
        return {
            text: `⚠️ **Essa pesquisa é melhor no Chat Principal!**\n\nO War Room é focado em **dúvidas técnicas** sobre o ERP Senior (módulos, processos, integrações).\n\nPara investigar empresas, gerar dossiês ou consultar CNPJs, use o **Chat Principal** do Senior Scout 360. Feche o War Room clicando no ✕ e faça sua pesquisa direto no chat.\n\n---\n\n💡 **Exemplos do que o War Room responde:**\n- "Como funciona o módulo de compras no ERP Senior?"\n- "Qual a diferença entre Sapiens e Gestão Empresarial?"\n- "Como configurar integração com NFe?"`,
            sources: [],
            outOfScope: true,
        };
    }

    const resolvedTarget = mode === 'tech' ? '' : normalizeTarget(target, message);
    const systemPrompt = SYSTEM_PROMPTS[mode](resolvedTarget);

    // 2. Busca RAG docs (só para modo tech)
    let docsContext = '';
    let docsUnavailable = false;
    if (mode === 'tech') {
        onStatus?.('📚 Consultando documentação...');
        try {
            docsContext = await getDocsContextCached(message);
            if (!docsContext) {
                docsUnavailable = true;
                onStatus?.('⚠️ Documentação indisponível — usando conhecimento complementar.');
            }
        } catch {
            docsUnavailable = true;
            onStatus?.('⚠️ Falha ao consultar docs — continuando sem RAG.');
        }
    }

    // 3. Monta o payload completo como um único prompt (stateless, sem chat session)
    let fullPrompt = '';

    // Inclui histórico como contexto inline
    fullPrompt += buildHistorySnippet(history);

    // Para modo tech, injeta docs RAG
    if (mode === 'tech' && docsContext) {
        onStatus?.('🔍 Analisando documentação...');
        fullPrompt += `## DOCUMENTAÇÃO OFICIAL (USE PARA EMBASAR)\n\n${docsContext}\n\n---\n\n`;
    }

    // Pergunta atual
    fullPrompt += `## PERGUNTA DO USUÁRIO\n"${trimText(message, MAX_USER_QUESTION_CHARS)}"\n\nResponda agora.`;

    // 4. Chama o Gemini via generateContent (stateless, confiável)
    onStatus?.(mode === 'tech' ? '🧠 Gerando resposta técnica...' : `⚔️ Forjando argumentos contra ${resolvedTarget}...`);

    try {
        const useGrounding = mode !== 'tech'; // Google Search só para modos competitivos
        const response = await withAutoRetry(
            'war-room-generate',
            () =>
                runWithTimeoutAndSignal(
                    () =>
                        proxyGenerateContent(
                            {
                                model: MODEL_ID,
                                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                                config: {
                                    systemInstruction: systemPrompt,
                                    temperature: mode === 'tech' ? 0.15 : 0.3,
                                    maxOutputTokens: 8192,
                                    tools: useGrounding ? [{ googleSearch: {} }] : undefined,
                                }
                            },
                            signal
                        ),
                    timeoutMs,
                    signal
                ),
            { maxRetries: 2, baseDelayMs: 700, maxDelayMs: 3000 }
        );

        const text = response.text || '';

        // 5. Coleta grounding sources
        const sources = extractGroundingSources(response);

        if (!text.trim()) {
            throw new Error('Resposta vazia do modelo');
        }

        const disclaimer = docsUnavailable && mode === 'tech'
            ? '\n\n_[Aviso: a documentação oficial não respondeu nesta tentativa; resposta baseada em conhecimento complementar.]_'
            : '';

        return { text: (text.trim() + disclaimer).trim(), sources };
    } catch (error: any) {
        console.error('[WarRoom] Erro:', error);
        const appError = normalizeAppError(error, 'GEMINI', 'Falha ao consultar War Room.');
        const errorMsg = appError.friendlyMessage || `Erro de comunicação: ${appError.message || 'Falha na conexão'}. Tente novamente.`;

        return {
            text: `⚠️ **Erro**\n\n${errorMsg}`,
            sources: [],
        };
    }
}