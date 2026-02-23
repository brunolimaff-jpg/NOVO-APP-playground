import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index('scout-arsenal');

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { query } = await req.json();
    if (!query) return new Response(JSON.stringify({ context: '' }), { status: 200 });

    const embeddingResponse = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: query,
      config: { taskType: 'RETRIEVAL_QUERY' }
    });

    const queryVector =
      embeddingResponse.embeddings?.[0]?.values ||
      embeddingResponse.embedding?.values ||
      embeddingResponse.values;

    if (!queryVector) return new Response(JSON.stringify({ context: '' }), { status: 200 });

    const results = await index.query({
      vector: queryVector,
      topK: 5,
      includeMetadata: true
    });

    const context = results.matches
      .filter(m => (m.score ?? 0) > 0.5)
      .map(m => `[Proposta: ${m.metadata?.source}]\n${m.metadata?.text}`)
      .join('\n\n---\n\n');

    return new Response(JSON.stringify({ context }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('RAG error:', error);
    return new Response(JSON.stringify({ context: '' }), { status: 200 }); // falha silenciosa
  }
}

export const config = { runtime: 'edge' };
