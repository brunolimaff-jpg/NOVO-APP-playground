import { describe, it, expect } from 'vitest';
import { extractCompanyName } from '../../utils/companyNameExtractor';

describe('extractCompanyName', () => {
  it('returns "Empresa" for null/undefined input', () => {
    expect(extractCompanyName(null)).toBe('Empresa');
    expect(extractCompanyName(undefined)).toBe('Empresa');
    expect(extractCompanyName('')).toBe('Empresa');
  });

  it('extracts company name from "investigar" pattern', () => {
    expect(extractCompanyName('Investigar Grupo Scheffer')).toBe('Scheffer');
    expect(extractCompanyName('investigar a SLC Agrícola')).toBe('SLC Agrícola');
  });

  it('extracts company name from "empresa" pattern', () => {
    expect(extractCompanyName('empresa Bunge')).toBe('Bunge');
    expect(extractCompanyName('Grupo Amaggi')).toBe('Amaggi');
  });

  it('extracts company name from "dossie" pattern', () => {
    expect(extractCompanyName('dossie da Cargill')).toBe('Cargill');
  });

  it('extracts company name from "sobre" pattern', () => {
    expect(extractCompanyName('sobre a JBS')).toBe('JBS');
  });

  it('strips trailing ellipsis', () => {
    expect(extractCompanyName('Investigar Marfrig...')).toBe('Marfrig');
  });

  it('returns cleaned title when no pattern matches', () => {
    expect(extractCompanyName('BRF S.A.')).toBe('BRF S.A.');
  });

  it('rejects very short names (<=2 chars)', () => {
    expect(extractCompanyName('Investigar AB')).toBe('Investigar AB');
  });
});
