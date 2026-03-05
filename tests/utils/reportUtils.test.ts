import { describe, it, expect } from 'vitest';
import { detectInconsistencies, generateExecutiveSummary, normalizeMermaidBlocks } from '../../utils/reportUtils';

describe('detectInconsistencies', () => {
  it('returns empty string for single section', () => {
    expect(detectInconsistencies(['Some text'])).toBe('');
  });

  it('returns empty string when no inconsistencies found', () => {
    const sections = [
      'Faturamento: R$ 500 milhões, 1000 hectares',
      'Faturamento: R$ 500 milhões, 1000 hectares',
    ];
    expect(detectInconsistencies(sections)).toBe('');
  });

  it('detects faturamento inconsistency', () => {
    const sections = [
      'Faturamento: R$ 500 milhões',
      'Faturamento: R$ 800 milhões',
    ];
    const result = detectInconsistencies(sections);
    expect(result).toContain('INCONSISTÊNCIAS DETECTADAS');
    expect(result).toContain('Faturamento');
    expect(result).toContain('precisa validar');
  });

  it('detects employee count inconsistency', () => {
    const sections = [
      '1500 funcionários na empresa',
      '2000 funcionários na empresa',
    ];
    const result = detectInconsistencies(sections);
    expect(result).toContain('Funcionários');
  });

  it('returns empty for less than 2 sections', () => {
    expect(detectInconsistencies([])).toBe('');
    expect(detectInconsistencies(['one'])).toBe('');
  });
});

describe('report export helpers', () => {
  it('normalizes JSON mermaid payload to fenced block', () => {
    const input = 'Antes {"mermaid":"graph TD\\nA-->B"} Depois';
    const result = normalizeMermaidBlocks(input);
    expect(result).toContain('```mermaid');
    expect(result).toContain('graph TD');
  });

  it('builds executive summary with validation warning when inconsistencies exist', () => {
    const fullText = '# Empresa X\n\nA empresa opera no agro.\n\n```mermaid\ngraph TD\nA-->B\n```';
    const sections = [fullText, 'Área total: 40 mil ha'];
    const inconsistency = '## ⚠️ INCONSISTÊNCIAS DETECTADAS\n\n1. **Área/Hectares:** ... precisa validar ...';
    const summary = generateExecutiveSummary(fullText, sections, inconsistency);
    expect(summary).toContain('RESUMO EXECUTIVO');
    expect(summary).toContain('Validação obrigatória');
    expect(summary).toContain('precisa validar');
    expect(summary).toContain('Diagramas mermaid');
  });
});
