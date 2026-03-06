import { describe, expect, it } from 'vitest';
import { shouldExposeScorePorta } from '../../services/geminiService';

describe('shouldExposeScorePorta', () => {
  it('returns true for a valid target company', () => {
    expect(shouldExposeScorePorta('Grupo Scheffer')).toBe(true);
  });

  it('returns false when there is no inferred company', () => {
    expect(shouldExposeScorePorta(null)).toBe(false);
  });

  it('returns false for competitors or the vendor itself', () => {
    expect(shouldExposeScorePorta('Senior Sistemas')).toBe(false);
    expect(shouldExposeScorePorta('TOTVS')).toBe(false);
  });
});
