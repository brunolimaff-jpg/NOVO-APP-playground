// services/comexService.ts
// Client para a API /api/comex (serverless Vercel) + cache + fallback

export interface ComexResult {
  isExportador: boolean;
  cnpj?: string;
  anoReferencia?: number;
  faixaValorEstimado?: string;
  principaisNCMs?: string[];
  message?: string;
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

  // Em dev local, a API serverless não roda — retorna null graciosamente
  if (isLocalDev()) {
    return null;
  }

  try {
    const origin = window.location.origin;
    const resp = await fetch(`${origin}/api/comex?cnpj=${cleanCnpj}`);
    if (!resp.ok) return null;

    const result: ComexResult = await resp.json();
    const data: ComexProfileData = {
      result,
      fetchedAt: Date.now(),
    };

    saveToCache(cleanCnpj, data);
    return data;
  } catch {
    return null;
  }
}

export function formatExportBand(band: string | undefined): string {
  if (!band) return '—';
  return band;
}

export function formatNCMs(ncms: string[] | undefined): string {
  if (!ncms || ncms.length === 0) return '—';
  return ncms.join(', ');
}
