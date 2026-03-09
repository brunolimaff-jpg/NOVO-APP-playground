import { describe, expect, it } from 'vitest';
import { normalizeLoadingStatus, statusKey } from '../../utils/loadingStatus';

describe('loadingStatus', () => {
  it('ignora fases inventadas pelo modelo', () => {
    expect(normalizeLoadingStatus('Executando Fase 7: Psicologia & Storytelling...')).toBeNull();
  });

  it('normaliza etapas canônicas', () => {
    expect(normalizeLoadingStatus('Entendendo sua necessidade...')).toBe('Entendendo sua necessidade...');
    expect(normalizeLoadingStatus('Consultando inteligência interna...')).toBe('Consultando inteligência interna...');
    expect(normalizeLoadingStatus('Montando resposta prática...')).toBe('Montando resposta prática...');
  });

  it('aceita frases antigas como alias e retorna o texto novo', () => {
    expect(normalizeLoadingStatus('Analisando complexidade do pedido...')).toBe('Entendendo sua necessidade...');
    expect(normalizeLoadingStatus('Deep Research ativado — varredura web iniciada...')).toBe('Sinais externos em análise...');
    expect(normalizeLoadingStatus('Mapeando benchmarks...')).toBe('Cruzando referências de mercado...');
    expect(normalizeLoadingStatus('Consultando bases de conhecimento...')).toBe('Consultando inteligência interna...');
    expect(normalizeLoadingStatus('Gerando resposta...')).toBe('Montando resposta prática...');
    expect(normalizeLoadingStatus('Gerando ganchos comerciais finais...')).toBe('Preparando próximos passos...');
  });

  it('mantém etapa dinâmica de histórico da empresa', () => {
    expect(normalizeLoadingStatus('Buscando histórico de coprosoja...')).toBe('Buscando histórico de coprosoja...');
  });

  it('gera a mesma chave para estágios equivalentes', () => {
    expect(statusKey('Buscando histórico de coprosoja...')).toBe('historico');
    expect(statusKey('Buscando histórico de grupo scheffer...')).toBe('historico');
    expect(statusKey('Gerando resposta...')).toBe('resposta');
    expect(statusKey('Montando resposta prática...')).toBe('resposta');
  });
});
