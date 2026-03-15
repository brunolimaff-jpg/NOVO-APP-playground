// services/meetingPrepService.ts
// Consolida dados de diversas fontes e gera briefing de reunião via Gemini

import { sendMessageToGemini } from './geminiService';
import { type ComexProfileData } from './comexService';
import { type NewsRadarData } from './newsRadarService';
import { type WeatherData } from './weatherService';

export interface MeetingPrepInput {
  companyName: string;
  cnpj?: string | null;
  city?: string;
  state?: string;
  website?: string;
  briefDescription?: string;
  scorePorta?: number;
  prospectionNotes?: string;
  spotterNotes?: string;
  competitors?: string[];
  comex?: ComexProfileData | null;
  news?: NewsRadarData | null;
  weather?: WeatherData | null;
  sessionSummaries?: string[];
}

export interface MeetingBriefingData {
  companyName: string;
  briefingMarkdown: string;
  generatedAt: number;
}

const CACHE_KEY_PREFIX = 'scout360_meeting_prep_';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4h

function getCacheKey(companyName: string): string {
  return CACHE_KEY_PREFIX + companyName.toLowerCase().replace(/\s+/g, '_').substring(0, 50);
}

function getFromCache(companyName: string): MeetingBriefingData | null {
  try {
    const raw = localStorage.getItem(getCacheKey(companyName));
    if (!raw) return null;
    const data: MeetingBriefingData = JSON.parse(raw);
    if (Date.now() - data.generatedAt > CACHE_TTL) {
      localStorage.removeItem(getCacheKey(companyName));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveToCache(data: MeetingBriefingData): void {
  try {
    localStorage.setItem(getCacheKey(data.companyName), JSON.stringify(data));
  } catch {
    // silently fail
  }
}

function buildPrompt(input: MeetingPrepInput): string {
  const sections: string[] = [];

  sections.push(`DADOS DA EMPRESA:
- Nome: ${input.companyName}
- CNPJ: ${input.cnpj || 'N/D'}
- Localização: ${input.city || '?'}, ${input.state || '?'}
- Website: ${input.website || 'N/D'}
- Resumo: ${input.briefDescription || 'N/D'}`);

  if (input.scorePorta !== undefined) {
    sections.push(`SCORE PORTA: ${input.scorePorta}/100`);
  }

  if (input.comex?.result?.isExportador) {
    sections.push(`PERFIL COMEX:
- Status: Exportadora Ativa
- Faixa: ${input.comex.result.faixaValorEstimado || 'N/D'}
- Produtos: ${input.comex.result.principaisNCMs?.join(', ') || 'N/D'}
- Ref: ${input.comex.result.anoReferencia || 'N/D'}`);
  }

  if (input.prospectionNotes?.trim()) {
    sections.push(`NOTAS DE PROSPECÇÃO:\n${input.prospectionNotes.substring(0, 2000)}`);
  }

  if (input.spotterNotes?.trim()) {
    sections.push(`FICHA SPOTTER:\n${input.spotterNotes.substring(0, 2000)}`);
  }

  if (input.competitors && input.competitors.length > 0) {
    sections.push(`CONCORRENTES DETECTADOS: ${input.competitors.join(', ')}`);
  }

  if (input.news && input.news.items.length > 0) {
    const newsLines = input.news.items.map(
      n => `- [${n.sentiment}] ${n.title} (${n.source})`
    );
    sections.push(`NOTÍCIAS RECENTES:\n${newsLines.join('\n')}`);
  }

  if (input.weather) {
    const forecast = input.weather.forecast.slice(0, 3)
      .map(d => `${d.dayLabel}: ${d.tempMax}°C ${d.emoji} ${d.precipitation}mm`)
      .join(', ');
    sections.push(`CLIMA PRÓXIMOS DIAS: ${forecast}`);
  }

  if (input.sessionSummaries && input.sessionSummaries.length > 0) {
    sections.push(`RESUMO DAS INVESTIGAÇÕES ANTERIORES:\n${input.sessionSummaries.join('\n---\n').substring(0, 3000)}`);
  }

  return `Você é um preparador de reuniões comerciais para o agronegócio.
Com base nos dados abaixo, gere um BRIEFING DE REUNIÃO estruturado e pronto para uso.

${sections.join('\n\n')}

FORMATO DO BRIEFING (use markdown):
## Contexto
2-3 frases sobre a empresa, porte, segmento e situação atual.

## Pontos de Dor
3-5 bullets com oportunidades concretas de venda de software/ERP.

## Objeções Prováveis
2-3 objeções comuns com respostas sugeridas para o vendedor.

## Perguntas-Chave
3-5 perguntas estratégicas para fazer na reunião.

## Notícias Relevantes
Resumo de notícias recentes (se houver) e seu impacto na negociação.

## Condição Climática
1 frase sobre janela de visita e impacto na operação (se dados disponíveis).

Seja direto, objetivo, em português brasileiro. Foco em insights acionáveis para o vendedor.
Não invente dados — use apenas o que foi fornecido.`;
}

export async function generateMeetingBriefing(
  input: MeetingPrepInput,
  forceRefresh: boolean = false,
): Promise<MeetingBriefingData> {
  if (!forceRefresh) {
    const cached = getFromCache(input.companyName);
    if (cached) return cached;
  }

  const prompt = buildPrompt(input);
  const systemPrompt = 'Você é um analista comercial sênior preparando briefings de reunião. Seja conciso e prático.';

  const { text } = await sendMessageToGemini(prompt, [], systemPrompt);

  const data: MeetingBriefingData = {
    companyName: input.companyName,
    briefingMarkdown: text,
    generatedAt: Date.now(),
  };

  saveToCache(data);
  return data;
}
