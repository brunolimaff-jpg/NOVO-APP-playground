// services/warRoomService.ts
// Motor COMPLETAMENTE STANDALONE para o War Room — zero compartilhamento com o chat principal
// Usa generateContent (stateless) ao invés de chat sessions para máxima confiabilidade

import { GoogleGenAI } from '@google/genai';
import { buscarContextoDocsPinecone } from './ragService';

// ─── TIPOS ──────────────────────────────────────────────────
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

// ─── CONFIG ─────────────────────────────────────────────────
const MODEL_ID = 'gemini-2.5-flash-preview-05-20';

let _ai: GoogleGenAI | null = null;
const getAI = (): GoogleGenAI => {
    if (!_ai) {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error('API_KEY environment variable is missing.');
        _ai = new GoogleGenAI({ apiKey });
    }
    return _ai;
};

// ─── DETECTOR DE ESCOPO ─────────────────────────────────────
// Detecta se a pergunta é fora do escopo do War Room (investigação de empresa, CNPJ, etc.)
const OUT_OF_SCOPE_PATTERNS = [
    /investigar?\s+(a\s+)?empresa/i,
    /dossi[eê]/i,
    /cnpj/i,
    /score\s+porta/i,
    /prospec[çc][aã]o/i,
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

// ─── PROMPTS POR MODO ───────────────────────────────────────
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

MISSÃO: Gerar scripts de venda táticos contra ${target}.

ESTRUTURA OBRIGATÓRIA:
### ⚔️ O Cenário
(Contexto da objeção/situação do vendedor)
### 🛡️ A Visão da ${target}
(O que ${target} diz/faz — pontos fortes e fracos)
### 🚀 O Contra-Ataque Senior
(Argumentos técnicos e comerciais — features, diferenciais, ROI)
### 🔪 Script de Vendas
(Frases prontas para usar na reunião)

REGRAS: Tom agressivo mas profissional. Dados concretos. Português BR.`,

    benchmark: (target) => `Você é Analista Comparativo de ERPs.

MISSÃO: Comparativo técnico detalhado Senior Sistemas vs ${target}.

FORMATO OBRIGATÓRIO:
### 📊 Comparativo: Senior vs ${target}
| Critério | Senior | ${target} | Vantagem |
|----------|--------|-----------|----------|
(8-12 critérios: módulos, cloud, tecnologia, UX, preço, suporte, etc.)

### 💡 Resumo Executivo
(3-4 frases de conclusão para o vendedor)

REGRAS: Dados reais. Honesto quando ${target} tiver vantagem. Português BR.`,

    objections: (target) => `Você é Consultor de Vendas Especialista em Objeções.

MISSÃO: Rebater objeções a favor da ${target} contra a Senior.

ESTRUTURA OBRIGATÓRIA:
### 🛡️ A Objeção
(Resuma o que o cliente disse)
### ⚡ Por que é MITO ou meia-verdade
(Desmonte com dados e lógica)
### 💬 O que responder na hora
(2-3 frases prontas)
### 🎯 Pergunta de Contra-Ataque
(Pergunta inteligente para virar o jogo)

REGRAS: Confiante mas não arrogante. Reconheça objeções válidas. Português BR.`,
};

// ─── FUNÇÃO PRINCIPAL ───────────────────────────────────────
export async function queryWarRoom(
    mode: WarRoomMode,
    message: string,
    history: WarRoomMessage[],
    target: string,
    onStatus?: (status: string) => void
): Promise<WarRoomResult> {
    // 1. Detecta escopo
    if (mode === 'tech' && isOutOfScope(message)) {
        return {
            text: `⚠️ **Essa pesquisa é melhor no Chat Principal!**\n\nO War Room é focado em **dúvidas técnicas** sobre o ERP Senior (módulos, processos, integrações).\n\nPara investigar empresas, gerar dossiês ou consultar CNPJs, use o **Chat Principal** do Senior Scout 360. Feche o War Room clicando no ✕ e faça sua pesquisa direto no chat.\n\n---\n\n💡 **Exemplos do que o War Room responde:**\n- "Como funciona o módulo de compras no ERP Senior?"\n- "Qual a diferença entre Sapiens e Gestão Empresarial?"\n- "Como configurar integração com NFe?"`,
            sources: [],
            outOfScope: true,
        };
    }

    const ai = getAI();
    const systemPrompt = SYSTEM_PROMPTS[mode](target);

    // 2. Busca RAG docs (só para modo tech)
    let docsContext = '';
    if (mode === 'tech') {
        onStatus?.('📚 Consultando documentação...');
        try {
            docsContext = await buscarContextoDocsPinecone(message);
        } catch { /* falha silenciosa */ }
    }

    // 3. Monta o payload completo como um único prompt (stateless, sem chat session)
    let fullPrompt = '';

    // Inclui histórico como contexto inline
    if (history.length > 0) {
        fullPrompt += '## CONVERSA ANTERIOR\n';
        for (const msg of history) {
            fullPrompt += msg.role === 'user' ? `**Usuário:** ${msg.text}\n\n` : `**Assistente:** ${msg.text}\n\n`;
        }
        fullPrompt += '---\n\n';
    }

    // Para modo tech, injeta docs RAG
    if (mode === 'tech' && docsContext) {
        onStatus?.('🔍 Analisando documentação...');
        fullPrompt += `## DOCUMENTAÇÃO OFICIAL (USE PARA EMBASAR)\n\n${docsContext}\n\n---\n\n`;
    }

    // Pergunta atual
    fullPrompt += `## PERGUNTA DO USUÁRIO\n"${message}"\n\nResponda agora.`;

    // 4. Chama o Gemini via generateContent (stateless, confiável)
    onStatus?.(mode === 'tech' ? '🧠 Gerando resposta técnica...' : `⚔️ Forjando argumentos contra ${target}...`);

    try {
        const useGrounding = mode !== 'tech'; // Google Search só para modos competitivos

        const response = await ai.models.generateContent({
            model: MODEL_ID,
            contents: [
                { role: 'user', parts: [{ text: fullPrompt }] }
            ],
            config: {
                systemInstruction: systemPrompt,
                temperature: mode === 'tech' ? 0.15 : 0.3,
                maxOutputTokens: 4096,
                tools: useGrounding ? [{ googleSearch: {} }] : undefined,
            }
        });

        const text = response.text || '';

        // 5. Coleta grounding sources
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = groundingChunks
            .filter((c: any) => c.web?.uri)
            .map((c: any) => {
                const web = c.web;
                const title = web.title || new URL(web.uri).hostname;
                return { title, url: web.uri };
            });

        if (!text.trim()) {
            throw new Error('Resposta vazia do modelo');
        }

        return { text: text.trim(), sources };
    } catch (error: any) {
        console.error('[WarRoom] Erro:', error);

        // Mensagem de erro amigável
        const errorMsg = error.message?.includes('SAFETY')
            ? 'A pergunta foi bloqueada pelo filtro de segurança. Reformule sua dúvida.'
            : error.message?.includes('quota')
                ? 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.'
                : `Erro de comunicação: ${error.message || 'Falha na conexão'}. Tente novamente.`;

        return {
            text: `⚠️ **Erro**\n\n${errorMsg}`,
            sources: [],
        };
    }
}
