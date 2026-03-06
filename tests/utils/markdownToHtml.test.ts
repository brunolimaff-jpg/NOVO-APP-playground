import { describe, it, expect } from 'vitest';
import { convertMarkdownToHTML } from '../../utils/markdownToHtml';

describe('convertMarkdownToHTML', () => {
  it('converts headings', () => {
    const result = convertMarkdownToHTML('# Title', false);
    expect(result).toContain('<h1>Title</h1>');
  });

  it('converts bold text', () => {
    const result = convertMarkdownToHTML('**bold**', false);
    expect(result).toContain('<strong>bold</strong>');
  });

  it('converts italic text', () => {
    const result = convertMarkdownToHTML('*italic*', false);
    expect(result).toContain('<em>italic</em>');
  });

  it('converts links', () => {
    const result = convertMarkdownToHTML('[Senior](https://senior.com.br)', false);
    expect(result).toContain('href="https://senior.com.br"');
    expect(result).toContain('Senior');
  });

  it('preserves full link with parentheses in URL', () => {
    const url = 'https://example.com/docs/api(v2)/guia?ref=abc(def)';
    const result = convertMarkdownToHTML(`[Documentacao](${url})`, false);
    expect(result).toContain(`href="${url}"`);
  });

  it('blocks AI studio links', () => {
    const result = convertMarkdownToHTML('[Text](https://ai.studio/something)', false);
    expect(result).not.toContain('href=');
    expect(result).toContain('<strong');
  });

  it('converts list items', () => {
    const result = convertMarkdownToHTML('- Item 1\n- Item 2', false);
    expect(result).toContain('<li>Item 1</li>');
    expect(result).toContain('<li>Item 2</li>');
  });

  it('converts PORTA score markers', () => {
    const result = convertMarkdownToHTML('[[PORTA:51:P7:O8:R6:T7:A7:PRD:TRAD]]', false);
    expect(result).toContain('porta-score');
    expect(result).toContain('51');
    expect(result).toContain('Segmento:</b> PRD');
    expect(result).toContain('penalizado por TRAD');
  });

  it('handles legacy PORTA markers with backward compatibility', () => {
    const result = convertMarkdownToHTML('[[PORTA:30:P3:O3:R4:T3:A3]]', false);
    expect(result).toContain('Baixa Compatibilidade');
    expect(result).toContain('Flags:</b> NONE');
  });
});
