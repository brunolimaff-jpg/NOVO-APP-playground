import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScorePorta from '../../components/ScorePorta';

describe('ScorePorta', () => {
  it('renders segment, flags and penalty summary for v2 data', () => {
    render(
      <ScorePorta
        score={45}
        p={9}
        o={9}
        r={8}
        t={6}
        a={5}
        segmento="AGI"
        flags={['LOCK']}
        scoreBruto={76}
        isDarkMode={false}
      />,
    );

    expect(screen.getByText('PORTA v2')).toBeInTheDocument();
    expect(screen.getByText('AGI')).toBeInTheDocument();
    expect(screen.getByText('🔒')).toBeInTheDocument();
    expect(screen.getByText('LOCK')).toBeInTheDocument();
    expect(screen.getByText('Score final 45 (bruto: 76 - penalizado por LOCK)')).toBeInTheDocument();
    expect(screen.getByText('🟡 Média Compatibilidade')).toBeInTheDocument();
    expect(screen.getByText('Segmento: Agroindústria')).toBeInTheDocument();
  });

  it('renders NONE when no flags are active', () => {
    render(<ScorePorta score={84} p={8} o={10} r={7} t={8} a={8} segmento="AGI" flags={[]} scoreBruto={84} />);

    expect(screen.getByText('Flags: NONE')).toBeInTheDocument();
  });
});
