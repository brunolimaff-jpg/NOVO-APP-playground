import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buscarContextoPinecone, buscarContextoDocsPinecone } from '../../services/ragService';

describe('ragService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('buscarContextoPinecone returns context on success', async () => {
    const mockResponse = { context: 'Some RAG context' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await buscarContextoPinecone('test query');
    expect(result).toBe('Some RAG context');
    expect(fetch).toHaveBeenCalledWith('/api/rag', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ query: 'test query' }),
    }));
  });

  it('buscarContextoPinecone returns empty on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await buscarContextoPinecone('test query');
    expect(result).toBe('');
  });

  it('buscarContextoPinecone returns empty on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await buscarContextoPinecone('test query');
    expect(result).toBe('');
  });

  it('buscarContextoDocsPinecone calls correct endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ context: 'docs context' }),
    });

    const result = await buscarContextoDocsPinecone('test');
    expect(result).toBe('docs context');
    expect(fetch).toHaveBeenCalledWith('/api/docs-rag', expect.anything());
  });
});
