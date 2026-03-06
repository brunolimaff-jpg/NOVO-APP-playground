import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/clientLookupService', () => ({
  lookupCliente: vi.fn(),
  formatarParaPrompt: vi.fn(() => ''),
  benchmarkClientes: vi.fn(),
  formatarBenchmarkParaPrompt: vi.fn(() => ''),
  isConcorrenteOuPropria: vi.fn(() => false),
}));

vi.mock('../../components/InvestigationDashboard', () => ({
  addInvestigation: vi.fn(),
}));

vi.mock('../../services/competitorService', () => ({
  getContextoConcorrentesRegionais: vi.fn(() => ''),
}));

vi.mock('../../services/ragService', () => ({
  buscarContextoPinecone: vi.fn(),
  buscarContextoDocsPinecone: vi.fn(),
}));

vi.mock('../../utils/promptGuard', () => ({
  CANARY_TOKEN: 'canary',
  scanInput: vi.fn((message: string) => ({ level: 'ok', sanitized: message })),
  sanitizeExternalContent: vi.fn((value: string) => value),
}));

vi.mock('../../utils/loadingCuriosities', () => ({
  parseLoadingCuriosities: vi.fn(() => []),
}));

vi.mock('../../services/geminiProxy', () => ({
  proxyChatSendMessage: vi.fn(),
  proxyGenerateContent: vi.fn(),
}));

vi.mock('../../utils/retry', () => ({
  withAutoRetry: vi.fn(async (_label: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../../utils/errorHelpers', () => ({
  normalizeAppError: vi.fn((error: unknown) => error),
}));

vi.mock('../../config/models', () => ({
  MODEL_IDS: {
    router: 'router',
    tactical: 'tactical',
    deepChat: 'deepChat',
    deepResearch: 'deepResearch',
  },
}));

describe('geminiService PORTA parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses PORTA v2 markers with segmento, flags and score bruto', async () => {
    const { parsePortaMarkerV2 } = await import('../../services/geminiService');

    const result = parsePortaMarkerV2('Resumo [[PORTA:51:P7:O8:R6:T7:A7:PRD:TRAD]] final');

    expect(result).toEqual({
      score: 51,
      p: 7,
      o: 8,
      r: 6,
      t: 7,
      a: 7,
      segmento: 'PRD',
      flags: ['TRAD'],
      scoreBruto: 72,
    });
  });

  it('keeps backward compatibility with legacy PORTA v1 markers', async () => {
    const { parsePortaMarkerV2 } = await import('../../services/geminiService');

    const result = parsePortaMarkerV2('[[PORTA:68:P5:O4:R3:T9:A9]]');

    expect(result).toEqual({
      score: 68,
      p: 5,
      o: 4,
      r: 3,
      t: 9,
      a: 9,
      segmento: 'PRD',
      flags: [],
    });
  });

  it('parseMarkers removes statuses and PORTA marker from visible text', async () => {
    const { parseMarkers } = await import('../../services/geminiService');

    const result = parseMarkers('Intro [[STATUS:Investigando]] resumo [[PORTA:45:P9:O9:R8:T6:A5:AGI:LOCK]] final');

    expect(result.statuses).toEqual(['Investigando']);
    expect(result.scorePorta).toEqual({
      score: 45,
      p: 9,
      o: 9,
      r: 8,
      t: 6,
      a: 5,
      segmento: 'AGI',
      flags: ['LOCK'],
      scoreBruto: 76,
    });
    expect(result.text).toBe('Intro  resumo  final');
  });

  it('sanitizeStreamText strips v2 markers from streamed text', async () => {
    const { sanitizeStreamText } = await import('../../services/geminiService');

    const result = sanitizeStreamText('Resumo [[PORTA:21:P6:O7:R5:T5:A6:PRD:TRAD,LOCK]] [[STATUS:Etapa]] final');

    expect(result).toContain('Resumo');
    expect(result).toContain('final');
    expect(result).not.toContain('[[PORTA:');
    expect(result).not.toContain('[[STATUS:');
  });
});
