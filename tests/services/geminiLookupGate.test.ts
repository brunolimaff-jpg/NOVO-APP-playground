import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookupClienteMock = vi.fn();
const benchmarkClientesMock = vi.fn();
const proxyGenerateContentMock = vi.fn();
const proxyChatSendMessageMock = vi.fn();

vi.mock('../../services/clientLookupService', () => ({
  lookupCliente: lookupClienteMock,
  formatarParaPrompt: () => 'LOOKUP_PROMPT',
  benchmarkClientes: benchmarkClientesMock,
  formatarBenchmarkParaPrompt: () => 'BENCHMARK_PROMPT',
  isConcorrenteOuPropria: () => false,
}));

vi.mock('../../services/competitorService', () => ({
  getContextoConcorrentesRegionais: () => '',
}));

vi.mock('../../services/ragService', () => ({
  buscarContextoPinecone: vi.fn(async () => ''),
  buscarContextoDocsPinecone: vi.fn(async () => ''),
}));

vi.mock('../../utils/promptGuard', () => ({
  CANARY_TOKEN: 'canary',
  scanInput: (input: string) => ({ level: 'safe', sanitized: input }),
  sanitizeExternalContent: (input: string) => input,
  wrapUserInput: (input: string) => `<user_input>\n${input}\n</user_input>`,
}));

vi.mock('../../utils/retry', () => ({
  withAutoRetry: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../../utils/porta', () => ({
  parsePortaMarkerV2: () => null,
  stripPortaMarkers: (input: string) => input,
}));

vi.mock('../../services/geminiProxy', () => ({
  proxyGenerateContent: proxyGenerateContentMock,
  proxyChatSendMessage: proxyChatSendMessageMock,
}));

vi.mock('../../services/portaStateService', () => ({
  addFeedAdjustment: vi.fn(),
  addFlagFeed: vi.fn(),
  addSegmentFeed: vi.fn(),
  generatePortaContextForDeepDive: vi.fn(() => ''),
  getPortaState: vi.fn(() => null),
  initPortaState: vi.fn(),
  resetPortaState: vi.fn(),
  setBaseScore: vi.fn(),
}));

vi.mock('../../components/InvestigationDashboard', () => ({
  addInvestigation: vi.fn(),
}));

describe('sendMessageToGemini lookup gate', () => {
  beforeEach(() => {
    lookupClienteMock.mockReset();
    benchmarkClientesMock.mockReset();
    proxyGenerateContentMock.mockReset();
    proxyChatSendMessageMock.mockReset();

    lookupClienteMock.mockResolvedValue({
      ok: true,
      query: 'Senior Sistemas',
      encontrado: true,
      total: 1,
      results: [],
    });
    benchmarkClientesMock.mockResolvedValue({
      ok: true,
      mode: 'benchmark',
      keywords: ['agro'],
      total: 1,
      results: [],
    });

    proxyGenerateContentMock.mockResolvedValue({
      text: JSON.stringify({
        empresa: 'Senior Sistemas',
        benchmark: true,
        rota: 'tatica',
      }),
    });
    proxyChatSendMessageMock.mockResolvedValue({
      text: 'Resumo comercial.\n\n### Sugestões\n- Próximo passo 1\n- Próximo passo 2\n- Próximo passo 3',
      groundingChunks: [],
    });
  });

  it('does not call lookup and benchmark when canUseLookup=false', async () => {
    const { sendMessageToGemini } = await import('../../services/geminiService');
    const result = await sendMessageToGemini(
      'investigar Senior Sistemas',
      [],
      'Instrução de sistema',
      {},
      false,
    );

    expect(lookupClienteMock).not.toHaveBeenCalled();
    expect(benchmarkClientesMock).not.toHaveBeenCalled();
    expect(result.text).toContain('Resumo comercial');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('keeps current behavior for allowed users (canUseLookup=true)', async () => {
    const { sendMessageToGemini } = await import('../../services/geminiService');
    await sendMessageToGemini(
      'investigar Senior Sistemas',
      [],
      'Instrução de sistema',
      {},
      true,
    );

    expect(lookupClienteMock).toHaveBeenCalledTimes(1);
    expect(benchmarkClientesMock).toHaveBeenCalledTimes(1);
  });
});
