import { describe, it, expect } from 'vitest';
import { fixFakeLinks, fixFakeLinksHTML, extractValidLinks, cleanFakeSourcesBlock } from '../../utils/linkFixer';

describe('fixFakeLinks (Markdown)', () => {
  it('removes ai.studio links and keeps text as bold', () => {
    const input = '[Some AI Tool](https://ai.studio/something)';
    const result = fixFakeLinks(input);
    expect(result).not.toContain('ai.studio');
    expect(result).toContain('**Some AI Tool**');
  });

  it('replaces Wikipedia links with Google search', () => {
    const input = '[Grupo Scheffer](https://pt.wikipedia.org/wiki/Grupo_Scheffer)';
    const result = fixFakeLinks(input);
    expect(result).not.toContain('wikipedia.org');
    expect(result).toContain('google.com/search');
    expect(result).toContain('Grupo Scheffer');
  });

  it('replaces en.wikipedia.org links with Google search', () => {
    const input = '[Soybean](https://en.wikipedia.org/wiki/Soybean)';
    const result = fixFakeLinks(input);
    expect(result).not.toContain('wikipedia.org');
    expect(result).toContain('google.com/search');
    expect(result).toContain('Soybean');
  });

  it('preserves real links', () => {
    const input = '[Senior ERP](https://www.senior.com.br/solucoes/gestao-empresarial-erp)';
    const result = fixFakeLinks(input);
    expect(result).toContain('senior.com.br');
    expect(result).toBe(input);
  });

  it('preserves news portal links', () => {
    const input = '[Notícia](https://valor.globo.com/agronegocios/noticia/2024/01/test.ghtml)';
    const result = fixFakeLinks(input);
    expect(result).toContain('valor.globo.com');
    expect(result).toBe(input);
  });

  it('replaces fake link with Senior product URL when text matches', () => {
    const input = '[ERP Senior](https://ai.studio/erp)';
    const result = fixFakeLinks(input);
    expect(result).toContain('senior.com.br');
    expect(result).not.toContain('ai.studio');
  });

  it('removes standalone fake URLs', () => {
    const input = 'Check this: https://ai.studio/test and also https://pt.wikipedia.org/wiki/Test';
    const result = fixFakeLinks(input);
    expect(result).not.toContain('ai.studio');
    expect(result).not.toContain('wikipedia.org');
  });

  it('handles multiple Wikipedia links in same text', () => {
    const input = `
[Soja](https://pt.wikipedia.org/wiki/Soja) é importante.
[Mato Grosso](https://pt.wikipedia.org/wiki/Mato_Grosso) produz muito.
[Senior](https://www.senior.com.br) é o sistema.
    `.trim();
    const result = fixFakeLinks(input);
    expect(result).not.toContain('wikipedia.org');
    expect((result.match(/google\.com\/search/g) || []).length).toBe(2);
    expect(result).toContain('senior.com.br');
  });

  it('returns empty string for empty input', () => {
    expect(fixFakeLinks('')).toBe('');
  });

  it('handles gemini.google.com links', () => {
    const input = '[Test](https://gemini.google.com/share/abc123)';
    const result = fixFakeLinks(input);
    expect(result).not.toContain('gemini.google.com');
    expect(result).toContain('**Test**');
  });

  it('handles Google Search links as fake', () => {
    const input = '[Resultado](https://www.google.com/search?q=test)';
    const result = fixFakeLinks(input);
    expect(result).not.toContain('google.com/search?q=test');
  });
});

describe('fixFakeLinksHTML', () => {
  it('converts Wikipedia HTML links to Google search', () => {
    const input = '<a href="https://pt.wikipedia.org/wiki/Agroneg%C3%B3cio">Agronegócio</a>';
    const result = fixFakeLinksHTML(input);
    expect(result).not.toContain('wikipedia.org');
    expect(result).toContain('google.com/search');
    expect(result).toContain('Agronegócio');
  });

  it('removes fake HTML links and converts to bold', () => {
    const input = '<a href="https://ai.studio/test">AI Test</a>';
    const result = fixFakeLinksHTML(input);
    expect(result).not.toContain('ai.studio');
    expect(result).toContain('<strong');
    expect(result).toContain('AI Test');
  });

  it('preserves real HTML links', () => {
    const input = '<a href="https://www.senior.com.br">Senior</a>';
    const result = fixFakeLinksHTML(input);
    expect(result).toContain('senior.com.br');
  });
});

describe('extractValidLinks', () => {
  it('excludes Wikipedia links', () => {
    const text = '[Wiki](https://pt.wikipedia.org/wiki/Test) and [Real](https://senior.com.br)';
    const result = extractValidLinks(text);
    expect(result).toHaveLength(1);
    expect(result[0].url).toContain('senior.com.br');
  });

  it('excludes fake links', () => {
    const text = '[Fake](https://ai.studio/x) and [Real](https://valor.globo.com/test)';
    const result = extractValidLinks(text);
    expect(result).toHaveLength(1);
    expect(result[0].url).toContain('valor.globo.com');
  });

  it('returns empty for all-fake text', () => {
    const text = '[A](https://ai.studio/x) [B](https://pt.wikipedia.org/wiki/Y)';
    const result = extractValidLinks(text);
    expect(result).toHaveLength(0);
  });
});

describe('cleanFakeSourcesBlock', () => {
  it('cleans Wikipedia links from sources block', () => {
    const text = `Some content here.

**Fontes:**
- [Agro](https://pt.wikipedia.org/wiki/Agronegocio)
- [Senior](https://www.senior.com.br/solucoes)`;
    const result = cleanFakeSourcesBlock(text);
    expect(result).not.toContain('wikipedia.org');
    expect(result).toContain('senior.com.br');
  });

  it('converts Wikipedia source to Google search link', () => {
    const text = `Content.

Fontes:
- Agronegócio (https://pt.wikipedia.org/wiki/Agroneg%C3%B3cio)`;
    const result = cleanFakeSourcesBlock(text);
    expect(result).toContain('google.com/search');
  });
});
