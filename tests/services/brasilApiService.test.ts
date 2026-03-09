import { describe, expect, it } from 'vitest';
import { formatCnpj, isValidCnpj, normalizeCnpj } from '../../services/brasilApiService';

describe('brasilApiService helpers', () => {
  it('normalizes and formats cnpj', () => {
    const normalized = normalizeCnpj('04.252.011/0001-10');
    expect(normalized).toBe('04252011000110');
    expect(formatCnpj(normalized)).toBe('04.252.011/0001-10');
  });

  it('validates check digits', () => {
    expect(isValidCnpj('04252011000110')).toBe(true);
    expect(isValidCnpj('04252011000111')).toBe(false);
  });
});
