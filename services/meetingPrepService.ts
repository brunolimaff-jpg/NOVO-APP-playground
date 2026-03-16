// services/meetingPrepService.ts
// Consolida dados de diversas fontes e gera briefing de reunião via Gemini

import { proxyChatSendMessage } from './geminiProxy';
import { MODEL_IDS } from '../config/models';
import { fetchComexProfile, type ComexProfileData } from './comexService';
import { fetchNewsForCompany, type NewsRadarData } from './newsRadarService';
import { getWeatherForCity, type WeatherData } from './weatherService';
import { formatSafraForPrompt } from '../utils/safraCalendar';

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

  // Safra calendar data
  if (input.state) {
    const safraData = formatSafraForPrompt(input.state);
    if (safraData) sections.push(safraData);
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

## Janela Safra
Se dados de safra disponíveis: timing ideal de abordagem considerando plantio/colheita da região.

## Condição Climática
1 frase sobre janela de visita e impacto na operação (se dados disponíveis).

Seja direto, objetivo, em português brasileiro. Foco em insights acionáveis para o vendedor.
Não invente dados — use apenas o que foi fornecido.`;
}

async function enrichInput(input: MeetingPrepInput): Promise<MeetingPrepInput> {
  const enriched = { ...input };

  const fetches: Promise<void>[] = [];

  // Auto-fetch news if not provided
  if (!enriched.news && enriched.companyName) {
    fetches.push(
      fetchNewsForCompany(enriched.companyName)
        .then(news => { enriched.news = news; })
        .catch(() => {}),
    );
  }

  // Auto-fetch weather if not provided but city is available
  if (!enriched.weather && enriched.city) {
    fetches.push(
      getWeatherForCity(enriched.city, enriched.state || '')
        .then(weather => { enriched.weather = weather; })
        .catch(() => {}),
    );
  }

  // Auto-fetch COMEX if not provided but CNPJ is available
  if (!enriched.comex && enriched.cnpj) {
    fetches.push(
      fetchComexProfile(enriched.cnpj)
        .then(comex => { enriched.comex = comex; })
        .catch(() => {}),
    );
  }

  await Promise.allSettled(fetches);
  return enriched;
}

export async function generateMeetingBriefing(
  input: MeetingPrepInput,
  forceRefresh: boolean = false,
): Promise<MeetingBriefingData> {
  if (!forceRefresh) {
    const cached = getFromCache(input.companyName);
    if (cached) return cached;
  }

  // Enrich input with data from all available sources
  const enrichedInput = await enrichInput(input);

  const prompt = buildPrompt(enrichedInput);
  const systemPrompt = 'Você é um analista comercial sênior preparando briefings de reunião. Seja conciso e prático.';

  const { text } = await proxyChatSendMessage({
    model: MODEL_IDS.tactical,
    systemInstruction: systemPrompt,
    history: [],
    message: prompt,
    useGrounding: true,
  });

  const data: MeetingBriefingData = {
    companyName: input.companyName,
    briefingMarkdown: text,
    generatedAt: Date.now(),
  };

  saveToCache(data);
  return data;
}
