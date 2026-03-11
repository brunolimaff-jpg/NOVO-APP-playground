import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

const DocsRagRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  namespace: z.string().min(1).max(120).optional(),
});

export const config = {
    runtime: 'nodejs',
};
export const maxDuration = 60;

const DEFAULT_PINECONE_INDEX = 'scout-arsenal';
const DEFAULT_PINECONE_DOCS_NAMESPACE = 'senior-erp-docs';
const COMPETITOR_DOCS_NAMESPACE = 'competitor-pdfs';
const PINECONE_INDEX_SECRET_PREFIX_RE = /^pcsk_/i;
const PINECONE_INDEX_NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const ALLOWED_DOCS_NAMESPACES = new Set<string>([
    DEFAULT_PINECONE_DOCS_NAMESPACE,
    COMPETITOR_DOCS_NAMESPACE,
]);

function getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

function normalizeEnvValue(value?: string | null): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}

function resolvePineconeIndexName(candidate?: string | null): string {
    const normalized = normalizeEnvValue(candidate);

    if (!normalized) return DEFAULT_PINECONE_INDEX;
    if (PINECONE_INDEX_SECRET_PREFIX_RE.test(normalized)) return DEFAULT_PINECONE_INDEX;
    if (!PINECONE_INDEX_NAME_RE.test(normalized)) return DEFAULT_PINECONE_INDEX;

    return normalized;
}

function resolveOptionalNamespace(candidate?: string | null, fallback?: string): string | undefined {
    return normalizeEnvValue(candidate) ?? fallback;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const parsed = DocsRagRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
        }

        const { query, namespace } = parsed.data;

        const ai = new GoogleGenAI({ apiKey: getRequiredEnv('GEMINI_API_KEY') });

        const pineconeKey = process.env.PINECONE_DOCS_KEY || getRequiredEnv('PINECONE_API_KEY');
        const rawIndexName = process.env.PINECONE_DOCS_INDEX || process.env.PINECONE_INDEX;
        const pineconeIndexName = resolvePineconeIndexName(rawIndexName);
        if (rawIndexName?.trim() && rawIndexName.trim() !== pineconeIndexName) {
            console.warn(
                `[Docs RAG] Invalid Pinecone index env "${rawIndexName}" detected. Falling back to "${pineconeIndexName}".`,
            );
        }

        const pc = new Pinecone({ apiKey: pineconeKey });
        const index = pc.index(pineconeIndexName);

        const embeddingResponse = await ai.models.embedContent({
            model: 'gemini-embedding-001',
            contents: query,
            config: { taskType: 'RETRIEVAL_QUERY' }
        });

        const queryVector = embeddingResponse.embeddings?.[0]?.values;

        if (!queryVector || queryVector.length === 0) {
            return res.status(200).json({ context: '' });
        }

        const configuredNamespace = resolveOptionalNamespace(
            process.env.PINECONE_DOCS_NAMESPACE,
            resolveOptionalNamespace(process.env.PINECONE_NAMESPACE, DEFAULT_PINECONE_DOCS_NAMESPACE),
        ) || DEFAULT_PINECONE_DOCS_NAMESPACE;
        const requestedNamespace = resolveOptionalNamespace(namespace);
        const docsNamespace = requestedNamespace || configuredNamespace;
        if (!ALLOWED_DOCS_NAMESPACES.has(docsNamespace)) {
            return res.status(400).json({
                error: 'Invalid namespace',
                allowed: Array.from(ALLOWED_DOCS_NAMESPACES),
            });
        }
        const results = await index.namespace(docsNamespace).query({
            vector: queryVector,
            topK: 5,
            includeMetadata: true
        });

        if (!results.matches || results.matches.length === 0) {
            return res.status(200).json({ context: '' });
        }

        const context = results.matches
            .filter(m => (m.score ?? 0) > 0.35)
            .map(m => {
                const titulo = m.metadata?.titulo || 'Documento';
                const categoria = m.metadata?.categoria || 'Geral';
                const url = m.metadata?.url || '';
                const texto = m.metadata?.text || m.metadata?.content || '';
                return `### ${categoria}: ${titulo}\n${texto}\n(Fonte: ${url})`;
            })
            .join('\n\n---\n\n');

        return res.status(200).json({ context, matches: results.matches.map(m => m.metadata) });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Docs RAG error:', message);
        return res.status(200).json({ context: '', degraded: true, detail: message });
    }
}
