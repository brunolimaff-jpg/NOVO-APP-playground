import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

const HistoryItemSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string(),
});

const GeminiRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('health') }),
  z.object({
    action: z.literal('generateContent'),
    model: z.string().min(1).max(200).optional(),
    contents: z.unknown(),
    config: z.record(z.unknown()).optional(),
  }),
  z.object({
    action: z.literal('chatSendMessage'),
    model: z.string().min(1).max(200).optional(),
    systemInstruction: z.string().max(100000).optional(),
    history: z.array(HistoryItemSchema).max(40).optional(),
    message: z.string().min(1).max(50000),
    useGrounding: z.boolean().optional(),
    thinkingMode: z.boolean().optional(),
  }),
]);

export const config = {
  runtime: 'nodejs',
};

export const maxDuration = 60;
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-pro-preview';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function toNumberSafe(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeHistory(
  input: Array<{ role: 'user' | 'model'; text: string }> | undefined,
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  if (!input) return [];
  return input
    .slice(-40)
    .map((item) => ({ role: item.role, parts: [{ text: item.text }] }))
    .filter((msg) => msg.parts[0].text.trim().length > 0);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const parsed = GeminiRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const body = parsed.data;
    const ai = new GoogleGenAI({ apiKey: getRequiredEnv('GEMINI_API_KEY') });

    if (body.action === 'health') {
      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: 'Responda apenas: OK',
        config: { temperature: 0, maxOutputTokens: 10 }
      });

      const text = response.text || '';
      const ok = /ok/i.test(text);
      return res.status(200).json({ ok, text });
    }

    if (body.action === 'generateContent') {
      const model = body.model ?? DEFAULT_GEMINI_MODEL;
      const contents = body.contents;
      if (!contents) {
        return res.status(400).json({ error: 'Missing contents' });
      }

      const configIn = (body.config ?? {}) as Record<string, unknown>;
      const config: Record<string, unknown> = {
        temperature: toNumberSafe(configIn.temperature, 0.2),
        maxOutputTokens: toNumberSafe(configIn.maxOutputTokens, 8192),
      };

      if (typeof configIn.responseMimeType === 'string') config.responseMimeType = configIn.responseMimeType;
      if (typeof configIn.systemInstruction === 'string') config.systemInstruction = configIn.systemInstruction;
      if (Array.isArray(configIn.tools)) config.tools = configIn.tools;

      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });

      return res.status(200).json({
        text: response.text || '',
        candidates: response.candidates || []
      });
    }

    if (body.action === 'chatSendMessage') {
      const model = body.model ?? DEFAULT_GEMINI_MODEL;
      const systemInstruction = body.systemInstruction ?? '';
      const history = normalizeHistory(body.history);
      const message = body.message;
      const useGrounding = body.useGrounding ?? true;
      const thinkingMode = body.thinkingMode ?? false;

      const chat = ai.chats.create({
        model,
        history,
        config: {
          systemInstruction,
          // Thinking mode trades creativity for deterministic factual output.
          temperature: thinkingMode ? 0.1 : 0.15,
          maxOutputTokens: 65536,
          tools: useGrounding ? [{ googleSearch: {} }] : undefined
        }
      });

      const response = await chat.sendMessage({ message });
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      return res.status(200).json({
        text: response.text || '',
        groundingChunks
      });
    }

    return res.status(400).json({ error: `Unsupported action: ${body.action}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gemini API proxy error:', message);
    return res.status(500).json({ error: 'Gemini proxy failed', detail: message });
  }
}
