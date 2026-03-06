import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  DEFAULT_PINECONE_INDEX,
  didFallbackPineconeIndex,
  resolveOptionalNamespace,
  resolvePineconeIndexName,
} from '../utils/pineconeConfig.ts';

export const config = {
  runtime: 'nodejs',
};
export const maxDuration = 60;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const { query } = body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "query" field (string required)' });
    }

    if (query.length > 10000) {
      return res.status(400).json({ error: 'Query too long (max 10000 chars)' });
    }

    const ai = new GoogleGenAI({ apiKey: getRequiredEnv('GEMINI_API_KEY') });

    const pineconeKey = process.env.PINECONE_API_KEY || process.env.PINECONE_DOCS_KEY;
    if (!pineconeKey) {
      throw new Error('Missing required env var: PINECONE_API_KEY or PINECONE_DOCS_KEY');
    }

    const rawIndexName = process.env.PINECONE_INDEX || process.env.PINECONE_DOCS_INDEX;
    const pineconeIndexName = resolvePineconeIndexName(rawIndexName, DEFAULT_PINECONE_INDEX);
    if (didFallbackPineconeIndex(rawIndexName, DEFAULT_PINECONE_INDEX)) {
      console.warn(
        `[RAG] Invalid Pinecone index env "${rawIndexName}" detected. Falling back to "${pineconeIndexName}".`,
      );
    }
    const namespace = resolveOptionalNamespace(process.env.PINECONE_NAMESPACE);
    const pc = new Pinecone({ apiKey: pineconeKey });
    const index = pc.index(pineconeIndexName);
    const queryTarget = namespace ? index.namespace(namespace) : index;

    const embeddingResponse = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: query,
      config: { taskType: 'RETRIEVAL_QUERY' }
    });

    const queryVector = embeddingResponse.embeddings?.[0]?.values;

    if (!queryVector || queryVector.length === 0) {
      return res.status(200).json({ context: '' });
    }

    const results = await queryTarget.query({
      vector: queryVector,
      topK: 8,
      includeMetadata: true
    });

    const context = results.matches
      .filter(m => (m.score ?? 0) > 0.35)
      .map(m => `[Proposta: ${m.metadata?.source}]\n${m.metadata?.text}`)
      .join('\n\n---\n\n');

    return res.status(200).json({ context });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('RAG error:', message);
    return res.status(200).json({ context: '', degraded: true, detail: message });
  }
}
