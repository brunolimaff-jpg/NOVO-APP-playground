import { describe, expect, it } from 'vitest';
import {
  PROMPT_MAPEAMENTO_DECISORES_GOD_MODE,
  PROMPT_RADAR_EXPANSAO_GOD_MODE,
  PROMPT_RAIO_X_OPERACIONAL_ATAQUE,
  PROMPT_RH_SINDICATOS_GOD_MODE,
  PROMPT_RISCOS_COMPLIANCE_GOD_MODE,
  PROMPT_TECH_STACK_GOD_MODE_ATAQUE,
} from '../../prompts/megaPrompts';

describe('PORTA v2 mega prompts', () => {
  it('includes anti-repetition deep dive scope block in all prompts', () => {
    const requiredSentence = '⚠️ REGRA DE ESCOPO (CRÍTICA — NUNCA VIOLE):';
    expect(PROMPT_RAIO_X_OPERACIONAL_ATAQUE).toContain(requiredSentence);
    expect(PROMPT_TECH_STACK_GOD_MODE_ATAQUE).toContain(requiredSentence);
    expect(PROMPT_RISCOS_COMPLIANCE_GOD_MODE).toContain(requiredSentence);
    expect(PROMPT_RADAR_EXPANSAO_GOD_MODE).toContain(requiredSentence);
    expect(PROMPT_RH_SINDICATOS_GOD_MODE).toContain(requiredSentence);
    expect(PROMPT_MAPEAMENTO_DECISORES_GOD_MODE).toContain(requiredSentence);
  });

  it('includes feed markers in the operational prompt', () => {
    expect(PROMPT_RAIO_X_OPERACIONAL_ATAQUE).toContain('[[PORTA_FEED_O:[NOTA]:ELOS:[LISTA_ELOS]]]');
    expect(PROMPT_RAIO_X_OPERACIONAL_ATAQUE).toContain('[[PORTA_FLAG:NOFIT:[SIM/NAO]]]');
  });

  it('includes T and LOCK markers in the tech stack prompt', () => {
    expect(PROMPT_TECH_STACK_GOD_MODE_ATAQUE).toContain(
      '[[PORTA_FEED_T:[NOTA_FINAL]:T1:[NOTA]:T2:[NOTA]:T3:[NOTA]:STACK:[ERP_IDENTIFICADO]]]',
    );
    expect(PROMPT_TECH_STACK_GOD_MODE_ATAQUE).toContain('[[PORTA_FLAG:LOCK:[SIM/NAO]]]');
  });

  it('includes R and TRAD markers in the compliance prompt', () => {
    expect(PROMPT_RISCOS_COMPLIANCE_GOD_MODE).toContain('[[PORTA_FEED_R:[NOTA]:PRESSOES:[LISTA]]]');
    expect(PROMPT_RISCOS_COMPLIANCE_GOD_MODE).toContain(
      '[[PORTA_FLAG:TRAD:[SIM/NAO]:NATUREZA:[PRODUCAO/TRADING/MISTA]]]',
    );
  });

  it('includes P, segment and LOCK markers in the expansion prompt', () => {
    expect(PROMPT_RADAR_EXPANSAO_GOD_MODE).toContain(
      '[[PORTA_FEED_P:[NOTA]:HA:[HECTARES]:CNPJS:[TOTAL]:FAT:[FATURAMENTO]]]',
    );
    expect(PROMPT_RADAR_EXPANSAO_GOD_MODE).toContain('[[PORTA_SEG:[PRD/AGI/COP]]]');
    expect(PROMPT_RADAR_EXPANSAO_GOD_MODE).toContain('[[PORTA_FLAG:LOCK:[SIM/NAO]]]');
  });

  it('includes P proxy, R trabalhista and A2 markers in the RH prompt', () => {
    expect(PROMPT_RH_SINDICATOS_GOD_MODE).toContain('[[PORTA_FEED_P_PROXY:FUNC:[TOTAL_FUNCIONARIOS]]]');
    expect(PROMPT_RH_SINDICATOS_GOD_MODE).toContain('[[PORTA_FEED_R_TRAB:[NOTA]:PASSIVOS:[LISTA]]]');
    expect(PROMPT_RH_SINDICATOS_GOD_MODE).toContain(
      '[[PORTA_FEED_A2:[NOTA]:TIMING:[BOM/NEUTRO/RUIM]:FASE:[FASE_ATUAL]]]',
    );
  });

  it('includes A and LOCK markers in the decisor prompt', () => {
    expect(PROMPT_MAPEAMENTO_DECISORES_GOD_MODE).toContain(
      '[[PORTA_FEED_A:[NOTA_FINAL]:A1:[NOTA]:A2:[NOTA]:GERACAO:[G1/G2/PROF]]]',
    );
    expect(PROMPT_MAPEAMENTO_DECISORES_GOD_MODE).toContain('[[PORTA_FLAG:LOCK:[SIM/NAO]]]');
  });
});
