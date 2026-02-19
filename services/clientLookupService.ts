// services/clientLookupService.ts
// CORRIGIDO: Timeout + Retry para App Script

import { LOOKUP_URL } from "./apiConfig";

const LOOKUP_API_URL = LOOKUP_URL;
const TIMEOUT_MS = 10000; // 10 segundos
const MAX_RETRIES = 3;

export interface ClienteResult {
  grupo: string;
  razoes_sociais: string[];
  linhas_produto: string[];
  familias_presentes: string[];
  modulos_por_familia: Record<string, string[]>;
  gaps_crosssell: string[];
  total_modulos: number;
  eh_cliente_senior: boolean;
  tem_gatec: boolean;
  tem_erp: boolean;
  tem_hcm: boolean;
  tem_logistica: boolean;
}

export interface LookupResponse {
  ok: boolean;
  query: string;
  encontrado: boolean;
  total: number;
  results: ClienteResult[];
  error?: string;
}

// Fetch com timeout
async function fetchWithTimeout(url: string, timeout: number = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      method: 'GET', 
      redirect: 'follow',
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Timeout após ${timeout/1000}s`);
    }
    throw err;
  }
}

// Fetch com retry
async function fetchWithRetry(url: string, retries: number = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[LOOKUP] Tentativa ${attempt}/${retries}: ${url.substring(0, 80)}...`);
      const response = await fetchWithTimeout(url);
      console.log(`[LOOKUP] Sucesso na tentativa ${attempt}`);
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[LOOKUP] Tentativa ${attempt} falhou:`, err.message);
      
      if (attempt < retries) {
        // Backoff exponencial: 1s, 2s, 4s
        const wait = 1000 * Math.pow(2, attempt - 1);
        console.log(`[LOOKUP] Aguardando ${wait/1000}s antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, wait));
      }
    }
  }
  
  throw lastError || new Error('Falha após todas as tentativas');
}

export async function lookupCliente(nomeEmpresa: string): Promise<LookupResponse> {
  console.log("[LOOKUP] === INÍCIO ===");
  
  let nomeLimpo = nomeEmpresa
    .replace(/^(grupo|empresa|fazenda|usina|cia)\s+/i, '')
    .replace(/\s+(ltda|s\/a|sa|eireli|me|epp)\.?$/i, '')
    .replace(/[.,;:!?]+$/, '')
    .trim();
  
  console.log("[LOOKUP] Query:", nomeLimpo);
  
  try {
    // Tentativa 1: nome completo
    let data = await fetchLookup(nomeLimpo);
    
    // Tentativa 2: primeira palavra
    if (!data.encontrado && nomeLimpo.includes(' ')) {
      const p1 = nomeLimpo.split(/\s+/).filter(p => p.length > 2)[0];
      if (p1) {
        console.log("[LOOKUP] Retry (First Word):", p1);
        data = await fetchLookup(p1);
      }
    }

    // Tentativa 3: palavra mais longa
    if (!data.encontrado) {
      const words = nomeLimpo.split(/\s+/).filter(w => w.length > 3);
      if (words.length > 0) {
        const strongest = words.sort((a, b) => b.length - a.length)[0];
        const p1 = nomeLimpo.split(/\s+/).filter(p => p.length > 2)[0];
        if (strongest !== nomeLimpo && strongest !== p1) {
          console.log("[LOOKUP] Retry (Strongest):", strongest);
          data = await fetchLookup(strongest);
        }
      }
    }
    
    console.log("[LOOKUP] Resultado:", data.encontrado ? "ENCONTRADO ✅" : "NÃO ENCONTRADO", "| Total:", data.total);
    return data;
  } catch (err: any) {
    console.error("[LOOKUP] ERRO:", err.message);
    return { ok: false, query: nomeEmpresa, encontrado: false, total: 0, results: [], error: String(err) };
  }
}

async function fetchLookup(query: string): Promise<LookupResponse> {
  const url = `${LOOKUP_API_URL}?q=${encodeURIComponent(query)}`;
  
  try {
    const resp = await fetchWithRetry(url);
    if (!resp.ok) return { ok: false, query, encontrado: false, total: 0, results: [], error: `HTTP ${resp.status}` };
    
    const text = await resp.text();
    console.log("[LOOKUP] Response:", text.substring(0, 100));
    
    try { 
      return JSON.parse(text); 
    } catch { 
      return { ok: false, query, encontrado: false, total: 0, results: [], error: "JSON parse error" }; 
    }
  } catch (err: any) {
    return { ok: false, query, encontrado: false, total: 0, results: [], error: err.message };
  }
}

export function formatarParaPrompt(lookup: LookupResponse): string {
  if (!lookup?.ok || !lookup.encontrado || !lookup.results?.length) {
    return `\n\n---\n## 🔍 BASE INTERNA SENIOR\n**Status:** Empresa "${lookup?.query || ''}" NÃO encontrada na base de clientes Senior.\n**Implicação:** Provável prospect novo (não é cliente atual).\n---\n`;
  }

  const r = lookup.results[0];
  
  let md = `\n\n---\n## 🔍 BASE INTERNA SENIOR [🟢 CONFIRMADO — dados CRM interno Senior]\n`;
  md += `**Grupo Cliente:** ${r.grupo}\n`;
  md += `**É cliente Senior:** ✅ SIM — CONFIRMADO na base interna\n`;
  md += `**Total módulos contratados:** ${r.total_modulos}\n\n`;
  
  md += `### Soluções Senior contratadas:\n`;
  if (r.modulos_por_familia) {
    const icons: Record<string, string> = { "GATec": "🌾", "ERP": "💼", "HCM": "👥", "Logística": "🚛", "Acesso": "🔐", "Plataforma": "📚", "Hypnobox": "🏠" };
    for (const [fam, mods] of Object.entries(r.modulos_por_familia)) {
      if (fam === "Infra" || fam === "Outros") continue;
      md += `${icons[fam] || "📦"} **${fam}:** ${Array.isArray(mods) ? mods.join(", ") : mods}\n`;
    }
  }
  
  if (r.gaps_crosssell?.length) {
    md += `\n### ⚡ GAPS — Oportunidade de cross-sell:\n`;
    const dicas: Record<string, string> = {
      "GATec": "SEM gestão agrícola Senior — oportunidade QUENTE se for agro",
      "ERP": "SEM ERP Senior — possível consolidação",
      "HCM": "SEM gestão de pessoas Senior — verificar porte",
      "Logística": "SEM WMS/TMS Senior — verificar operação",
      "Acesso": "SEM Ronda/controle de acesso",
      "Plataforma": "SEM Konviva/Painel"
    };
    for (const gap of r.gaps_crosssell) {
      md += `- **${gap}:** ${dicas[gap] || `Não possui ${gap}`}\n`;
    }
  }
  
  md += `\n**⚠️ INSTRUÇÃO:** Estes dados são 🟢 CONFIRMADO (CRM interno). Os GAPS DEVEM guiar a FASE 8.\n---\n`;
  return md;
}

// Benchmark
export interface BenchmarkResponse {
  ok: boolean;
  mode: string;
  keywords: string[];
  total: number;
  results: ClienteResult[];
  error?: string;
}

export async function benchmarkClientes(keywords: string[]): Promise<BenchmarkResponse> {
  try {
    const kw = keywords.join(',');
    const url = `${LOOKUP_API_URL}?mode=benchmark&keywords=${encodeURIComponent(kw)}`;
    
    const resp = await fetchWithRetry(url);
    if (!resp.ok) {
      return { ok: false, mode: 'benchmark', keywords, total: 0, results: [], error: `HTTP ${resp.status}` };
    }
    
    const text = await resp.text();
    try { return JSON.parse(text); }
    catch { return { ok: false, mode: 'benchmark', keywords, total: 0, results: [], error: "JSON parse" }; }
  } catch (err: any) {
    return { ok: false, mode: 'benchmark', keywords, total: 0, results: [], error: String(err) };
  }
}

export function formatarBenchmarkParaPrompt(bench: BenchmarkResponse, empresaAlvo: string): string {
  if (!bench?.ok || !bench.results?.length) {
    return `\n\n---\n## 🏭 BENCHMARK SENIOR\nNenhum cliente Senior encontrado com operação similar a "${empresaAlvo}".\n---\n`;
  }

  let md = `\n\n---\n## 🏭 BENCHMARK SENIOR [🟢 CONFIRMADO]\n`;
  md += `**Encontrados:** ${bench.total} clientes Senior similares\n\n`;
  
  const top = bench.results.slice(0, 5);
  for (const r of top) {
    md += `### 📌 ${r.grupo}\n`;
    md += `- **Soluções:** ${r.familias_presentes.join(', ')} (${r.total_modulos} mód.)\n`;
  }
  
  md += `\n---\n`;
  return md;
}
