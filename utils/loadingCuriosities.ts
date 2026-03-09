const MAX_ITEMS = 8;

function toLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const sanitizeLine = (line: string): string => line.replace(/\s+/g, ' ').trim();
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

export function buildLoadingCuriositiesFallback(context: string): string[] {
  const company = context?.trim();
  if (!company) {
    return [
      'Buscando evidências para conectar dor operacional com proposta de valor da Senior...',
      'Consultando sinais do mercado-alvo e padrões de compra B2B...',
      'Senior Sistemas atua com ERP, HCM e soluções para operações complexas no Brasil.',
      'Mapeando exemplos de integração entre gestão corporativa e operação de campo.'
    ];
  }

  return [
    `Buscando evidências públicas de ${company} para conectar dor operacional com proposta de valor...`,
    `Levantando movimentos recentes, expansão e sinais públicos de ${company}...`,
    'Senior Sistemas combina ERP, HCM e GAtec para reduzir retrabalho entre áreas.',
    `Cruzando ${company} com benchmarks operacionais para identificar lacunas de gestão...`
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
      const generic = toLines(parsed);
      return generic.length > 0 ? [...generic, ...fallback].slice(0, MAX_ITEMS) : fallback;
    }

    if (parsed && typeof parsed === 'object') {
      const empresa = toLines((parsed as Record<string, unknown>).empresa);
      const senior = toLines((parsed as Record<string, unknown>).senior);
      const setor = toLines((parsed as Record<string, unknown>).setor);
      const regional = toLines((parsed as Record<string, unknown>).regional);

      const merged = interleaveGroups([empresa, senior, setor, regional], MAX_ITEMS);
      return merged.length > 0 ? [...merged, ...fallback].slice(0, MAX_ITEMS) : fallback;
    }

    return fallback;
  } catch {
    return fallback;
  }
}
