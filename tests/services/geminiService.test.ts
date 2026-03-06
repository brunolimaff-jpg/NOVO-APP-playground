import { describe, it, expect } from 'vitest';
import { parseMarkers } from '../../services/geminiService';

describe('parseMarkers — PORTA v2', () => {
  it('parses v2 marker with no flags', () => {
    const input = 'Some text [[PORTA:84:P8:O10:R7:T8:A8:AGI:NONE]] more text';
    const result = parseMarkers(input);
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
  });

  it('parses v2 marker with single flag TRAD', () => {
    const input = '[[PORTA:51:P7:O8:R6:T7:A7:PRD:TRAD]]';
    const result = parseMarkers(input);
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(51);
    expect(result.scorePorta!.segmento).toBe('PRD');
    expect(result.scorePorta!.flags).toEqual(['TRAD']);
  });

  it('parses v2 marker with single flag LOCK', () => {
    const input = '[[PORTA:45:P9:O9:R8:T6:A5:AGI:LOCK]]';
    const result = parseMarkers(input);
    expect(result.scorePorta!.score).toBe(45);
    expect(result.scorePorta!.segmento).toBe('AGI');
    expect(result.scorePorta!.flags).toEqual(['LOCK']);
  });

  it('parses v2 marker with multiple flags', () => {
    const input = '[[PORTA:21:P6:O7:R5:T5:A6:PRD:TRAD,LOCK]]';
    const result = parseMarkers(input);
    expect(result.scorePorta!.score).toBe(21);
    expect(result.scorePorta!.segmento).toBe('PRD');
    expect(result.scorePorta!.flags).toEqual(['TRAD', 'LOCK']);
  });

  it('parses v2 marker with NOFIT flag', () => {
    const input = '[[PORTA:15:P4:O3:R2:T3:A4:PRD:NOFIT]]';
    const result = parseMarkers(input);
    expect(result.scorePorta!.flags).toEqual(['NOFIT']);
  });

  it('parses v2 marker with COP segment', () => {
    const input = '[[PORTA:67:P5:O4:R3:T9:A9:COP:NONE]]';
    const result = parseMarkers(input);
    expect(result.scorePorta!.segmento).toBe('COP');
    expect(result.scorePorta!.flags).toEqual([]);
  });

  it('calculates scoreBruto correctly for PRD', () => {
    const input = '[[PORTA:68:P5:O4:R3:T9:A9:PRD:NONE]]';
    const result = parseMarkers(input);
    // PRD: p=0.10, o=0.25, r=0.10, t=0.30, a=0.25
    // (5*0.10 + 4*0.25 + 3*0.10 + 9*0.30 + 9*0.25) * 10
    // = (0.5 + 1.0 + 0.3 + 2.7 + 2.25) * 10 = 67.5 → 68
    expect(result.scorePorta!.scoreBruto).toBe(68);
  });

  it('falls back to v1 marker format', () => {
    const input = '[[PORTA:84:P8:O10:R7:T8:A8]]';
    const result = parseMarkers(input);
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(84);
    expect(result.scorePorta!.p).toBe(8);
    expect(result.scorePorta!.o).toBe(10);
    expect(result.scorePorta!.segmento).toBe('PRD');
    expect(result.scorePorta!.flags).toEqual([]);
  });

  it('removes PORTA marker from text output', () => {
    const input = 'Hello [[PORTA:84:P8:O10:R7:T8:A8:AGI:NONE]] world';
    const result = parseMarkers(input);
    expect(result.text).not.toContain('[[PORTA:');
    expect(result.text).toContain('Hello');
    expect(result.text).toContain('world');
  });

  it('removes v1 PORTA marker from text output', () => {
    const input = 'Hello [[PORTA:62:P5:O7:R6:T5:A6]] world';
    const result = parseMarkers(input);
    expect(result.text).not.toContain('[[PORTA:');
  });

  it('returns null scorePorta when no marker present', () => {
    const input = 'No score here';
    const result = parseMarkers(input);
    expect(result.scorePorta).toBeNull();
  });

  it('parses STATUS markers alongside PORTA v2', () => {
    const input = '[[STATUS:Buscando dados...]] Text [[PORTA:75:P7:O8:R6:T7:A8:AGI:NONE]]';
    const result = parseMarkers(input);
    expect(result.statuses).toEqual(['Buscando dados...']);
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(75);
  });
});
