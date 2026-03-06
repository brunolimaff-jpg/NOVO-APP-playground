import { PORTA_FLAG_PENALTIES, PORTA_WEIGHTS, PortaFlag, PortaSegmento, ScorePortaData } from '../types';

export const PORTA_MARKER_ANY_REGEX = /\[\[PORTA:[^\]]*\]\]/g;
export const PORTA_FEED_MARKER_REGEX = /\[\[PORTA_(?:FEED|FLAG|SEG)[^\]]*\]\]/g;
export const PORTA_MARKER_V2_REGEX =
  /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+):(PRD|AGI|COP):(NONE|(?:(?:TRAD|LOCK|NOFIT)(?:,(?:TRAD|LOCK|NOFIT))*))\]\]/;
export const PORTA_MARKER_V1_REGEX = /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+)\]\]/;

export const PORTA_SEGMENT_LABELS: Record<PortaSegmento, string> = {
  PRD: 'Produtor Rural',
  AGI: 'Agroindústria',
  COP: 'Cooperativa',
};

export const PORTA_FLAG_META: Record<
  PortaFlag,
  { icon: string; label: string; shortLabel: string; description: string }
> = {
  TRAD: {
    icon: '🚩',
    label: 'Trading puro',
    shortLabel: 'TRAD',
    description: 'Receita concentrada em compra e revenda de commodities.',
  },
  LOCK: {
    icon: '🔒',
    label: 'ERP corporativo travado',
    shortLabel: 'LOCK',
    description: 'Decisão local travada por contrato ou governança corporativa.',
  },
  NOFIT: {
    icon: '⛔',
    label: 'Sem fit GAtec',
    shortLabel: 'NOFIT',
    description: 'Core operacional fora do portfólio Senior/GAtec.',
  },
};

export function getPortaCompatibility(score: number): {
  emoji: string;
  label: string;
  color: string;
  background: string;
} {
  if (score >= 71) {
    return {
      emoji: '🟢',
      label: 'Alta Compatibilidade',
      color: '#059669',
      background: 'rgba(5,150,105,0.15)',
    };
  }

  if (score >= 41) {
    return {
      emoji: '🟡',
      label: 'Média Compatibilidade',
      color: '#eab308',
      background: 'rgba(234,179,8,0.15)',
    };
  }

  return {
    emoji: '🔴',
    label: 'Baixa Compatibilidade',
    color: '#ef4444',
    background: 'rgba(239,68,68,0.15)',
  };
}

export function stripPortaMarkers(content: string): string {
  return content.replace(PORTA_MARKER_ANY_REGEX, '').replace(PORTA_FEED_MARKER_REGEX, '');
}

export function calculatePortaScoreBruto(
  p: number,
  o: number,
  r: number,
  t: number,
  a: number,
  segmento: PortaSegmento,
): number {
  const weights = PORTA_WEIGHTS[segmento];

  return Math.round((p * weights.p + o * weights.o + r * weights.r + t * weights.t + a * weights.a) * 10);
}

export function calculatePortaFlagMultiplier(flags: PortaFlag[]): number {
  return flags.reduce((acc, flag) => acc * PORTA_FLAG_PENALTIES[flag], 1);
}

export function parsePortaMarkerV2(content: string): ScorePortaData | null {
  const v2Match = content.match(PORTA_MARKER_V2_REGEX);

  if (v2Match) {
    const p = Number.parseInt(v2Match[2], 10);
    const o = Number.parseInt(v2Match[3], 10);
    const r = Number.parseInt(v2Match[4], 10);
    const t = Number.parseInt(v2Match[5], 10);
    const a = Number.parseInt(v2Match[6], 10);
    const segmento = v2Match[7] as PortaSegmento;
    const flags = v2Match[8] === 'NONE' ? [] : (v2Match[8].split(',') as PortaFlag[]);

    return {
      score: Number.parseInt(v2Match[1], 10),
      p,
      o,
      r,
      t,
      a,
      segmento,
      flags,
      scoreBruto: calculatePortaScoreBruto(p, o, r, t, a, segmento),
    };
  }

  const v1Match = content.match(PORTA_MARKER_V1_REGEX);

  if (v1Match) {
    return {
      score: Number.parseInt(v1Match[1], 10),
      p: Number.parseInt(v1Match[2], 10),
      o: Number.parseInt(v1Match[3], 10),
      r: Number.parseInt(v1Match[4], 10),
      t: Number.parseInt(v1Match[5], 10),
      a: Number.parseInt(v1Match[6], 10),
      segmento: 'PRD',
      flags: [],
    };
  }

  return null;
}
