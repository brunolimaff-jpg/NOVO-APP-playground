// utils/safraCalendar.ts
// Dados estáticos do calendário agrícola brasileiro (CONAB)
// Meses: 1=Jan, 12=Dez

export interface CropSeason {
  crop: string;
  emoji: string;
  plantingStart: number; // mês início plantio
  plantingEnd: number;   // mês fim plantio
  harvestStart: number;  // mês início colheita
  harvestEnd: number;    // mês fim colheita
}

export interface RegionCrops {
  region: string;
  states: string[];
  crops: CropSeason[];
}

// Dados baseados no calendário agrícola CONAB — simplificado por macro-região
const SAFRA_DATA: RegionCrops[] = [
  {
    region: 'Centro-Oeste',
    states: ['MT', 'MS', 'GO', 'DF'],
    crops: [
      { crop: 'Soja', emoji: '🫘', plantingStart: 9, plantingEnd: 11, harvestStart: 1, harvestEnd: 4 },
      { crop: 'Milho Safrinha', emoji: '🌽', plantingStart: 1, plantingEnd: 3, harvestStart: 6, harvestEnd: 8 },
      { crop: 'Algodão', emoji: '☁️', plantingStart: 11, plantingEnd: 1, harvestStart: 5, harvestEnd: 8 },
      { crop: 'Cana-de-açúcar', emoji: '🍬', plantingStart: 1, plantingEnd: 3, harvestStart: 4, harvestEnd: 11 },
    ],
  },
  {
    region: 'Sul',
    states: ['PR', 'SC', 'RS'],
    crops: [
      { crop: 'Soja', emoji: '🫘', plantingStart: 10, plantingEnd: 12, harvestStart: 2, harvestEnd: 5 },
      { crop: 'Milho Verão', emoji: '🌽', plantingStart: 8, plantingEnd: 10, harvestStart: 1, harvestEnd: 3 },
      { crop: 'Trigo', emoji: '🌾', plantingStart: 4, plantingEnd: 6, harvestStart: 9, harvestEnd: 11 },
      { crop: 'Arroz', emoji: '🍚', plantingStart: 9, plantingEnd: 11, harvestStart: 2, harvestEnd: 4 },
    ],
  },
  {
    region: 'Sudeste',
    states: ['SP', 'MG', 'RJ', 'ES'],
    crops: [
      { crop: 'Cana-de-açúcar', emoji: '🍬', plantingStart: 1, plantingEnd: 3, harvestStart: 4, harvestEnd: 11 },
      { crop: 'Café', emoji: '☕', plantingStart: 10, plantingEnd: 12, harvestStart: 5, harvestEnd: 9 },
      { crop: 'Soja', emoji: '🫘', plantingStart: 10, plantingEnd: 11, harvestStart: 2, harvestEnd: 4 },
      { crop: 'Milho Verão', emoji: '🌽', plantingStart: 9, plantingEnd: 11, harvestStart: 2, harvestEnd: 4 },
    ],
  },
  {
    region: 'Nordeste',
    states: ['BA', 'MA', 'PI', 'TO', 'CE', 'PE', 'PB', 'RN', 'AL', 'SE'],
    crops: [
      { crop: 'Soja', emoji: '🫘', plantingStart: 10, plantingEnd: 12, harvestStart: 2, harvestEnd: 5 },
      { crop: 'Algodão', emoji: '☁️', plantingStart: 11, plantingEnd: 1, harvestStart: 5, harvestEnd: 7 },
      { crop: 'Milho', emoji: '🌽', plantingStart: 10, plantingEnd: 12, harvestStart: 3, harvestEnd: 6 },
      { crop: 'Cacau', emoji: '🍫', plantingStart: 1, plantingEnd: 12, harvestStart: 1, harvestEnd: 12 },
    ],
  },
  {
    region: 'Norte',
    states: ['PA', 'RO', 'AM', 'AC', 'RR', 'AP'],
    crops: [
      { crop: 'Soja', emoji: '🫘', plantingStart: 10, plantingEnd: 12, harvestStart: 2, harvestEnd: 5 },
      { crop: 'Milho', emoji: '🌽', plantingStart: 11, plantingEnd: 1, harvestStart: 3, harvestEnd: 6 },
      { crop: 'Mandioca', emoji: '🥔', plantingStart: 1, plantingEnd: 12, harvestStart: 1, harvestEnd: 12 },
    ],
  },
];

export function getRegionByState(state: string): RegionCrops | null {
  const uf = state.toUpperCase().trim();
  return SAFRA_DATA.find(r => r.states.includes(uf)) || null;
}

export function getCropsForState(state: string): CropSeason[] {
  return getRegionByState(state)?.crops || [];
}

export function getRegionName(state: string): string {
  return getRegionByState(state)?.region || 'Desconhecida';
}

type CropPhase = 'plantio' | 'colheita' | 'entressafra';

function isMonthInRange(month: number, start: number, end: number): boolean {
  if (start <= end) {
    return month >= start && month <= end;
  }
  // Wraps around year (e.g., Nov-Jan = 11-1)
  return month >= start || month <= end;
}

export function getCropPhase(crop: CropSeason, month: number): CropPhase {
  if (isMonthInRange(month, crop.plantingStart, crop.plantingEnd)) return 'plantio';
  if (isMonthInRange(month, crop.harvestStart, crop.harvestEnd)) return 'colheita';
  return 'entressafra';
}

export function getCropPhaseLabel(phase: CropPhase): string {
  switch (phase) {
    case 'plantio': return 'Plantio';
    case 'colheita': return 'Colheita';
    case 'entressafra': return 'Entressafra';
  }
}

export function getCropPhaseEmoji(phase: CropPhase): string {
  switch (phase) {
    case 'plantio': return '🌱';
    case 'colheita': return '🚜';
    case 'entressafra': return '⏸️';
  }
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function getMonthLabel(month: number): string {
  return MONTH_LABELS[(month - 1) % 12] || '';
}

export interface SafraRecommendation {
  mainCrop: CropSeason;
  phase: CropPhase;
  recommendation: string;
  idealMonths: string;
}

export function getSafraRecommendation(state: string, month?: number): SafraRecommendation | null {
  const currentMonth = month || (new Date().getMonth() + 1);
  const crops = getCropsForState(state);
  if (crops.length === 0) return null;

  // Find the main crop (first one, typically soja)
  const mainCrop = crops[0];
  const phase = getCropPhase(mainCrop, currentMonth);

  let recommendation: string;
  let idealMonths: string;

  switch (phase) {
    case 'colheita':
      recommendation = `${mainCrop.crop} em colheita. Produtor ocupado no campo — priorize contato rápido ou agende para após a colheita.`;
      idealMonths = `${getMonthLabel(mainCrop.harvestEnd + 1 > 12 ? 1 : mainCrop.harvestEnd + 1)}-${getMonthLabel(mainCrop.plantingStart - 1 < 1 ? 12 : mainCrop.plantingStart - 1)}`;
      break;
    case 'plantio':
      recommendation = `${mainCrop.crop} em plantio. Momento crítico — evite visitas longas. Janela ideal de abordagem será na entressafra.`;
      idealMonths = `${getMonthLabel(mainCrop.plantingEnd + 1 > 12 ? 1 : mainCrop.plantingEnd + 1)}-${getMonthLabel(mainCrop.harvestStart - 1 < 1 ? 12 : mainCrop.harvestStart - 1)}`;
      break;
    case 'entressafra':
      recommendation = `Entressafra de ${mainCrop.crop}. Janela ideal para abordagem comercial — produtor com mais disponibilidade.`;
      idealMonths = `Agora (${getMonthLabel(currentMonth)})`;
      break;
  }

  return { mainCrop, phase, recommendation, idealMonths };
}

export function formatSafraForPrompt(state: string): string {
  const region = getRegionByState(state);
  if (!region) return '';

  const currentMonth = new Date().getMonth() + 1;
  const lines = region.crops.map(crop => {
    const phase = getCropPhase(crop, currentMonth);
    return `- ${crop.crop}: ${getCropPhaseLabel(phase)} (plantio ${getMonthLabel(crop.plantingStart)}-${getMonthLabel(crop.plantingEnd)}, colheita ${getMonthLabel(crop.harvestStart)}-${getMonthLabel(crop.harvestEnd)})`;
  });

  const rec = getSafraRecommendation(state, currentMonth);

  return `CALENDÁRIO SAFRA (${region.region} — ${state}):
${lines.join('\n')}
${rec ? `\n💡 TIMING: ${rec.recommendation}\nJanela ideal: ${rec.idealMonths}` : ''}`;
}
