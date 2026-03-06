import { describe, expect, it } from 'vitest';
import {
  calculatePortaFlagMultiplier,
  calculatePortaScoreBruto,
  parsePortaMarkerV2,
  stripPortaMarkers,
} from '../../utils/porta';

describe('PORTA v2 helpers', () => {
  it('parses a v2 marker with segment, flags and score bruto', () => {
    const parsed = parsePortaMarkerV2('[[PORTA:51:P7:O8:R6:T7:A7:PRD:TRAD]]');

    expect(parsed).toEqual({
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

  it('keeps backward compatibility with v1 markers', () => {
    const parsed = parsePortaMarkerV2('[[PORTA:68:P5:O4:R3:T9:A9]]');

    expect(parsed).toEqual({
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

  it('strips raw markers from mixed text', () => {
    expect(stripPortaMarkers('Antes [[PORTA:45:P9:O9:R8:T6:A5:AGI:LOCK]] depois')).toBe('Antes  depois');
  });

  it('calculates weights and penalties consistently', () => {
    expect(calculatePortaScoreBruto(9, 9, 8, 6, 5, 'AGI')).toBe(76);
    expect(calculatePortaFlagMultiplier(['TRAD', 'LOCK'])).toBe(0.3);
  });

  it('consolidates score from PORTA feeds (Scheffer-like case)', () => {
    const parsed = parsePortaMarkerV2(`
[[PORTA_FEED_O:[9]:ELOS:[plantio,armazenagem,beneficiamento,exportacao,logistica,rastreabilidade]]]
[[PORTA_FEED_R:[7]:PRESSOES:[ibama,certificacao]]]
[[PORTA_FEED_T:[8]:T1:[7]:T2:[8]:T3:[9]:STACK:[TOTVS]]]
[[PORTA_FEED_P:[8]:HA:[160000]:CNPJS:[18]:FAT:[5000000000]]]
[[PORTA_FEED_A:[8]:A1:[8]:A2:[8]:GERACAO:[G2]]]
[[PORTA_SEG:[AGI]]]
[[PORTA_FLAG:LOCK:[NAO]]]
[[PORTA_FLAG:TRAD:[NAO]:NATUREZA:[PRODUCAO]]]
[[PORTA_FLAG:NOFIT:[NAO]]]
`);

    expect(parsed).not.toBeNull();
    expect(parsed!.segmento).toBe('AGI');
    expect(parsed!.flags).toEqual([]);
    expect(parsed!.scoreBruto).toBe(81);
    expect(parsed!.score).toBe(81);
  });

  it('applies TRAD penalty when feed flag is active (trading case)', () => {
    const parsed = parsePortaMarkerV2(`
[[PORTA_FEED_P:[6]:HA:[1200]:CNPJS:[4]:FAT:[900000000]]]
[[PORTA_FEED_O:[4]:ELOS:[comercializacao]]]
[[PORTA_FEED_R:[6]:PRESSOES:[sefaz,difal]]]
[[PORTA_FEED_T:[6]:T1:[5]:T2:[6]:T3:[6]:STACK:[planilhas]]]
[[PORTA_FEED_A:[5]:A1:[4]:A2:[6]:GERACAO:[PROF]]]
[[PORTA_SEG:[PRD]]]
[[PORTA_FLAG:TRAD:[SIM]:NATUREZA:[TRADING]]]
`);

    expect(parsed).not.toBeNull();
    expect(parsed!.flags).toEqual(['TRAD']);
    expect(parsed!.scoreBruto).toBe(53);
    expect(parsed!.score).toBe(32);
  });

  it('builds P and A from proxy feeds when full feeds are absent (fazenda media)', () => {
    const parsed = parsePortaMarkerV2(`
[[PORTA_FEED_O:[6]:ELOS:[plantio,armazenagem,logistica]]]
[[PORTA_FEED_R:[5]:PRESSOES:[certificacao]]]
[[PORTA_FEED_T:[7]:T1:[6]:T2:[7]:T3:[8]:STACK:[viasoft]]]
[[PORTA_FEED_P_PROXY:FUNC:[320]]]
[[PORTA_FEED_A2:[6]:TIMING:[NEUTRO]:FASE:[ENTRESSAFRA]]]
[[PORTA_SEG:[PRD]]]
`);

    expect(parsed).not.toBeNull();
    expect(parsed!.p).toBe(5);
    expect(parsed!.a).toBe(6);
    expect(parsed!.scoreBruto).toBe(61);
    expect(parsed!.score).toBe(61);
  });
});
