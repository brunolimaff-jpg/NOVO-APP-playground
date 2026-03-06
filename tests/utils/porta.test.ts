import { describe, expect, it } from 'vitest';
import { parsePortaMarkerV2 } from '../../utils/porta';

describe('parsePortaMarkerV2', () => {
  it('parses v2 markers and computes weighted gross score', () => {
    const result = parsePortaMarkerV2('[[PORTA:51:P7:O8:R6:T7:A7:PRD:TRAD]]');

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

  it('supports v2 markers without flags', () => {
    const result = parsePortaMarkerV2('[[PORTA:84:P8:O10:R7:T8:A8:AGI:NONE]]');

    expect(result?.segmento).toBe('AGI');
    expect(result?.flags).toEqual([]);
    expect(result?.scoreBruto).toBe(84);
  });

  it('keeps backward compatibility with v1 markers', () => {
    const result = parsePortaMarkerV2('[[PORTA:62:P5:O7:R6:T5:A6]]');

    expect(result).toEqual({
      score: 62,
      p: 5,
      o: 7,
      r: 6,
      t: 5,
      a: 6,
      segmento: 'PRD',
      flags: [],
    });
  });

  it('returns null for invalid markers', () => {
    expect(parsePortaMarkerV2('[[PORTA:foo]]')).toBeNull();
  });
});
