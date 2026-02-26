const RAG_TIMEOUT_MS = 8000;

export async function buscarContextoPinecone(query: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

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
      console.warn('[RAG] Timeout após 8s — seguindo sem contexto Pinecone.');
    } else {
      console.error('[RAG] Erro ao buscar contexto:', error);
    }
    return '';
  } finally {
    clearTimeout(timer);
  }
}
