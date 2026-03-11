import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContentMock = vi.hoisted(() => vi.fn());
const buscarDocsMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/geminiProxy', () => ({
  proxyGenerateContent: generateContentMock,
}));

vi.mock('../../services/ragService', () => ({
  buscarContextoDocsPinecone: buscarDocsMock,
}));

const emptyResponse = {
  text: 'Resposta de teste',
  candidates: [{ groundingMetadata: { groundingChunks: [] } }],
};

describe('warRoomService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    buscarDocsMock.mockResolvedValue('');
  });

  it('propagates inferred target for competitive modes', async () => {
    generateContentMock.mockResolvedValue(emptyResponse);
    const { queryWarRoom } = await import('../../services/warRoomService');

    await queryWarRoom('benchmark', 'Compare Senior vs TOTVS', [], '', undefined);

    const payload = generateContentMock.mock.calls[0][0];
    expect(payload.config.systemInstruction).toContain('TOTVS');
  });

  it('limits history context and keeps recent turns only', async () => {
    generateContentMock.mockResolvedValue(emptyResponse);
    const { queryWarRoom } = await import('../../services/warRoomService');

    const history = Array.from({ length: 12 }).map((_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'model' as const,
      text: i === 0 ? 'OLD_MARKER should disappear' : `Mensagem ${i}`,
    }));

    await queryWarRoom('tech', 'Como funciona compras?', history, '', undefined);

    const payload = generateContentMock.mock.calls[0][0];
    const prompt = payload.contents[0].parts[0].text;
    expect(prompt).not.toContain('OLD_MARKER should disappear');
    expect(prompt).toContain('Mensagem 11');
  });

  it('skips malformed source URLs without failing whole response', async () => {
    generateContentMock.mockResolvedValue({
      text: 'OK',
      candidates: [{
        groundingMetadata: {
          groundingChunks: [
            { web: { uri: 'ht!tp://invalid uri', title: 'Bad' } },
            { web: { uri: 'https://example.com/docs', title: 'Good' } },
          ]
        }
      }],
    });

    const { queryWarRoom } = await import('../../services/warRoomService');
    const result = await queryWarRoom('benchmark', 'vs SAP', [], 'SAP', undefined);

    expect(result.text).toContain('OK');
    expect(result.sources).toEqual([{ title: 'Good', url: 'https://example.com/docs' }]);
  });

  it('shows explicit degraded warning when docs RAG is unavailable', async () => {
    buscarDocsMock.mockResolvedValue('');
    generateContentMock.mockResolvedValue(emptyResponse);
    const statuses: string[] = [];
    const { queryWarRoom } = await import('../../services/warRoomService');

    const result = await queryWarRoom('tech', 'Explique integração NFe', [], '', (s) => statuses.push(s));

    expect(statuses.some((s) => s.includes('Documentação indisponível'))).toBe(true);
    expect(result.text).toContain('Aviso: a documentação oficial');
  });

  it('prioritizes agricultural process context over integration context', async () => {
    buscarDocsMock
      .mockResolvedValueOnce(
        [
          '### Agricola: Ordem de Serviço',
          'Fluxo de abertura, execução e apontamentos.',
          '(Fonte: https://documentacao.senior.com.br/simplefarm/manual-do-usuario/agricola/ordem-de-servico)',
        ].join('\n'),
      )
      .mockResolvedValueOnce(
        [
          '### Integracao Gatec: Integração com GAtec',
          'Arquitetura de integração com ERP.',
          '(Fonte: https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/manuais_processos/agronegocio/integracao-gatec/inicio-integracao-gatec.htm)',
        ].join('\n'),
      );
    generateContentMock.mockResolvedValue(emptyResponse);
    const { queryWarRoom } = await import('../../services/warRoomService');

    await queryWarRoom('tech', 'Como funciona a gestão agrícola da gatec?', [], '', undefined);

    const payload = generateContentMock.mock.calls[0][0];
    const prompt = payload.contents[0].parts[0].text as string;
    expect(prompt).toContain('FOCO DE RESPOSTA');
    expect(prompt).toContain('ordens de serviço');
    expect(prompt).toContain('Ordem de Serviço');
    expect(prompt).not.toContain('Integração com GAtec');
  });

  it('retries transient model errors and succeeds', async () => {
    generateContentMock
      .mockRejectedValueOnce(new Error('503 overloaded'))
      .mockResolvedValueOnce(emptyResponse);

    const { queryWarRoom } = await import('../../services/warRoomService');
    const result = await queryWarRoom('killscript', 'contra SAP', [], 'SAP', undefined);

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(result.text).toContain('Resposta de teste');
  });

  it('returns canceled message when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { queryWarRoom } = await import('../../services/warRoomService');

    const result = await queryWarRoom('tech', 'teste', [], '', undefined, { signal: controller.signal });
    expect(result.text).toContain('cancelada');
  });
});
