const RAG_FETCH_TIMEOUT_MS = 15000;
const shouldLogRagDebug = import.meta.env?.VITE_VERBOSE_LOGS === 'true';

async function fetchRagContext(
  endpoint: string,
  label: string,
  query: string,
  namespace?: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAG_FETCH_TIMEOUT_MS);

  try {
    const payload = namespace ? { query, namespace } : { query };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (shouldLogRagDebug) {
        console.warn(`[${label}] Server returned ${response.status}`);
      }
      return '';
    }

    const data = await response.json();
    return data.context || '';

  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (shouldLogRagDebug) {
        console.warn(`[${label}] Timeout de ${RAG_FETCH_TIMEOUT_MS / 1000}s — continuando sem RAG.`);
      }
    } else {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (shouldLogRagDebug) {
        console.error(`[${label}] Erro ao buscar contexto:`, msg);
      }
    }
    return '';
  } finally {
    clearTimeout(timer);
  }
}

export function buscarContextoPinecone(query: string): Promise<string> {
  return fetchRagContext('/api/rag', 'RAG', query);
}

export function buscarContextoDocsPinecone(query: string, namespace?: string): Promise<string> {
  const label = namespace ? `RAG DOCS:${namespace}` : 'RAG DOCS';
  return fetchRagContext('/api/docs-rag', label, query, namespace);
}
