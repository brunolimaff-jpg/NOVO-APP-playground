import { describe, expect, it } from 'vitest';

// Keep this extractor in sync with components/WarRoom.tsx.
const CLEAN_TARGET_RE = /^[\s"'`(,-]+|[\s"'`).,;:!?-]+$/g;
const normalizeCompetitorTarget = (value: string): string =>
  value
    .replace(/^\s*(?:a|o|as|os)\s+/i, '')
    .replace(CLEAN_TARGET_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
const isSeniorAlias = (value: string): boolean =>
  /\b(senior|senior sistemas)\b/i.test(value);
const extractCompetitorFromMessage = (message: string): string => {
  const text = message.trim();
  const compareWith = text.match(/\bcompar(?:e|ar)?\s+(.{2,80}?)\s+\bcom\b\s+(.{2,80}?)(?:$|[?.!,;])/i);
  if (compareWith) {
    const left = normalizeCompetitorTarget(compareWith[1]);
    const right = normalizeCompetitorTarget(compareWith[2]);
    if (isSeniorAlias(left) && !isSeniorAlias(right)) return right;
    if (isSeniorAlias(right) && !isSeniorAlias(left)) return left;
    if (!isSeniorAlias(right)) return right;
  }
  const seniorFirst = text.match(/\bsenior(?:\s+sistemas)?\s+(?:vs|versus|contra)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ._/-]{1,60})/i);
  if (seniorFirst) return normalizeCompetitorTarget(seniorFirst[1]);
  const seniorSecond = text.match(/([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ._/-]{1,60})\s+(?:vs|versus|contra)\s+senior(?:\s+sistemas)?\b/i);
  if (seniorSecond) return normalizeCompetitorTarget(seniorSecond[1]);
  const generic = text.match(/\b(?:vs|versus|contra)\b\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ._/-]{1,60})/i);
  return normalizeCompetitorTarget(generic?.[1] || '');
};

describe('extractCompetitorFromMessage', () => {
  it('does not misread TOTVS as "vs"', () => {
    const out = extractCompetitorFromMessage('compare a totvs com a senior para o contas a pagar');
    expect(out.toLowerCase()).toBe('totvs');
  });

  it('supports senior vs competitor pattern', () => {
    expect(extractCompetitorFromMessage('Senior vs SAP no financeiro')).toBe('SAP no financeiro');
  });
});

