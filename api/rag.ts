import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';

export const config = {
  runtime: 'nodejs', // ← trocado de 'edge' para 'nodejs'
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ context: '' });
  }

  try {
    const { query } = req.body;
    if (!query) return res.status(200).json({ context: '' });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const index = pc.index('scout-arsenal');

    // Gera embedding da query
    const embeddingResponse = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: query,
      config: { taskType: 'RETRIEVAL_QUERY' }
    });

    const queryVector = embeddingResponse.embeddings?.[0]?.values;

    if (!queryVector || queryVector.length === 0) {
      return res.status(200).json({ context: '' });
    }

    // Busca no Pinecone
    const results = await index.query({
      vector: queryVector,
      topK: 8,
      includeMetadata: true
    });

    const context = results.matches
      .filter(m => (m.score ?? 0) > 0.35)
      .map(m => `[Proposta: ${m.metadata?.source}]\n${m.metadata?.text}`)
      .join('\n\n---\n\n');

    return res.status(200).json({ context });

  } catch (error: any) {
    console.error('RAG error:', error);
    return res.status(200).json({ context: '' }); // falha silenciosa
  }
}
