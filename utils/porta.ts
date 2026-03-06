import { PORTA_FLAG_PENALTIES, PORTA_WEIGHTS, PortaFlag, PortaSegmento, ScorePortaData } from '../types';

export const PORTA_MARKER_ANY_REGEX = /\[\[PORTA:[^\]]*\]\]/g;
const PORTA_AUX_MARKER_ANY_REGEX = /\[\[(?:PORTA_FEED_[A-Z0-9_]+|PORTA_FLAG|PORTA_SEG):[\s\S]*?\]\]/g;
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
  return content.replace(PORTA_MARKER_ANY_REGEX, '').replace(PORTA_AUX_MARKER_ANY_REGEX, '');
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

function clampPillar(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10, Math.round(value)));
}

function parseNumericFromChunk(chunk: string): number | null {
  const match = chunk.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\[\]\s]/g, '')
    .toUpperCase();
}

function avg(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function employeesToProxyP(employees: number): number {
  if (employees >= 10000) return 10;
  if (employees >= 5000) return 9;
  if (employees >= 2000) return 8;
  if (employees >= 1000) return 7;
  if (employees >= 500) return 6;
  if (employees >= 200) return 5;
  if (employees >= 80) return 4;
  if (employees >= 30) return 3;
  if (employees > 0) return 2;
  return 0;
}

function parsePortaFeeds(content: string): ScorePortaData | null {
  const notes = {
    p: [] as number[],
    o: [] as number[],
    r: [] as number[],
    t: [] as number[],
    a: [] as number[],
    a2: [] as number[],
    pProxyEmployees: [] as number[],
  };

  const activeFlags = new Set<PortaFlag>();
  let segmento: PortaSegmento | null = null;

  const markerRegex = /\[\[(PORTA_FEED_[A-Z0-9_]+|PORTA_FLAG|PORTA_SEG):([\s\S]*?)\]\]/g;
  for (const markerMatch of content.matchAll(markerRegex)) {
    const marker = markerMatch[1];
    const body = markerMatch[2];

    if (marker === 'PORTA_SEG') {
      const segMatch = body.match(/PRD|AGI|COP/i);
      if (segMatch) segmento = segMatch[0].toUpperCase() as PortaSegmento;
      continue;
    }

    if (marker === 'PORTA_FLAG') {
      const parts = body.split(':');
      const rawFlag = normalizeToken(parts[0] || '');
      const rawStatus = normalizeToken(parts[1] || '');
      const isActive = rawStatus === 'SIM';
      if (isActive && (rawFlag === 'TRAD' || rawFlag === 'LOCK' || rawFlag === 'NOFIT')) {
        activeFlags.add(rawFlag as PortaFlag);
      }
      continue;
    }

    const note = parseNumericFromChunk(body);
    if (marker === 'PORTA_FEED_P_PROXY') {
      if (note !== null) notes.pProxyEmployees.push(note);
      continue;
    }
    if (note === null) continue;

    if (marker === 'PORTA_FEED_P') notes.p.push(note);
    if (marker === 'PORTA_FEED_O') notes.o.push(note);
    if (marker === 'PORTA_FEED_R' || marker === 'PORTA_FEED_R_TRAB') notes.r.push(note);
    if (marker === 'PORTA_FEED_T') notes.t.push(note);
    if (marker === 'PORTA_FEED_A') notes.a.push(note);
    if (marker === 'PORTA_FEED_A2') notes.a2.push(note);
  }

  const pFromMass = notes.p.length ? avg(notes.p) : null;
  const pFromProxy =
    notes.pProxyEmployees.length > 0 ? avg(notes.pProxyEmployees.map(employeesToProxyP)) : null;

  let p: number | null = null;
  if (pFromMass !== null && pFromProxy !== null) p = (pFromMass * 2 + pFromProxy) / 3;
  else if (pFromMass !== null) p = pFromMass;
  else if (pFromProxy !== null) p = pFromProxy;

  const o = notes.o.length ? avg(notes.o) : null;
  const r = notes.r.length ? avg(notes.r) : null;
  const t = notes.t.length ? avg(notes.t) : null;
  const aMain = notes.a.length ? avg(notes.a) : null;
  const a2 = notes.a2.length ? avg(notes.a2) : null;

  let a: number | null = null;
  if (aMain !== null && a2 !== null) a = (aMain * 2 + a2) / 3;
  else if (aMain !== null) a = aMain;
  else if (a2 !== null) a = a2;

  const hasMinimumPillars = p !== null && o !== null && r !== null && t !== null && a !== null;
  if (!hasMinimumPillars) return null;

  const finalSegmento = segmento || 'PRD';
  const orderedFlags = (['TRAD', 'LOCK', 'NOFIT'] as PortaFlag[]).filter(flag => activeFlags.has(flag));

  const pNote = clampPillar(p);
  const oNote = clampPillar(o);
  const rNote = clampPillar(r);
  const tNote = clampPillar(t);
  const aNote = clampPillar(a);
  const scoreBruto = calculatePortaScoreBruto(pNote, oNote, rNote, tNote, aNote, finalSegmento);
  const multiplier = calculatePortaFlagMultiplier(orderedFlags);
  const score = Math.max(0, Math.min(100, Math.round(scoreBruto * multiplier)));

  return {
    score,
    p: pNote,
    o: oNote,
    r: rNote,
    t: tNote,
    a: aNote,
    segmento: finalSegmento,
    flags: orderedFlags,
    scoreBruto,
  };
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

  return parsePortaFeeds(content);
}
