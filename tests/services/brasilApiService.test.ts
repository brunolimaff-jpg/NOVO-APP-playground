import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCompanyByCnpj,
  formatCnpj,
  isValidCnpj,
  normalizeCnpj,
  validateCityInState,
} from '../../services/brasilApiService';

describe('brasilApiService helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes and formats cnpj', () => {
    const normalized = normalizeCnpj('04.252.011/0001-10');
    expect(normalized).toBe('04252011000110');
    expect(formatCnpj(normalized)).toBe('04.252.011/0001-10');
  });

  it('validates check digits', () => {
    expect(isValidCnpj('04252011000110')).toBe(true);
    expect(isValidCnpj('04252011000111')).toBe(false);
  });

  it('falls back to ReceitaWS when BrasilAPI fails', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cnpj: '04.252.011/0001-10',
          nome: 'Empresa Exemplo SA',
          fantasia: 'Empresa Exemplo',
          municipio: 'Cuiabá',
          uf: 'MT',
        }),
      } as Response);

    const result = await fetchCompanyByCnpj('04.252.011/0001-10');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.companyName).toBe('Empresa Exemplo');
    expect(result.city).toBe('Cuiabá');
    expect(result.state).toBe('MT');
  });

  it('validates city and uf via IBGE', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ nome: 'Cuiabá' }, { nome: 'Várzea Grande' }],
    } as Response);

    const result = await validateCityInState('Cuiaba', 'MT');
    expect(result.isValid).toBe(true);
    expect(result.normalizedCity).toBe('Cuiabá');
  });
});
