import { describe, expect, it } from 'vitest';
import { buildLoadingCuriositiesFallback, parseLoadingCuriosities } from '../../utils/loadingCuriosities';

describe('loadingCuriosities', () => {
  it('fallback com empresa mantém foco na conta alvo', () => {
    const lines = buildLoadingCuriositiesFallback('Coprosoja');
    expect(lines.some((line) => line.toLowerCase().includes('coprosoja'))).toBe(true);
    expect(lines.some((line) => line.toLowerCase().includes('senior sistemas'))).toBe(false);
  });

  it('parseia resposta estruturada com foco em empresa/setor/região', () => {
    const raw = JSON.stringify({
      empresa: ['Coprosoja ampliou armazenagem em apuração.'],
      setor: ['Agro intensifica digitalização de operações de grãos.']
    });
    const lines = parseLoadingCuriosities(raw, 'Coprosoja');
    expect(lines[0]).toContain('Coprosoja');
    expect(lines.some((line) => line.toLowerCase().includes('agro'))).toBe(true);
  });

  it('quando JSON vem inválido, usa fallback robusto', () => {
    const lines = parseLoadingCuriosities('texto livre inválido', 'Grupo Scheffer');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((line) => line.toLowerCase().includes('grupo scheffer'))).toBe(true);
  });

  it('filtra textos internos de prompt e protocolo do loading', () => {
    const raw = JSON.stringify({
      empresa: [
        'INVESTIGACAO_COMPLETA_INTEGRADA (MVP): Execute o dossie.',
        'Grupo Scheffer ampliou operação logística em MT.',
      ],
      senior: ['Protocolo de investigação forense especializada: conteúdo interno'],
      setor: ['O agro em MT segue com sinais de expansão em armazenagem.'],
    });
    const lines = parseLoadingCuriosities(raw, 'Grupo Scheffer');
    expect(lines.some((line) => line.includes('INVESTIGACAO_COMPLETA_INTEGRADA'))).toBe(false);
    expect(lines.some((line) => line.toLowerCase().includes('protocolo de investigação forense'))).toBe(false);
    expect(lines.some((line) => line.includes('Grupo Scheffer'))).toBe(true);
  });
});
