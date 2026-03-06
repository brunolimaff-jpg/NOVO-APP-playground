import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PINECONE_DOCS_NAMESPACE,
  DEFAULT_PINECONE_INDEX,
  didFallbackPineconeIndex,
  resolveOptionalNamespace,
  resolvePineconeIndexName,
} from '../../utils/pineconeConfig';

describe('pineconeConfig', () => {
  it('keeps valid index names', () => {
    expect(resolvePineconeIndexName('scout-arsenal')).toBe('scout-arsenal');
  });

  it('falls back when the index env looks like a Pinecone API key', () => {
    expect(resolvePineconeIndexName('pcsk_abc123')).toBe(DEFAULT_PINECONE_INDEX);
    expect(didFallbackPineconeIndex('pcsk_abc123')).toBe(true);
  });

  it('falls back when the index env is malformed', () => {
    expect(resolvePineconeIndexName('invalid index')).toBe(DEFAULT_PINECONE_INDEX);
  });

  it('trims namespaces and respects defaults', () => {
    expect(resolveOptionalNamespace('  senior-erp-docs  ')).toBe('senior-erp-docs');
    expect(resolveOptionalNamespace('', DEFAULT_PINECONE_DOCS_NAMESPACE)).toBe(
      DEFAULT_PINECONE_DOCS_NAMESPACE,
    );
  });
});
