import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index('scout-arsenal');

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query obrigatória' }), { status: 400 });
    }

    // 1. Transforma a pergunta do usuário em vetor
    const embeddingResponse = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: query,
      config: { taskType: 'RETRIEVAL_QUERY' }
    });

    const queryVector = embeddingResponse.embeddings?.[0]?.values 
      || embeddingResponse.embedding?.values 
      || embeddingResponse.values;

    if (!queryVector) {
      throw new Error('Não foi possível gerar embedding da query');
    }

    // 2. Busca os 5 trechos mais relevantes no Pinecone
    const results = await index.query({
      vector: queryVector,
      topK: 5,
      includeMetadata: true
    });

    // 3. Monta o contexto com os trechos encontrados
    const context = results.matches
      .filter(m => (m.score ?? 0) > 0.5) // só trechos relevantes
      .map(m => `[Fonte: ${m.metadata?.source}]\n${m.metadata?.text}`)
      .join('\n\n---\n\n');

    return new Response(JSON.stringify({ context, matches: results.matches.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('RAG error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export const config = { runtime: 'edge' };
