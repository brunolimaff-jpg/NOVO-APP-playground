import { describe, it, expect } from 'vitest';
import { isFakeUrl, isUnreliableUrl, isReliableUrl, findSeniorProductUrl } from '../../services/apiConfig';

describe('isFakeUrl', () => {
  it('detects ai.studio as fake', () => {
    expect(isFakeUrl('https://ai.studio/something')).toBe(true);
  });

  it('detects gemini.google.com as fake', () => {
    expect(isFakeUrl('https://gemini.google.com/share/abc')).toBe(true);
  });

  it('detects bard.google.com as fake', () => {
    expect(isFakeUrl('https://bard.google.com/chat')).toBe(true);
  });

  it('detects google search as fake', () => {
    expect(isFakeUrl('https://www.google.com/search?q=test')).toBe(true);
  });

  it('does NOT mark wikipedia as fake (it is unreliable, not fake)', () => {
    expect(isFakeUrl('https://pt.wikipedia.org/wiki/Test')).toBe(false);
  });

  it('does NOT mark real URLs as fake', () => {
    expect(isFakeUrl('https://www.senior.com.br')).toBe(false);
    expect(isFakeUrl('https://valor.globo.com/test')).toBe(false);
  });

  it('treats empty URL as fake', () => {
    expect(isFakeUrl('')).toBe(true);
  });

  it('handles malformed URLs gracefully', () => {
    expect(isFakeUrl('not-a-url')).toBe(false);
    expect(isFakeUrl('ai.studio/test')).toBe(true);
  });
});

describe('isUnreliableUrl', () => {
  it('detects pt.wikipedia.org as unreliable', () => {
    expect(isUnreliableUrl('https://pt.wikipedia.org/wiki/Soja')).toBe(true);
  });

  it('detects en.wikipedia.org as unreliable', () => {
    expect(isUnreliableUrl('https://en.wikipedia.org/wiki/Soybean')).toBe(true);
  });

  it('detects es.wikipedia.org as unreliable', () => {
    expect(isUnreliableUrl('https://es.wikipedia.org/wiki/Soja')).toBe(true);
  });

  it('detects example.com as unreliable', () => {
    expect(isUnreliableUrl('https://example.com/test')).toBe(true);
  });

  it('also catches fake URLs', () => {
    expect(isUnreliableUrl('https://ai.studio/test')).toBe(true);
  });

  it('does NOT mark real URLs as unreliable', () => {
    expect(isUnreliableUrl('https://www.senior.com.br')).toBe(false);
    expect(isUnreliableUrl('https://valor.globo.com/test')).toBe(false);
    expect(isUnreliableUrl('https://www.jusbrasil.com.br/test')).toBe(false);
  });
});

describe('isReliableUrl', () => {
  it('marks senior.com.br as reliable', () => {
    expect(isReliableUrl('https://www.senior.com.br')).toBe(true);
  });

  it('marks news portal as reliable', () => {
    expect(isReliableUrl('https://valor.globo.com/agronegocios/test')).toBe(true);
  });

  it('rejects wikipedia as not reliable', () => {
    expect(isReliableUrl('https://pt.wikipedia.org/wiki/Test')).toBe(false);
  });

  it('rejects ai.studio as not reliable', () => {
    expect(isReliableUrl('https://ai.studio/test')).toBe(false);
  });
});

describe('findSeniorProductUrl', () => {
  it('finds ERP URL', () => {
    const result = findSeniorProductUrl('ERP');
    expect(result).toContain('gestao-empresarial-erp');
  });

  it('finds WMS URL', () => {
    const result = findSeniorProductUrl('WMS');
    expect(result).toContain('logistica/wms');
  });

  it('finds SimpleFarm URL', () => {
    const result = findSeniorProductUrl('SimpleFarm');
    expect(result).toContain('gatec.com.br/simplefarm');
  });

  it('handles accented text', () => {
    const result = findSeniorProductUrl('Gestão de Pessoas');
    expect(result).toContain('gestao-de-pessoas-hcm');
  });

  it('returns null for unknown product', () => {
    expect(findSeniorProductUrl('xyz unknown product')).toBe(null);
  });
});
