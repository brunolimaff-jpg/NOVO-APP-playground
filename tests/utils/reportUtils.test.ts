import { describe, it, expect } from 'vitest';
import { detectInconsistencies } from '../../utils/reportUtils';

describe('detectInconsistencies', () => {
  it('returns empty string for single section', () => {
    expect(detectInconsistencies(['Some text'])).toBe('');
  });

  it('returns empty string when no inconsistencies found', () => {
    const sections = [
      'Faturamento: R$ 500 milhões, 1000 hectares',
      'Faturamento: R$ 500 milhões, 1000 hectares',
    ];
    expect(detectInconsistencies(sections)).toBe('');
  });

  it('detects faturamento inconsistency', () => {
    const sections = [
      'Faturamento: R$ 500 milhões',
      'Faturamento: R$ 800 milhões',
    ];
    const result = detectInconsistencies(sections);
    expect(result).toContain('INCONSISTÊNCIAS DETECTADAS');
    expect(result).toContain('Faturamento');
  });

  it('detects employee count inconsistency', () => {
    const sections = [
      '1500 funcionários na empresa',
      '2000 funcionários na empresa',
    ];
    const result = detectInconsistencies(sections);
    expect(result).toContain('Funcionários');
  });

  it('returns empty for less than 2 sections', () => {
    expect(detectInconsistencies([])).toBe('');
    expect(detectInconsistencies(['one'])).toBe('');
  });
});
