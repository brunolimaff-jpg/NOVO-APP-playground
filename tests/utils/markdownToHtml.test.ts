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
    const result = convertMarkdownToHTML('[[PORTA:75:P8:O7:R8:T7:A7:AGI:NONE]]', false);
    expect(result).toContain('porta-score');
    expect(result).toContain('75');
    expect(result).toContain('Alta Compatibilidade');
    expect(result).toContain('SEG');
    expect(result).toContain('AGI');
  });

  it('handles penalized PORTA score markers', () => {
    const result = convertMarkdownToHTML('[[PORTA:30:P6:O7:R5:T5:A6:PRD:TRAD,LOCK]]', false);
    expect(result).toContain('Baixa Compatibilidade');
    expect(result).toContain('TRAD');
    expect(result).toContain('LOCK');
  });

  it('keeps backward compatibility with PORTA v1 markers', () => {
    const result = convertMarkdownToHTML('[[PORTA:62:P5:O7:R6:T5:A6]]', false);
    expect(result).toContain('62');
    expect(result).toContain('PRD');
  });
});
