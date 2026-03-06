import { describe, expect, it } from 'vitest';
import { resolveGeminiApiEndpoint } from '../../services/geminiProxy';

describe('resolveGeminiApiEndpoint', () => {
  it('uses deployed proxy for localhost in dev', () => {
    expect(resolveGeminiApiEndpoint('localhost', true)).toBe(
      'https://scoutagro.vercel.app/api/gemini',
    );
  });

  it('uses deployed proxy for 127.0.0.1 in dev', () => {
    expect(resolveGeminiApiEndpoint('127.0.0.1', true)).toBe(
      'https://scoutagro.vercel.app/api/gemini',
    );
  });

  it('keeps relative endpoint outside local dev', () => {
    expect(resolveGeminiApiEndpoint('scoutagro.vercel.app', false)).toBe('/api/gemini');
  });
});
