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
});
