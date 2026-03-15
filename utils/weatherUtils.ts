// utils/weatherUtils.ts
// Mapeia códigos WMO (Open-Meteo) para emoji e descrição em pt-BR

export interface DayForecast {
  date: string; // ISO date
  dayLabel: string; // "Seg", "Ter", etc.
  tempMax: number;
  tempMin: number;
  precipitation: number; // mm
  weatherCode: number;
  emoji: string;
  description: string;
}

const WMO_MAP: Record<number, { emoji: string; description: string }> = {
  0: { emoji: '☀️', description: 'Céu limpo' },
  1: { emoji: '🌤️', description: 'Parcialmente limpo' },
  2: { emoji: '⛅', description: 'Parcialmente nublado' },
  3: { emoji: '☁️', description: 'Nublado' },
  45: { emoji: '🌫️', description: 'Neblina' },
  48: { emoji: '🌫️', description: 'Neblina com geada' },
  51: { emoji: '🌦️', description: 'Garoa leve' },
  53: { emoji: '🌦️', description: 'Garoa moderada' },
  55: { emoji: '🌧️', description: 'Garoa intensa' },
  61: { emoji: '🌧️', description: 'Chuva leve' },
  63: { emoji: '🌧️', description: 'Chuva moderada' },
  65: { emoji: '🌧️', description: 'Chuva forte' },
  66: { emoji: '🌨️', description: 'Chuva congelante leve' },
  67: { emoji: '🌨️', description: 'Chuva congelante forte' },
  71: { emoji: '❄️', description: 'Neve leve' },
  73: { emoji: '❄️', description: 'Neve moderada' },
  75: { emoji: '❄️', description: 'Neve forte' },
  77: { emoji: '❄️', description: 'Granizo' },
  80: { emoji: '🌦️', description: 'Pancadas leves' },
  81: { emoji: '🌧️', description: 'Pancadas moderadas' },
  82: { emoji: '⛈️', description: 'Pancadas fortes' },
  85: { emoji: '🌨️', description: 'Neve com pancadas leve' },
  86: { emoji: '🌨️', description: 'Neve com pancadas forte' },
  95: { emoji: '⛈️', description: 'Trovoada' },
  96: { emoji: '⛈️', description: 'Trovoada com granizo leve' },
  99: { emoji: '⛈️', description: 'Trovoada com granizo forte' },
};

export function wmoToEmoji(code: number): { emoji: string; description: string } {
  return WMO_MAP[code] || { emoji: '🌤️', description: 'Tempo indefinido' };
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  return DAY_LABELS[d.getDay()];
}

export function parseForecastResponse(data: {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weather_code: number[];
  };
}): DayForecast[] {
  const { time, temperature_2m_max, temperature_2m_min, precipitation_sum, weather_code } = data.daily;
  return time.map((date, i) => {
    const wmo = wmoToEmoji(weather_code[i]);
    return {
      date,
      dayLabel: formatDayLabel(date),
      tempMax: Math.round(temperature_2m_max[i]),
      tempMin: Math.round(temperature_2m_min[i]),
      precipitation: Math.round(precipitation_sum[i] * 10) / 10,
      weatherCode: weather_code[i],
      emoji: wmo.emoji,
      description: wmo.description,
    };
  });
}

export function maxPrecipitation(days: DayForecast[]): number {
  return Math.max(...days.map(d => d.precipitation), 1);
}

export function precipBarHeight(precip: number, maxPrecip: number): number {
  if (maxPrecip === 0) return 0;
  return Math.round((precip / maxPrecip) * 100);
}
