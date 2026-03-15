// services/marketPulseService.ts
// Fetch indicadores econômicos do BACEN (Banco Central do Brasil) — gratuito, sem chave

export interface MarketIndicator {
  id: string;
  label: string;
  emoji: string;
  value: string;
  variation: number; // percentual
  unit: string;
  source: string;
}

export interface MarketPulseData {
  indicators: MarketIndicator[];
  fetchedAt: number;
}

const CACHE_KEY = 'scout360_market_pulse';
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

function getFromCache(): MarketPulseData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: MarketPulseData = JSON.parse(raw);
    if (Date.now() - data.fetchedAt > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveToCache(data: MarketPulseData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // silently fail
  }
}

interface BacenDataPoint {
  data: string;
  valor: string;
}

async function fetchBacenSeries(seriesId: number, last: number = 2): Promise<BacenDataPoint[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesId}/dados/ultimos/${last}?formato=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`BACEN ${seriesId}: ${resp.status}`);
  return resp.json();
}

function calcVariation(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

async function fetchDolar(): Promise<MarketIndicator> {
  try {
    const data = await fetchBacenSeries(1, 2);
    const current = parseFloat(data[data.length - 1].valor);
    const previous = data.length > 1 ? parseFloat(data[data.length - 2].valor) : current;
    return {
      id: 'dolar',
      label: 'Dólar',
      emoji: '💵',
      value: formatBRL(current),
      variation: calcVariation(current, previous),
      unit: 'PTAX',
      source: 'BACEN',
    };
  } catch {
    return fallbackIndicator('dolar', 'Dólar', '💵', 'PTAX');
  }
}

async function fetchEuro(): Promise<MarketIndicator> {
  try {
    const data = await fetchBacenSeries(21619, 2);
    const current = parseFloat(data[data.length - 1].valor);
    const previous = data.length > 1 ? parseFloat(data[data.length - 2].valor) : current;
    return {
      id: 'euro',
      label: 'Euro',
      emoji: '💶',
      value: formatBRL(current),
      variation: calcVariation(current, previous),
      unit: 'PTAX',
      source: 'BACEN',
    };
  } catch {
    return fallbackIndicator('euro', 'Euro', '💶', 'PTAX');
  }
}

async function fetchSelic(): Promise<MarketIndicator> {
  try {
    const data = await fetchBacenSeries(432, 1);
    const current = parseFloat(data[data.length - 1].valor);
    return {
      id: 'selic',
      label: 'Selic',
      emoji: '📈',
      value: `${current.toFixed(2).replace('.', ',')}%`,
      variation: 0,
      unit: '% a.a.',
      source: 'BACEN',
    };
  } catch {
    return fallbackIndicator('selic', 'Selic', '📈', '% a.a.');
  }
}

async function fetchIPCA(): Promise<MarketIndicator> {
  try {
    const data = await fetchBacenSeries(433, 2);
    const current = parseFloat(data[data.length - 1].valor);
    const previous = data.length > 1 ? parseFloat(data[data.length - 2].valor) : current;
    return {
      id: 'ipca',
      label: 'IPCA',
      emoji: '📊',
      value: `${current.toFixed(2).replace('.', ',')}%`,
      variation: calcVariation(current, previous),
      unit: '% mensal',
      source: 'IBGE/BACEN',
    };
  } catch {
    return fallbackIndicator('ipca', 'IPCA', '📊', '% mensal');
  }
}

function fallbackIndicator(id: string, label: string, emoji: string, unit: string): MarketIndicator {
  return {
    id,
    label,
    emoji,
    value: '--',
    variation: 0,
    unit,
    source: 'indisponível',
  };
}

export async function fetchMarketPulse(forceRefresh: boolean = false): Promise<MarketPulseData> {
  if (!forceRefresh) {
    const cached = getFromCache();
    if (cached) return cached;
  }

  const results = await Promise.allSettled([
    fetchDolar(),
    fetchEuro(),
    fetchSelic(),
    fetchIPCA(),
  ]);

  const indicators = results.map(r =>
    r.status === 'fulfilled' ? r.value : fallbackIndicator('unknown', '—', '❓', '—'),
  );

  const data: MarketPulseData = {
    indicators,
    fetchedAt: Date.now(),
  };

  saveToCache(data);
  return data;
}
