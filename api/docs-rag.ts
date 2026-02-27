import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';

export const config = {
    runtime: 'nodejs',
};
export const maxDuration = 60; // 60 segundos para Vercel Serverless Function

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ context: '' });
    }

    try {
        const { query } = req.body;
        if (!query) return res.status(200).json({ context: '' });

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

        // Suporte para chave e index isolados para a base de documentação
        const pineconeKey = process.env.PINECONE_DOCS_KEY || process.env.PINECONE_API_KEY;
        const pineconeIndexName = process.env.PINECONE_DOCS_INDEX || 'scout-arsenal';

        const pc = new Pinecone({ apiKey: pineconeKey! });
        const index = pc.index(pineconeIndexName);

        // Gera embedding da query de documentação
        const embeddingResponse = await ai.models.embedContent({
            model: 'gemini-embedding-001',
            contents: query,
            config: { taskType: 'RETRIEVAL_QUERY' }
        });

        const queryVector = embeddingResponse.embeddings?.[0]?.values;

        if (!queryVector || queryVector.length === 0) {
            return res.status(200).json({ context: '' });
        }

        // Busca no Pinecone, estritamente no namespace de documentacao
        const results = await index.namespace('senior-erp-docs').query({
            vector: queryVector,
            topK: 5,
            includeMetadata: true
        });

        if (!results.matches || results.matches.length === 0) {
            return res.status(200).json({ context: '' });
        }

        // Filtra e mapeia resultados (cortando score 0.35 para evitar alucinações de temas não relacionados)
        const context = results.matches
            .filter(m => (m.score ?? 0) > 0.35)
            .map(m => `[Documentação Oficial ERP - ${m.metadata?.categoria}: ${m.metadata?.titulo}](${m.metadata?.url})\nFonte oficial para guiar o usuário.`)
            .join('\n\n---\n\n');

        return res.status(200).json({ context, matches: results.matches.map(m => m.metadata) });

    } catch (error: any) {
        console.error('Docs RAG error:', error);
        return res.status(200).json({ context: '' }); // falha silenciosa para não quebrar a UI
    }
}
