const MAX_ITEMS = 8;

function toLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const sanitizeLine = (line: string): string => line.replace(/\s+/g, ' ').trim();
  const isStatusLikeLine = (line: string): boolean => (
    /^(buscando|consultando|cruzando|mapeando|analisando|gerando|montando|preparando)\b/i.test(line) ||
    /^(passo|fase)\s+\d+/i.test(line) ||
    /(em andamento|investiga[cç][aã]o em andamento)/i.test(line)
  );
  const isUnsafeLine = (line: string): boolean => {
    const text = line.toLowerCase();
    return (
      text.includes('investigacao_completa_integrada') ||
      text.includes('protocolo de investigação forense') ||
      text.includes('dossiê completo de [') ||
      text.includes('conta alvo:') ||
      text.includes('nunca viole') ||
      text.includes('porta_feed') ||
      text.includes('[[porta') ||
      text.includes('[[status') ||
      text.includes('###') ||
      text.includes('diretriz') ||
      text.includes('contexto cadastral obrigatório')
    );
  };

  return value
    .map((item) => (typeof item === 'string' ? sanitizeLine(item) : ''))
    .filter((item) => item.length > 10 && item.length <= 220)
    .filter((item) => !isStatusLikeLine(item))
    .filter((item) => !isUnsafeLine(item));
}

function interleaveGroups(groups: string[][], limit = MAX_ITEMS): string[] {
  const buckets = groups.map((group) => [...group]);
  const out: string[] = [];
  while (out.length < limit && buckets.some((bucket) => bucket.length > 0)) {
    for (const bucket of buckets) {
      const next = bucket.shift();
      if (next && !out.includes(next)) out.push(next);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function removeInstitutionalSeniorLines(lines: string[]): string[] {
  return lines.filter((line) => !/senior sistemas|proposta de valor da senior/i.test(line));
}

export function buildLoadingCuriositiesFallback(context: string): string[] {
  const company = context?.trim();
  if (!company) {
    return [
      'No agro brasileiro, ganhos de margem costumam vir de disciplina operacional e previsibilidade de safra.',
      'Empresas com rotina forte de indicadores tendem a reduzir perdas invisíveis em logística e armazenagem.',
      'Projetos de digitalização no campo evoluem melhor quando finanças, operação e comercial compartilham a mesma base.',
      'Em ciclos de expansão, governança de dados vira diferencial para sustentar crescimento com controle.'
    ];
  }

  return [
    `${company} pode revelar vantagem competitiva quando operação, comercial e liderança usam os mesmos indicadores.`,
    `Em empresas como ${company}, eficiência logística e controle de custos costumam impactar margem mais rápido que preço.`,
    `Quando ${company} acelera crescimento, padronização de processo vira ponto-chave para escalar sem perder governança.`,
    `Sinais públicos de ${company} ajudam a antecipar prioridades de investimento e janelas de decisão.`
  ];
}

export function parseLoadingCuriosities(rawText: string, context: string): string[] {
  const fallback = buildLoadingCuriositiesFallback(context);
  if (!rawText?.trim()) return fallback;

  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) {
      const generic = context?.trim() ? removeInstitutionalSeniorLines(toLines(parsed)) : toLines(parsed);
      return generic.length > 0 ? [...generic, ...fallback].slice(0, MAX_ITEMS) : fallback;
    }

    if (parsed && typeof parsed === 'object') {
      const empresa = toLines((parsed as Record<string, unknown>).empresa);
      const setor = toLines((parsed as Record<string, unknown>).setor);
      const regional = toLines((parsed as Record<string, unknown>).regional);

      const merged = interleaveGroups([empresa, setor, regional], MAX_ITEMS);
      return merged.length > 0 ? [...merged, ...fallback].slice(0, MAX_ITEMS) : fallback;
    }

    return fallback;
  } catch {
    return fallback;
  }
}
