import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import EmptyStateHome from '../../components/EmptyStateHome';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { displayName: 'Bruno' } }),
}));

describe('EmptyStateHome onboarding gate', () => {
  it('does not submit while required fields are missing', () => {
    const onStartInvestigation = vi.fn();

    render(
      <EmptyStateHome
        mode="operacao"
        onStartInvestigation={onStartInvestigation}
        isDarkMode={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Iniciar investigação completa/i }));
    expect(onStartInvestigation).not.toHaveBeenCalled();
  });

  it('submits once mandatory fields are valid', () => {
    const onStartInvestigation = vi.fn();

    render(
      <EmptyStateHome
        mode="operacao"
        onStartInvestigation={onStartInvestigation}
        isDarkMode={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Nome da empresa *'), { target: { value: 'Grupo Scheffer' } });
    fireEvent.change(screen.getByPlaceholderText('Cidade *'), { target: { value: 'Cuiabá' } });
    fireEvent.change(screen.getByPlaceholderText('UF *'), { target: { value: 'MT' } });
    fireEvent.click(screen.getByRole('button', { name: /Iniciar investigação completa/i }));

    expect(onStartInvestigation).toHaveBeenCalledTimes(1);
    expect(onStartInvestigation).toHaveBeenCalledWith({
      companyName: 'Grupo Scheffer',
      cnpj: null,
      city: 'Cuiabá',
      state: 'MT',
    });
  });
});
