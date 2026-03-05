import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownRenderer from '../../components/MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('does not render raw HTML when allowRawHtml is false', () => {
    const { container } = render(
      <MarkdownRenderer
        content={'Texto <a href="https://evil.example">clique</a> final'}
        allowRawHtml={false}
      />
    );

    expect(container.querySelector('a[href="https://evil.example"]')).toBeNull();
    expect(container.textContent).toContain('Texto');
  });

  it('still renders markdown links when raw HTML is disabled', () => {
    render(<MarkdownRenderer content={'[Site](https://www.senior.com.br/)'} allowRawHtml={false} />);
    const link = screen.getByRole('link', { name: 'Site' });
    expect(link).toHaveAttribute('href', 'https://www.senior.com.br/');
  });
});
