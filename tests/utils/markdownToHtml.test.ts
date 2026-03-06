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

  it('converts PORTA v1 score markers', () => {
    const result = convertMarkdownToHTML('[[PORTA:75:P80:O70:R80:T75:A70]]', false);
    expect(result).toContain('porta-score');
    expect(result).toContain('75');
    expect(result).toContain('Alta Compatibilidade');
  });

  it('handles PORTA v1 score with low value', () => {
    const result = convertMarkdownToHTML('[[PORTA:30:P20:O30:R40:T30:A30]]', false);
    expect(result).toContain('Baixa Compatibilidade');
  });

  it('converts PORTA v2 score markers with segment and no flags', () => {
    const result = convertMarkdownToHTML('[[PORTA:84:P8:O10:R7:T8:A8:AGI:NONE]]', false);
    expect(result).toContain('porta-score');
    expect(result).toContain('84');
    expect(result).toContain('Alta Compatibilidade');
    expect(result).toContain('Agroindústria');
  });

  it('converts PORTA v2 score markers with flags', () => {
    const result = convertMarkdownToHTML('[[PORTA:51:P7:O8:R6:T7:A7:PRD:TRAD]]', false);
    expect(result).toContain('porta-score');
    expect(result).toContain('51');
    expect(result).toContain('Média Compatibilidade');
    expect(result).toContain('Trading');
    expect(result).toContain('Produtor Rural');
  });

  it('converts PORTA v2 with multiple flags', () => {
    const result = convertMarkdownToHTML('[[PORTA:21:P6:O7:R5:T5:A6:PRD:TRAD,LOCK]]', false);
    expect(result).toContain('Baixa Compatibilidade');
    expect(result).toContain('Trading');
    expect(result).toContain('ERP Travado');
  });
});
