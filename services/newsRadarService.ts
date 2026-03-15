// services/newsRadarService.ts
// Busca de notícias via Gemini com Google Search grounding

import { sendMessageToGemini } from './geminiService';

export interface NewsItem {
  title: string;
  source: string;
  date: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  summary: string;
  commercialInsight: string;
  url?: string;
}

export interface NewsRadarData {
  companyName: string;
  items: NewsItem[];
  fetchedAt: number;
}

const CACHE_KEY_PREFIX = 'scout360_news_';
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2h

function getCacheKey(companyName: string): string {
  return CACHE_KEY_PREFIX + companyName.toLowerCase().replace(/\s+/g, '_').substring(0, 50);
}

function getFromCache(companyName: string): NewsRadarData | null {
  try {
    const raw = localStorage.getItem(getCacheKey(companyName));
    if (!raw) return null;
    const data: NewsRadarData = JSON.parse(raw);
    if (Date.now() - data.fetchedAt > CACHE_TTL) {
      localStorage.removeItem(getCacheKey(companyName));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveToCache(data: NewsRadarData): void {
  try {
    localStorage.setItem(getCacheKey(data.companyName), JSON.stringify(data));
  } catch {
    // silently fail
  }
}

function parseNewsFromResponse(text: string): NewsItem[] {
  try {
    // Tenta extrair JSON do response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: any) => item.title && item.summary)
      .slice(0, 5)
      .map((item: any) => ({
        title: String(item.title || '').substring(0, 200),
        source: String(item.source || 'Fonte desconhecida').substring(0, 100),
        date: String(item.date || new Date().toISOString()),
        sentiment: (['positive', 'negative', 'neutral'].includes(item.sentiment)
          ? item.sentiment
          : 'neutral') as NewsItem['sentiment'],
        summary: String(item.summary || '').substring(0, 300),
        commercialInsight: String(item.commercialInsight || item.commercial_insight || '').substring(0, 300),
        url: item.url || undefined,
      }));
  } catch {
    return [];
  }
}

export async function fetchNewsForCompany(
  companyName: string,
  forceRefresh: boolean = false,
): Promise<NewsRadarData> {
  if (!forceRefresh) {
    const cached = getFromCache(companyName);
    if (cached) return cached;
  }

  const prompt = `Busque as 5 notícias mais recentes sobre "${companyName}" no Brasil.
Para cada notícia encontrada, retorne APENAS um array JSON (sem markdown, sem explicação) com objetos neste formato:
[
  {
    "title": "título da notícia",
    "source": "nome do veículo/site",
    "date": "YYYY-MM-DD",
    "sentiment": "positive" | "negative" | "neutral",
    "summary": "resumo em 1 frase curta",
    "commercialInsight": "impacto potencial na oportunidade de venda de software/ERP para esta empresa",
    "url": "URL da notícia (se disponível)"
  }
]

Se não encontrar notícias, retorne um array vazio: []
IMPORTANTE: Retorne APENAS o JSON, sem texto adicional.`;

  const systemPrompt = 'Você é um analista de inteligência comercial. Busque notícias reais e recentes. Retorne apenas JSON válido.';

  try {
    const { text } = await sendMessageToGemini(prompt, [], systemPrompt);
    const items = parseNewsFromResponse(text);

    const data: NewsRadarData = {
      companyName,
      items,
      fetchedAt: Date.now(),
    };

    saveToCache(data);
    return data;
  } catch {
    return {
      companyName,
      items: [],
      fetchedAt: Date.now(),
    };
  }
}

export function getSentimentEmoji(sentiment: NewsItem['sentiment']): string {
  switch (sentiment) {
    case 'positive': return '🟢';
    case 'negative': return '🔴';
    case 'neutral': return '⚪';
  }
}

export function getSentimentLabel(sentiment: NewsItem['sentiment']): string {
  switch (sentiment) {
    case 'positive': return 'Positiva';
    case 'negative': return 'Negativa';
    case 'neutral': return 'Neutra';
  }
}

export function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'agora';
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays === 1) return 'há 1 dia';
    if (diffDays < 30) return `há ${diffDays} dias`;
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}
