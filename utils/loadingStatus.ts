const STATUS_PHASES = {
  complexity: 'Analisando complexidade do pedido...',
  deepResearch: 'Deep Research ativado — varredura web iniciada...',
  benchmark: 'Mapeando benchmarks...',
  knowledgeBase: 'Consultando bases de conhecimento...',
  response: 'Gerando resposta...',
  hooks: 'Gerando ganchos comerciais finais...',
} as const;

export function normalizeLoadingStatus(rawStatus?: string | null): string | null {
  const status = rawStatus?.trim();
  if (!status) return null;

  if (/^Executando Fase\s+\d+/i.test(status)) return null;
  if (/^Analisando complexidade do pedido/i.test(status)) return STATUS_PHASES.complexity;
  if (/^Deep Research ativado/i.test(status)) return STATUS_PHASES.deepResearch;
  if (/^Buscando histórico de/i.test(status)) return status;
  if (/^Mapeando benchmarks/i.test(status)) return STATUS_PHASES.benchmark;
  if (/^Consultando bases de conhecimento/i.test(status)) return STATUS_PHASES.knowledgeBase;
  if (/^Gerando resposta/i.test(status)) return STATUS_PHASES.response;
  if (/^Gerando ganchos comerciais finais/i.test(status)) return STATUS_PHASES.hooks;

  return null;
}

export function statusKey(status: string): string {
  if (/^Analisando complexidade do pedido/i.test(status)) return 'complexidade';
  if (/^Deep Research ativado/i.test(status)) return 'deep_research';
  if (/^Buscando histórico de/i.test(status)) return 'historico';
  if (/^Mapeando benchmarks/i.test(status)) return 'benchmarks';
  if (/^Consultando bases de conhecimento/i.test(status)) return 'bases';
  if (/^Gerando resposta/i.test(status)) return 'resposta';
  if (/^Gerando ganchos comerciais finais/i.test(status)) return 'ganchos';
  return status;
}
