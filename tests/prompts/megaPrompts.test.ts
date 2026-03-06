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

  it('strengthens the operational prompt for pecuária, frota and ESG signals', () => {
    expect(PROMPT_RAIO_X_OPERACIONAL_ATAQUE).toContain('Peccode');
    expect(PROMPT_RAIO_X_OPERACIONAL_ATAQUE).toContain('Multibovinos');
    expect(PROMPT_RAIO_X_OPERACIONAL_ATAQUE).toContain('PRO Carbono');
    expect(PROMPT_RAIO_X_OPERACIONAL_ATAQUE).toContain('hidrelétrica');
    expect(PROMPT_RAIO_X_OPERACIONAL_ATAQUE).toContain('Pecuária + agrícola = FIT via parceiros');
  });

  it('includes T and LOCK markers in the tech stack prompt', () => {
    expect(PROMPT_TECH_STACK_GOD_MODE_ATAQUE).toContain(
      '[[PORTA_FEED_T:[NOTA_FINAL]:T1:[NOTA]:T2:[NOTA]:T3:[NOTA]:STACK:[ERP_IDENTIFICADO]]]',
    );
    expect(PROMPT_TECH_STACK_GOD_MODE_ATAQUE).toContain('[[PORTA_FLAG:LOCK:[SIM/NAO]]]');
  });

  it('flags Delphi and other legacy languages as strong tech debt signals', () => {
    expect(PROMPT_TECH_STACK_GOD_MODE_ATAQUE).toContain('Desenvolvedor Delphi');
    expect(PROMPT_TECH_STACK_GOD_MODE_ATAQUE).toContain('Analista Clipper');
    expect(PROMPT_TECH_STACK_GOD_MODE_ATAQUE).toContain('Visual Basic');
    expect(PROMPT_TECH_STACK_GOD_MODE_ATAQUE).toContain('FoxPro');
    expect(PROMPT_TECH_STACK_GOD_MODE_ATAQUE).toContain('⚠️ SINAL DE SISTEMA LEGADO');
  });

  it('includes R and TRAD markers in the compliance prompt', () => {
    expect(PROMPT_RISCOS_COMPLIANCE_GOD_MODE).toContain('[[PORTA_FEED_R:[NOTA]:PRESSOES:[LISTA]]]');
    expect(PROMPT_RISCOS_COMPLIANCE_GOD_MODE).toContain(
      '[[PORTA_FLAG:TRAD:[SIM/NAO]:NATUREZA:[PRODUCAO/TRADING/MISTA]]]',
    );
  });

  it('treats originação plus produção as opportunity instead of TRAD penalty', () => {
    expect(PROMPT_RISCOS_COMPLIANCE_GOD_MODE).toContain('Originação + produção própria é OPORTUNIDADE de OneClick + Commerce Log e NÃO deve ser penalizada.');
    expect(PROMPT_RISCOS_COMPLIANCE_GOD_MODE).toContain('ABNT');
    expect(PROMPT_RISCOS_COMPLIANCE_GOD_MODE).toContain('PRO Carbono');
    expect(PROMPT_RISCOS_COMPLIANCE_GOD_MODE).toContain('CONTRAPESOS DE COMPLIANCE E GOVERNANÇA');
  });

  it('includes P, segment and LOCK markers in the expansion prompt', () => {
    expect(PROMPT_RADAR_EXPANSAO_GOD_MODE).toContain(
      '[[PORTA_FEED_P:[NOTA]:HA:[HECTARES]:CNPJS:[TOTAL]:FAT:[FATURAMENTO]]]',
    );
    expect(PROMPT_RADAR_EXPANSAO_GOD_MODE).toContain('[[PORTA_SEG:[PRD/AGI/COP]]]');
    expect(PROMPT_RADAR_EXPANSAO_GOD_MODE).toContain('[[PORTA_FLAG:LOCK:[SIM/NAO]]]');
  });

  it('uses the stricter COP → AGI → PRD segment logic and diversified verticals', () => {
    expect(PROMPT_RADAR_EXPANSAO_GOD_MODE).toContain('COP → AGI → PRD');
    expect(PROMPT_RADAR_EXPANSAO_GOD_MODE).toContain('Qualquer cooperativa agrícola tem prioridade absoluta');
    expect(PROMPT_RADAR_EXPANSAO_GOD_MODE).toContain('mais de 3 verticais');
    expect(PROMPT_RADAR_EXPANSAO_GOD_MODE).toContain('produção de sementes, geração de energia, piscicultura, aviação executiva, operação imobiliária');
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
