import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScorePorta from '../../components/ScorePorta';

describe('ScorePorta', () => {
  it('shows segment, penalization flags and gross score detail', () => {
    render(
      <ScorePorta
        score={51}
        scoreBruto={72}
        p={7}
        o={8}
        r={6}
        t={7}
        a={7}
        segmento="PRD"
        flags={['TRAD']}
        isDarkMode={false}
      />
    );

    expect(screen.getByText('SEG PRD')).toBeTruthy();
    expect(screen.getAllByText(/TRAD/).length).toBeGreaterThan(0);
    expect(screen.getByText(/bruto: 72/i)).toBeTruthy();
  });

  it('shows empty-flag state when there are no penalties', () => {
    render(
      <ScorePorta
        score={84}
        scoreBruto={84}
        p={8}
        o={10}
        r={7}
        t={8}
        a={8}
        segmento="AGI"
        flags={[]}
        isDarkMode={false}
      />
    );

    expect(screen.getByText('Sem flags')).toBeTruthy();
    expect(screen.getByText(/Alta Compatibilidade/)).toBeTruthy();
  });
});
