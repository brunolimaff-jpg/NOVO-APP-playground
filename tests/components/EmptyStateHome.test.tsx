import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import EmptyStateHome from '../../components/EmptyStateHome';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { displayName: 'Bruno' } }),
}));

describe('EmptyStateHome onboarding quick start', () => {
  it('prefills prompt when card is clicked', () => {
    const onPreFill = vi.fn();
    const onQuickStart = vi.fn();

    render(
      <EmptyStateHome
        mode="operacao"
        onPreFill={onPreFill}
        onQuickStart={onQuickStart}
        isDarkMode={true}
      />,
    );

    fireEvent.click(screen.getByText(/Levanta a capivara completa/i));
    expect(onPreFill).toHaveBeenCalledTimes(1);
    expect(onQuickStart).not.toHaveBeenCalled();
  });

  it('sends immediately when clicking "Enviar agora"', () => {
    const onPreFill = vi.fn();
    const onQuickStart = vi.fn();

    render(
      <EmptyStateHome
        mode="operacao"
        onPreFill={onPreFill}
        onQuickStart={onQuickStart}
        isDarkMode={false}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Enviar agora' })[0]);
    expect(onQuickStart).toHaveBeenCalledTimes(1);
  });
});
