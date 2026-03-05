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
    const result = convertMarkdownToHTML('[[PORTA:75:P80:O70:R80:T75:A70]]', false);
    expect(result).toContain('porta-score');
    expect(result).toContain('75');
    expect(result).toContain('Alta Compatibilidade');
  });

  it('handles PORTA score with low value', () => {
    const result = convertMarkdownToHTML('[[PORTA:30:P20:O30:R40:T30:A30]]', false);
    expect(result).toContain('Baixa Compatibilidade');
  });
});
