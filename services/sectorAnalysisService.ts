// services/sectorAnalysisService.ts
// Raio-X Setorial unificado: Visão do Setor + Adoção Tech + Radar Regulatório + Intel Competitiva

import { sendMessageToGemini } from './geminiService';
import { formatSafraForPrompt } from '../utils/safraCalendar';

export interface RegulatoryItem {
  name: string;
  level: 'urgent' | 'attention' | 'info';
  description: string;
  seniorModule: string;
}

export interface CompetitorInfo {
  name: string;
  relativeSize: string;
  techStack: string;
  insight: string;
}

export interface SectorAnalysisData {
  companyName: string;
  cnae: { code: string; description: string } | null;
  sectorMarkdown: string;         // Visão do Setor + Tendências
  techAdoptionMarkdown: string;   // Adoção Tech + Módulos Senior
  regulatoryItems: RegulatoryItem[];
  competitorItems: CompetitorInfo[];
  salesArgument: string;
  generatedAt: number;
}

const CACHE_KEY_PREFIX = 'scout360_sector_';
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12h

function getCacheKey(cnpj: string): string {
  return CACHE_KEY_PREFIX + cnpj.replace(/\D/g, '').substring(0, 14);
}

function getFromCache(cnpj: string): SectorAnalysisData | null {
  try {
    const raw = localStorage.getItem(getCacheKey(cnpj));
    if (!raw) return null;
    const data: SectorAnalysisData = JSON.parse(raw);
    if (Date.now() - data.generatedAt > CACHE_TTL) {
      localStorage.removeItem(getCacheKey(cnpj));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveToCache(cnpj: string, data: SectorAnalysisData): void {
  try {
    localStorage.setItem(getCacheKey(cnpj), JSON.stringify(data));
  } catch { /* silently fail */ }
}

async function fetchCnaeFromBrasilAPI(cnpj: string): Promise<{ code: string; description: string } | null> {
  try {
    const clean = cnpj.replace(/\D/g, '');
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.cnae_fiscal && data.cnae_fiscal_descricao) {
      return { code: String(data.cnae_fiscal), description: data.cnae_fiscal_descricao };
    }
    return null;
  } catch {
    return null;
  }
}

function buildPrompt(
  companyName: string,
  cnae: { code: string; description: string } | null,
  state?: string,
  briefDescription?: string,
  isExporter?: boolean,
): string {
  const safraContext = state ? formatSafraForPrompt(state) : '';

  return `Você é um analista de inteligência de mercado especializado em agronegócio brasileiro e vendas de ERP.

EMPRESA: ${companyName}
${cnae ? `CNAE: ${cnae.code} — ${cnae.description}` : 'CNAE: não disponível'}
${state ? `UF: ${state}` : ''}
${briefDescription ? `CONTEXTO: ${briefDescription}` : ''}
${isExporter ? 'STATUS COMEX: Exportadora ativa' : ''}
${safraContext ? `\n${safraContext}` : ''}

Gere uma análise em EXATAMENTE este formato JSON (sem markdown, sem blocos de código, apenas JSON puro):

{
  "sectorOverview": "Texto markdown com ## Visão do Setor (tamanho mercado, crescimento, posição do Brasil) e ## Tendências (3-5 tendências macro atuais). Máximo 300 palavras.",
  "techAdoption": "Texto markdown com ## Adoção Tecnológica (nível de digitalização, % com ERP, gaps) e ## Módulos Senior Relevantes (use 🎯 para alta aderência, ⚠️ para situacional). Máximo 250 palavras.",
  "regulatory": [
    { "name": "Nome da obrigação", "level": "urgent|attention|info", "description": "Descrição curta + prazo", "seniorModule": "Módulo Senior que resolve" }
  ],
  "competitors": [
    { "name": "Nome do concorrente", "relativeSize": "superior|similar|inferior", "techStack": "ERP/sistema que usam", "insight": "Uma frase de impacto para o vendedor" }
  ],
  "salesArgument": "Uma frase persuasiva conectando a vantagem competitiva ao uso de ERP Senior, para o vendedor usar na reunião."
}

REGRAS:
- regulatory: 3-5 itens classificados como "urgent", "attention" ou "info"
- Foque em: SPED, REINF, NFe, eSocial, LGPD, CAR (se agro), Siscomex (se exportadora), NR-31 (se rural)
- competitors: 2-4 concorrentes DIRETOS da empresa (não da Senior!)
- Use Google Search para dados atualizados
- Seja factual e cite fontes quando possível
- Responda APENAS com JSON válido, sem texto antes ou depois`;
}

function parseAnalysisResponse(text: string, companyName: string, cnae: { code: string; description: string } | null): SectorAnalysisData {
  // Try to extract JSON from the response
  let parsed: any;
  try {
    // Try direct parse first
    parsed = JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch {
        // Fallback: return raw text as sector overview
        return {
          companyName,
          cnae,
          sectorMarkdown: text,
          techAdoptionMarkdown: '',
          regulatoryItems: [],
          competitorItems: [],
          salesArgument: '',
          generatedAt: Date.now(),
        };
      }
    } else {
      return {
        companyName,
        cnae,
        sectorMarkdown: text,
        techAdoptionMarkdown: '',
        regulatoryItems: [],
        competitorItems: [],
        salesArgument: '',
        generatedAt: Date.now(),
      };
    }
  }

  const regulatoryItems: RegulatoryItem[] = (parsed.regulatory || []).map((r: any) => ({
    name: r.name || '',
    level: (['urgent', 'attention', 'info'].includes(r.level) ? r.level : 'info') as RegulatoryItem['level'],
    description: r.description || '',
    seniorModule: r.seniorModule || '',
  }));

  const competitorItems: CompetitorInfo[] = (parsed.competitors || []).map((c: any) => ({
    name: c.name || '',
    relativeSize: c.relativeSize || 'similar',
    techStack: c.techStack || 'Desconhecido',
    insight: c.insight || '',
  }));

  return {
    companyName,
    cnae,
    sectorMarkdown: parsed.sectorOverview || '',
    techAdoptionMarkdown: parsed.techAdoption || '',
    regulatoryItems,
    competitorItems,
    salesArgument: parsed.salesArgument || '',
    generatedAt: Date.now(),
  };
}

export async function generateSectorAnalysis(
  cnpj: string,
  companyName: string,
  options?: {
    state?: string;
    briefDescription?: string;
    isExporter?: boolean;
    forceRefresh?: boolean;
  },
): Promise<SectorAnalysisData> {
  const cleanCnpj = cnpj.replace(/\D/g, '');

  if (!options?.forceRefresh) {
    const cached = getFromCache(cleanCnpj);
    if (cached) return cached;
  }

  // Fetch CNAE from BrasilAPI
  const cnae = await fetchCnaeFromBrasilAPI(cleanCnpj);

  const prompt = buildPrompt(
    companyName,
    cnae,
    options?.state,
    options?.briefDescription,
    options?.isExporter,
  );

  const systemPrompt = 'Você é um analista de inteligência de mercado sênior. Responda APENAS com JSON válido, sem formatação markdown ao redor.';

  const { text } = await sendMessageToGemini(prompt, [], systemPrompt);

  const data = parseAnalysisResponse(text, companyName, cnae);

  saveToCache(cleanCnpj, data);
  return data;
}
