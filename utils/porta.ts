import { PORTA_WEIGHTS, PortaFlag, PortaSegmento, ScorePortaData } from '../types';

const PORTA_V2_REGEX =
  /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+):(PRD|AGI|COP):(NONE|(?:(?:TRAD|LOCK|NOFIT)(?:,(?:TRAD|LOCK|NOFIT))*))\]\]/;
const PORTA_V1_REGEX = /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+)\]\]/;

export const PORTA_FLAG_META: Record<PortaFlag, { icon: string; label: string }> = {
  TRAD: { icon: '🚩', label: 'TRAD' },
  LOCK: { icon: '🔒', label: 'LOCK' },
  NOFIT: { icon: '⛔', label: 'NOFIT' },
};

export function parsePortaMarkerV2(content: string): ScorePortaData | null {
  const v2Match = content.match(PORTA_V2_REGEX);

  if (v2Match) {
    const flags: PortaFlag[] = v2Match[8] === 'NONE' ? [] : (v2Match[8].split(',') as PortaFlag[]);
    const segmento = v2Match[7] as PortaSegmento;
    const p = parseInt(v2Match[2], 10);
    const o = parseInt(v2Match[3], 10);
    const r = parseInt(v2Match[4], 10);
    const t = parseInt(v2Match[5], 10);
    const a = parseInt(v2Match[6], 10);
    const weights = PORTA_WEIGHTS[segmento];
    const scoreBruto = Math.round((p * weights.p + o * weights.o + r * weights.r + t * weights.t + a * weights.a) * 10);

    return {
      score: parseInt(v2Match[1], 10),
      p,
      o,
      r,
      t,
      a,
      segmento,
      flags,
      scoreBruto,
    };
  }

  const v1Match = content.match(PORTA_V1_REGEX);

  if (v1Match) {
    return {
      score: parseInt(v1Match[1], 10),
      p: parseInt(v1Match[2], 10),
      o: parseInt(v1Match[3], 10),
      r: parseInt(v1Match[4], 10),
      t: parseInt(v1Match[5], 10),
      a: parseInt(v1Match[6], 10),
      segmento: 'PRD',
      flags: [],
    };
  }

  return null;
}
