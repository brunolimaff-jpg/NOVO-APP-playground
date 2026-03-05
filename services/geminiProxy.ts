type GeminiApiAction = 'generateContent' | 'chatSendMessage' | 'health';

interface GeminiApiBaseRequest {
  action: GeminiApiAction;
}

interface GeminiGenerateRequest extends GeminiApiBaseRequest {
  action: 'generateContent';
  model: string;
  contents: unknown;
  config?: Record<string, unknown>;
}

interface GeminiChatRequest extends GeminiApiBaseRequest {
  action: 'chatSendMessage';
  model: string;
  systemInstruction: string;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  message: string;
  useGrounding?: boolean;
  thinkingMode?: boolean;
}

interface GeminiHealthRequest extends GeminiApiBaseRequest {
  action: 'health';
}

interface GeminiGenerateResponse {
  text: string;
  candidates?: unknown[];
}

interface GeminiChatResponse {
  text: string;
  groundingChunks?: unknown[];
}

interface GeminiHealthResponse {
  ok: boolean;
  text?: string;
}

const GEMINI_API_ENDPOINT = '/api/gemini';

async function callGeminiApi<TResponse>(
  payload: GeminiGenerateRequest | GeminiChatRequest | GeminiHealthRequest,
  signal?: AbortSignal
): Promise<TResponse> {
  const response = await fetch(GEMINI_API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini proxy failed (${response.status}): ${text || 'unknown error'}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function proxyGenerateContent(
  params: Omit<GeminiGenerateRequest, 'action'>,
  signal?: AbortSignal
): Promise<GeminiGenerateResponse> {
  return callGeminiApi<GeminiGenerateResponse>({ action: 'generateContent', ...params }, signal);
}

export async function proxyChatSendMessage(
  params: Omit<GeminiChatRequest, 'action'>,
  signal?: AbortSignal
): Promise<GeminiChatResponse> {
  return callGeminiApi<GeminiChatResponse>({ action: 'chatSendMessage', ...params }, signal);
}

export async function proxyGeminiHealth(signal?: AbortSignal): Promise<GeminiHealthResponse> {
  return callGeminiApi<GeminiHealthResponse>({ action: 'health' }, signal);
}
