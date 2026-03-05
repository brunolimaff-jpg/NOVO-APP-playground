import { describe, expect, it } from 'vitest';
import { buildLoadingCuriositiesFallback, parseLoadingCuriosities } from '../../utils/loadingCuriosities';

describe('loadingCuriosities', () => {
  it('fallback inclui contexto da empresa e Senior', () => {
    const lines = buildLoadingCuriositiesFallback('Coprosoja');
    expect(lines.some((line) => line.toLowerCase().includes('coprosoja'))).toBe(true);
    expect(lines.some((line) => line.toLowerCase().includes('senior'))).toBe(true);
  });

  it('parseia resposta estruturada e preserva blocos empresa/senior', () => {
    const raw = JSON.stringify({
      empresa: ['Coprosoja ampliou armazenagem em apuração.'],
      senior: ['Senior Sistemas atua com ERP, HCM e GAtec no Brasil.'],
      setor: ['Agro intensifica digitalização de operações de grãos.']
    });
    const lines = parseLoadingCuriosities(raw, 'Coprosoja');
    expect(lines[0]).toContain('Coprosoja');
    expect(lines.some((line) => line.toLowerCase().includes('senior'))).toBe(true);
  });

  it('quando JSON vem inválido, usa fallback robusto', () => {
    const lines = parseLoadingCuriosities('texto livre inválido', 'Grupo Scheffer');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((line) => line.toLowerCase().includes('senior'))).toBe(true);
  });
});
