const STATUS_PHASES = {
  complexity: 'Entendendo sua necessidade...',
  deepResearch: 'Sinais externos em análise...',
  benchmark: 'Cruzando referências de mercado...',
  knowledgeBase: 'Consultando inteligência interna...',
  response: 'Montando resposta prática...',
  hooks: 'Preparando próximos passos...',
} as const;

export function normalizeLoadingStatus(rawStatus?: string | null): string | null {
  const status = rawStatus?.trim();
  if (!status) return null;

  if (/^Executando Fase\s+\d+/i.test(status)) return null;
  if (/^(Analisando complexidade do pedido|Entendendo sua necessidade)/i.test(status)) return STATUS_PHASES.complexity;
  if (/^(Deep Research ativado|Sinais externos em análise)/i.test(status)) return STATUS_PHASES.deepResearch;
  if (/^Buscando histórico de/i.test(status)) return status;
  if (/^(Mapeando benchmarks|Cruzando referências de mercado)/i.test(status)) return STATUS_PHASES.benchmark;
  if (/^(Consultando bases de conhecimento|Consultando inteligência interna)/i.test(status)) return STATUS_PHASES.knowledgeBase;
  if (/^(Gerando resposta|Montando resposta prática)/i.test(status)) return STATUS_PHASES.response;
  if (/^(Gerando ganchos comerciais finais|Preparando próximos passos)/i.test(status)) return STATUS_PHASES.hooks;

  return null;
}

export function statusKey(status: string): string {
  if (/^(Analisando complexidade do pedido|Entendendo sua necessidade)/i.test(status)) return 'complexidade';
  if (/^(Deep Research ativado|Sinais externos em análise)/i.test(status)) return 'deep_research';
  if (/^Buscando histórico de/i.test(status)) return 'historico';
  if (/^(Mapeando benchmarks|Cruzando referências de mercado)/i.test(status)) return 'benchmarks';
  if (/^(Consultando bases de conhecimento|Consultando inteligência interna)/i.test(status)) return 'bases';
  if (/^(Gerando resposta|Montando resposta prática)/i.test(status)) return 'resposta';
  if (/^(Gerando ganchos comerciais finais|Preparando próximos passos)/i.test(status)) return 'ganchos';
  return status;
}
