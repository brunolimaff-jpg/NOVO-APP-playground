import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

function toStringSafe(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toNumberSafe(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toBooleanSafe(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeHistory(input: unknown): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-40)
    .map((item) => {
      const role = item && typeof item === 'object' && (item as any).role === 'model' ? 'model' : 'user';
      const text = item && typeof item === 'object' ? toStringSafe((item as any).text, '') : '';
      return { role, parts: [{ text }] };
    })
    .filter((msg) => msg.parts[0].text.trim().length > 0);
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

    const action = toStringSafe((body as any).action, '');
    const ai = new GoogleGenAI({ apiKey: getRequiredEnv('GEMINI_API_KEY') });

    if (action === 'health') {
      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: 'Responda apenas: OK',
        config: { temperature: 0, maxOutputTokens: 10 }
      });

      const text = response.text || '';
      const ok = /ok/i.test(text);
      return res.status(200).json({ ok, text });
    }

    if (action === 'generateContent') {
      const model = toStringSafe((body as any).model, DEFAULT_GEMINI_MODEL);
      const contents = (body as any).contents;
      if (!contents) {
        return res.status(400).json({ error: 'Missing contents' });
      }

      const configIn = ((body as any).config || {}) as Record<string, unknown>;
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

    if (action === 'chatSendMessage') {
      const model = toStringSafe((body as any).model, DEFAULT_GEMINI_MODEL);
      const systemInstruction = toStringSafe((body as any).systemInstruction, '');
      const history = normalizeHistory((body as any).history);
      const message = toStringSafe((body as any).message, '');
      const useGrounding = toBooleanSafe((body as any).useGrounding, true);

      if (!message.trim()) {
        return res.status(400).json({ error: 'Missing message' });
      }

      const chat = ai.chats.create({
        model,
        history,
        config: {
          systemInstruction,
          temperature: 0.15,
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

    return res.status(400).json({ error: `Unsupported action: ${action}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gemini API proxy error:', message);
    return res.status(500).json({ error: 'Gemini proxy failed', detail: message });
  }
}
