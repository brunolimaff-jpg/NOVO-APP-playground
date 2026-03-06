import { describe, expect, it, vi } from 'vitest';

describe('resolveGeminiApiEndpoint', () => {
  it('uses the deployed Vercel endpoint on localhost', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_GEMINI_PROXY_URL', '');

    const { resolveGeminiApiEndpoint } = await import('../../services/geminiProxy');

    expect(resolveGeminiApiEndpoint('localhost')).toBe('https://scoutagro.vercel.app/api/gemini');
  });

  it('uses the relative API route outside local dev', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_GEMINI_PROXY_URL', '');

    const { resolveGeminiApiEndpoint } = await import('../../services/geminiProxy');

    expect(resolveGeminiApiEndpoint('scoutagro.vercel.app')).toBe('/api/gemini');
  });

  it('prefers an explicit configured endpoint', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_GEMINI_PROXY_URL', 'https://proxy.example.com/api/gemini');

    const { resolveGeminiApiEndpoint } = await import('../../services/geminiProxy');

    expect(resolveGeminiApiEndpoint('localhost')).toBe('https://proxy.example.com/api/gemini');
  });
});
