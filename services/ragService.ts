export async function buscarContextoPinecone(query: string): Promise<string> {
  try {
    const response = await fetch('/api/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) return '';

    const data = await response.json();
    return data.context || '';

  } catch (error: any) {
    console.error('[RAG] Erro ao buscar contexto Pinecone (timeout natural ou rede):', error);
    return '';
  }
}

export async function buscarContextoDocsPinecone(query: string): Promise<string> {
  try {
    const response = await fetch('/api/docs-rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) return '';

    const data = await response.json();
    return data.context || '';

  } catch (error: any) {
    console.error('[RAG DOCS] Erro ao buscar documentação no Pinecone:', error);
    return '';
  }
}
