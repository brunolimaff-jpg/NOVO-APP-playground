import { describe, it, expect } from 'vitest';
import { parseMarkers } from '../../services/geminiService';

describe('parseMarkers — PORTA v2', () => {
  it('parses v2 marker with AGI segment and no flags', () => {
    const content = 'Some text [[PORTA:84:P8:O10:R7:T8:A8:AGI:NONE]] more text';
    const result = parseMarkers(content);
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(84);
    expect(result.scorePorta!.p).toBe(8);
    expect(result.scorePorta!.o).toBe(10);
    expect(result.scorePorta!.r).toBe(7);
    expect(result.scorePorta!.t).toBe(8);
    expect(result.scorePorta!.a).toBe(8);
    expect(result.scorePorta!.segmento).toBe('AGI');
    expect(result.scorePorta!.flags).toEqual([]);
    expect(result.scorePorta!.scoreBruto).toBeDefined();
    expect(result.text).not.toContain('[[PORTA');
  });

  it('parses v2 marker with PRD segment and TRAD flag', () => {
    const content = '[[PORTA:51:P7:O8:R6:T7:A7:PRD:TRAD]]';
    const result = parseMarkers(content);
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(51);
    expect(result.scorePorta!.segmento).toBe('PRD');
    expect(result.scorePorta!.flags).toEqual(['TRAD']);
  });

  it('parses v2 marker with multiple flags', () => {
    const content = '[[PORTA:21:P6:O7:R5:T5:A6:PRD:TRAD,LOCK]]';
    const result = parseMarkers(content);
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(21);
    expect(result.scorePorta!.flags).toEqual(['TRAD', 'LOCK']);
  });

  it('parses v2 marker with COP segment and NOFIT flag', () => {
    const content = '[[PORTA:18:P5:O4:R6:T5:A5:COP:NOFIT]]';
    const result = parseMarkers(content);
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.segmento).toBe('COP');
    expect(result.scorePorta!.flags).toEqual(['NOFIT']);
  });

  it('parses v2 marker with all three flags', () => {
    const content = '[[PORTA:9:P6:O7:R5:T5:A6:PRD:TRAD,LOCK,NOFIT]]';
    const result = parseMarkers(content);
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.flags).toEqual(['TRAD', 'LOCK', 'NOFIT']);
  });

  it('calculates scoreBruto for PRD segment', () => {
    const content = '[[PORTA:68:P5:O4:R3:T9:A9:PRD:NONE]]';
    const result = parseMarkers(content);
    expect(result.scorePorta).not.toBeNull();
    // PRD weights: p=0.10, o=0.25, r=0.10, t=0.30, a=0.25
    // (5*0.10 + 4*0.25 + 3*0.10 + 9*0.30 + 9*0.25) * 10
    // = (0.5 + 1.0 + 0.3 + 2.7 + 2.25) * 10 = 67.5 → 68
    expect(result.scorePorta!.scoreBruto).toBe(68);
  });

  it('falls back to v1 parsing for legacy markers', () => {
    const content = '[[PORTA:75:P8:O7:R8:T7:A7]]';
    const result = parseMarkers(content);
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(75);
    expect(result.scorePorta!.p).toBe(8);
    expect(result.scorePorta!.segmento).toBe('PRD');
    expect(result.scorePorta!.flags).toEqual([]);
    expect(result.scorePorta!.scoreBruto).toBeUndefined();
  });

  it('returns null when no PORTA marker exists', () => {
    const content = 'Just some regular text without markers';
    const result = parseMarkers(content);
    expect(result.scorePorta).toBeNull();
  });

  it('strips v2 marker from text output', () => {
    const content = 'Before [[PORTA:84:P8:O10:R7:T8:A8:AGI:NONE]] After';
    const result = parseMarkers(content);
    expect(result.text).not.toContain('PORTA');
    expect(result.text).toContain('Before');
    expect(result.text).toContain('After');
  });
});
