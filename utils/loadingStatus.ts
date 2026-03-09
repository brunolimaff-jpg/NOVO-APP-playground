const STATUS_PHASES = {
  complexity: 'Entendendo sua necessidade...',
  deepResearch: 'Sinais externos em análise...',
  benchmark: 'Cruzando referências de mercado...',
  knowledgeBase: 'Consultando inteligência interna...',
  response: 'Montando resposta prática...',
  hooks: 'Preparando próximos passos...',
} as const;

const LIVE_PHASE_LABELS: Record<number, string> = {
  [-1]: 'Riscos Ocultos',
  1: 'Incentivos Fiscais',
  2: 'Intel Territorial',
  3: 'Logística & Supply',
  4: 'Donos e Sócios',
  5: 'Executivos',
  6: 'Sinais de Venda',
  7: 'Storytelling',
  8: 'Recomendações de Produtos Senior',
};

function parseLivePhaseStatus(status: string): string | null {
  const match = status.match(/^Executando Fase\s*(-?\d+)\b/i);
  if (!match) return null;
  const phaseNumber = Number.parseInt(match[1], 10);
  const phaseLabel = LIVE_PHASE_LABELS[phaseNumber];
  if (!Number.isFinite(phaseNumber) || !phaseLabel) return null;
  return `Fase ${phaseNumber}: ${phaseLabel}`;
}

export function isPhaseTimelineStatus(status: string): boolean {
  return /^Fase\s*-?\d+\s*:/i.test(status.trim());
}

export function normalizeLoadingStatus(rawStatus?: string | null): string | null {
  const status = rawStatus?.trim();
  if (!status) return null;

  const livePhaseStatus = parseLivePhaseStatus(status);
  if (livePhaseStatus) return livePhaseStatus;
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
  const phaseMatch = status.match(/^Fase\s*(-?\d+)\s*:/i);
  if (phaseMatch) return `fase_${phaseMatch[1]}`;
  if (/^(Analisando complexidade do pedido|Entendendo sua necessidade)/i.test(status)) return 'complexidade';
  if (/^(Deep Research ativado|Sinais externos em análise)/i.test(status)) return 'deep_research';
  if (/^Buscando histórico de/i.test(status)) return 'historico';
  if (/^(Mapeando benchmarks|Cruzando referências de mercado)/i.test(status)) return 'benchmarks';
  if (/^(Consultando bases de conhecimento|Consultando inteligência interna)/i.test(status)) return 'bases';
  if (/^(Gerando resposta|Montando resposta prática)/i.test(status)) return 'resposta';
  if (/^(Gerando ganchos comerciais finais|Preparando próximos passos)/i.test(status)) return 'ganchos';
  return status;
}
