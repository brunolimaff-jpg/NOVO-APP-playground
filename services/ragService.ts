const RAG_FETCH_TIMEOUT_MS = 15000; // 15s — melhor falhar rápido do que travar 60s

export async function buscarContextoPinecone(query: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAG_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch('/api/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    if (!response.ok) return '';

    const data = await response.json();
    return data.context || '';

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[RAG] Timeout de 15s — Pinecone lento, continuando sem RAG de propostas.');
    } else {
      console.error('[RAG] Erro ao buscar contexto Pinecone:', error);
    }
    return '';
  } finally {
    clearTimeout(timer);
  }
}

export async function buscarContextoDocsPinecone(query: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAG_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch('/api/docs-rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    if (!response.ok) return '';

    const data = await response.json();
    return data.context || '';

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[RAG DOCS] Timeout de 15s — Pinecone lento, continuando sem docs.');
    } else {
      console.error('[RAG DOCS] Erro ao buscar documentação no Pinecone:', error);
    }
    return '';
  } finally {
    clearTimeout(timer);
  }
}

