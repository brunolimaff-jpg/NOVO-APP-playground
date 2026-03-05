import { describe, expect, it } from 'vitest';
import { normalizeLoadingStatus, statusKey } from '../../utils/loadingStatus';

describe('loadingStatus', () => {
  it('ignora fases inventadas pelo modelo', () => {
    expect(normalizeLoadingStatus('Executando Fase 7: Psicologia & Storytelling...')).toBeNull();
  });

  it('normaliza etapas canônicas', () => {
    expect(normalizeLoadingStatus('Analisando complexidade do pedido...')).toBe('Analisando complexidade do pedido...');
    expect(normalizeLoadingStatus('Consultando bases de conhecimento...')).toBe('Consultando bases de conhecimento...');
    expect(normalizeLoadingStatus('Gerando resposta...')).toBe('Gerando resposta...');
  });

  it('mantém etapa dinâmica de histórico da empresa', () => {
    expect(normalizeLoadingStatus('Buscando histórico de coprosoja...')).toBe('Buscando histórico de coprosoja...');
  });

  it('gera a mesma chave para estágios equivalentes', () => {
    expect(statusKey('Buscando histórico de coprosoja...')).toBe('historico');
    expect(statusKey('Buscando histórico de grupo scheffer...')).toBe('historico');
    expect(statusKey('Gerando resposta...')).toBe('resposta');
  });
});
