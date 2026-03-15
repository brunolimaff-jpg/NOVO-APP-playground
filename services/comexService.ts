// services/comexService.ts
// Client para dados COMEX: tenta API serverless → fallback Gemini + Google Search

import { sendMessageToGemini } from './geminiService';

export interface ComexResult {
  isExportador: boolean;
  cnpj?: string;
  anoReferencia?: number;
  faixaValorEstimado?: string;
  principaisNCMs?: string[];
  message?: string;
  source?: string; // 'api' | 'gemini' — indica a fonte dos dados
}

export interface ComexProfileData {
  result: ComexResult;
  fetchedAt: number;
}

const CACHE_KEY_PREFIX = 'scout360_comex_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h (dados anuais)

function getCacheKey(cnpj: string): string {
  return CACHE_KEY_PREFIX + cnpj.replace(/\D/g, '');
}

function getFromCache(cnpj: string): ComexProfileData | null {
  try {
    const raw = localStorage.getItem(getCacheKey(cnpj));
    if (!raw) return null;
    const data: ComexProfileData = JSON.parse(raw);
    if (Date.now() - data.fetchedAt > CACHE_TTL) {
      localStorage.removeItem(getCacheKey(cnpj));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveToCache(cnpj: string, data: ComexProfileData): void {
  try {
    localStorage.setItem(getCacheKey(cnpj), JSON.stringify(data));
  } catch {
    // silently fail
  }
}

function isLocalDev(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

// Busca nome da empresa via BrasilAPI para enriquecer a busca Gemini
async function fetchCompanyName(cnpj: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.razao_social || data.nome_fantasia || null;
  } catch {
    return null;
  }
}

// Fallback: usa Gemini + Google Search para encontrar dados reais de exportação
async function fetchComexViaGemini(cnpj: string, companyName?: string): Promise<ComexResult> {
  const name = companyName || await fetchCompanyName(cnpj) || cnpj;

  const prompt = `Pesquise dados de exportação da empresa "${name}" (CNPJ: ${cnpj}) no Brasil.

Busque em fontes como:
- ComexStat / MDIC (Ministério do Desenvolvimento, Indústria e Comércio)
- Receita Federal
- Portais de comércio exterior
- Notícias sobre exportações da empresa
- Site institucional da empresa

Responda APENAS com JSON válido neste formato (sem markdown, sem blocos de código):

{
  "isExportador": true ou false,
  "faixaValorEstimado": "US$ X–Y (estimativa baseada em fontes públicas)" ou null se não encontrar,
  "principaisNCMs": ["produto 1", "produto 2"] ou [] se não encontrar,
  "anoReferencia": 2025 ou ano mais recente encontrado,
  "message": "Breve explicação de como chegou nessa conclusão e quais fontes consultou"
}

REGRAS:
- Se encontrar QUALQUER evidência de exportação (notícias, comexstat, site da empresa), marque isExportador como true
- Se a empresa for grande no agronegócio brasileiro, busque especificamente por dados de exportação
- Seja factual — não invente dados. Se não encontrar, diga isExportador: false
- Use Google Search para dados atualizados`;

  const systemPrompt = 'Você é um analista de comércio exterior brasileiro. Responda APENAS com JSON válido.';

  try {
    const { text } = await sendMessageToGemini(prompt, [], systemPrompt);

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        return { isExportador: false, source: 'gemini', message: 'Não foi possível analisar dados COMEX' };
      }
    }

    return {
      isExportador: !!parsed.isExportador,
      cnpj,
      anoReferencia: parsed.anoReferencia || new Date().getFullYear(),
      faixaValorEstimado: parsed.faixaValorEstimado || undefined,
      principaisNCMs: Array.isArray(parsed.principaisNCMs) ? parsed.principaisNCMs : undefined,
      message: parsed.message || undefined,
      source: 'gemini',
    };
  } catch {
    return { isExportador: false, source: 'gemini', message: 'Erro ao consultar dados COMEX via IA' };
  }
}

export async function fetchComexProfile(
  cnpj: string,
  forceRefresh: boolean = false,
): Promise<ComexProfileData | null> {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return null;

  if (!forceRefresh) {
    const cached = getFromCache(cleanCnpj);
    if (cached) return cached;
  }

  // Tenta API serverless primeiro (se em produção)
  if (!isLocalDev()) {
    try {
      const origin = window.location.origin;
      const resp = await fetch(`${origin}/api/comex?cnpj=${cleanCnpj}`);
      if (resp.ok) {
        const result: ComexResult = await resp.json();
        // Se a API retornou que é exportador, confia nela
        if (result.isExportador) {
          const data: ComexProfileData = {
            result: { ...result, source: 'api' },
            fetchedAt: Date.now(),
          };
          saveToCache(cleanCnpj, data);
          return data;
        }
        // Se disse que não é exportador, faz fallback no Gemini pra confirmar
      }
    } catch {
      // API falhou, vai pro fallback
    }
  }

  // Fallback: Gemini + Google Search (funciona em dev local e como verificação)
  const geminiResult = await fetchComexViaGemini(cleanCnpj);
  const data: ComexProfileData = {
    result: geminiResult,
    fetchedAt: Date.now(),
  };

  saveToCache(cleanCnpj, data);
  return data;
}

export function formatExportBand(band: string | undefined): string {
  if (!band) return '—';
  return band;
}

export function formatNCMs(ncms: string[] | undefined): string {
  if (!ncms || ncms.length === 0) return '—';
  return ncms.join(', ');
}
