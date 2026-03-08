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

  it('forces hard recovery when standby fallback appears on location question', async () => {
    proxyGenerateContentMock
      .mockResolvedValueOnce({
        text: JSON.stringify({
          empresa: 'Grupo Scheffer',
          benchmark: false,
          rota: 'tatica',
        }),
      })
      .mockResolvedValueOnce({
        text: 'As algodoeiras do Grupo Scheffer ficam em Sapezal (MT), Campo Novo do Parecis (MT) e Diamantino (MT).',
      })
      .mockResolvedValue({
        text: JSON.stringify([
          'Onde ficam os CDs dessa empresa?',
          'Qual a capacidade mensal de beneficiamento?',
          'Quem decide logística no grupo?',
        ]),
      });

    proxyChatSendMessageMock
      .mockResolvedValueOnce({
        text: 'Como você não enviou um novo comando, o radar está em stand-by.',
        groundingChunks: [],
      })
      .mockResolvedValueOnce({
        text: 'Como você não enviou um novo comando, o radar está em stand-by.',
        groundingChunks: [],
      });

    const { sendMessageToGemini } = await import('../../services/geminiService');
    const result = await sendMessageToGemini(
      'onde ficam as algodoeiras?',
      [],
      'Instrução de sistema',
      {},
      false,
    );

    expect(proxyChatSendMessageMock).toHaveBeenCalledTimes(2);
    expect(proxyGenerateContentMock).toHaveBeenCalledTimes(3);
    expect(result.text).toContain('Sapezal (MT)');
  });
});
