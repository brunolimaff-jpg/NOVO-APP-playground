import { describe, it, expect } from 'vitest';
import { parseMarkers } from '../../services/geminiService';

describe('parseMarkers — PORTA v2', () => {
  it('parses v1 markers with backward compatibility', () => {
    const result = parseMarkers('Some text [[PORTA:84:P8:O10:R7:T8:A8]] more text');
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(84);
    expect(result.scorePorta!.p).toBe(8);
    expect(result.scorePorta!.o).toBe(10);
    expect(result.scorePorta!.r).toBe(7);
    expect(result.scorePorta!.t).toBe(8);
    expect(result.scorePorta!.a).toBe(8);
    expect(result.scorePorta!.segmento).toBe('PRD');
    expect(result.scorePorta!.flags).toEqual([]);
    expect(result.text).not.toContain('[[PORTA');
  });

  it('parses v2 markers with segment and NONE flags', () => {
    const result = parseMarkers('Text [[PORTA:84:P8:O10:R7:T8:A8:AGI:NONE]] end');
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(84);
    expect(result.scorePorta!.segmento).toBe('AGI');
    expect(result.scorePorta!.flags).toEqual([]);
    expect(result.scorePorta!.scoreBruto).toBeDefined();
  });

  it('parses v2 markers with single flag', () => {
    const result = parseMarkers('[[PORTA:51:P7:O8:R6:T7:A7:PRD:TRAD]]');
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(51);
    expect(result.scorePorta!.segmento).toBe('PRD');
    expect(result.scorePorta!.flags).toEqual(['TRAD']);
  });

  it('parses v2 markers with multiple flags', () => {
    const result = parseMarkers('[[PORTA:21:P6:O7:R5:T5:A6:PRD:TRAD,LOCK]]');
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(21);
    expect(result.scorePorta!.flags).toEqual(['TRAD', 'LOCK']);
  });

  it('parses v2 markers with NOFIT flag', () => {
    const result = parseMarkers('[[PORTA:15:P4:O3:R2:T3:A4:PRD:NOFIT]]');
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.score).toBe(15);
    expect(result.scorePorta!.flags).toEqual(['NOFIT']);
  });

  it('parses COP segment', () => {
    const result = parseMarkers('[[PORTA:70:P6:O5:R8:T7:A7:COP:NONE]]');
    expect(result.scorePorta).not.toBeNull();
    expect(result.scorePorta!.segmento).toBe('COP');
  });

  it('calculates scoreBruto correctly for PRD', () => {
    const result = parseMarkers('[[PORTA:68:P5:O4:R3:T9:A9:PRD:NONE]]');
    expect(result.scorePorta).not.toBeNull();
    // PRD weights: p=0.10, o=0.25, r=0.10, t=0.30, a=0.25
    // (5*0.10 + 4*0.25 + 3*0.10 + 9*0.30 + 9*0.25) * 10 = (0.5+1.0+0.3+2.7+2.25)*10 = 67.5 → 68
    expect(result.scorePorta!.scoreBruto).toBe(68);
  });

  it('calculates scoreBruto correctly for AGI', () => {
    const result = parseMarkers('[[PORTA:84:P8:O10:R7:T8:A8:AGI:NONE]]');
    expect(result.scorePorta).not.toBeNull();
    // AGI weights: p=0.15, o=0.30, r=0.20, t=0.20, a=0.15
    // (8*0.15 + 10*0.30 + 7*0.20 + 8*0.20 + 8*0.15) * 10 = (1.2+3.0+1.4+1.6+1.2)*10 = 84
    expect(result.scorePorta!.scoreBruto).toBe(84);
  });

  it('strips PORTA marker from text', () => {
    const result = parseMarkers('Before [[PORTA:84:P8:O10:R7:T8:A8:AGI:NONE]] After');
    expect(result.text).not.toContain('[[PORTA');
    expect(result.text).toContain('Before');
    expect(result.text).toContain('After');
  });

  it('returns null scorePorta when no marker present', () => {
    const result = parseMarkers('Just regular text without any markers');
    expect(result.scorePorta).toBeNull();
  });
});
