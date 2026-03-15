// services/weatherService.ts
// Fetch Open-Meteo API — gratuita, sem chave

import { parseForecastResponse, type DayForecast } from '../utils/weatherUtils';

export interface GeoLocation {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // estado
}

export interface WeatherData {
  location: GeoLocation;
  forecast: DayForecast[];
  fetchedAt: number;
}

const CACHE_KEY_PREFIX = 'scout360_weather_';
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function getCacheKey(city: string, state: string): string {
  return CACHE_KEY_PREFIX + `${city}_${state}`.toLowerCase().replace(/\s+/g, '_');
}

function getFromCache(city: string, state: string): WeatherData | null {
  try {
    const raw = localStorage.getItem(getCacheKey(city, state));
    if (!raw) return null;
    const data: WeatherData = JSON.parse(raw);
    if (Date.now() - data.fetchedAt > CACHE_TTL) {
      localStorage.removeItem(getCacheKey(city, state));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveToCache(city: string, state: string, data: WeatherData): void {
  try {
    localStorage.setItem(getCacheKey(city, state), JSON.stringify(data));
  } catch {
    // silently fail
  }
}

export async function geocodeCity(city: string, country: string = 'BR'): Promise<GeoLocation | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=3&language=pt&country=${country}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.results || data.results.length === 0) return null;
  const r = data.results[0];
  return {
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country || country,
    admin1: r.admin1,
  };
}

export async function fetchWeather(latitude: number, longitude: number): Promise<DayForecast[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=America/Sao_Paulo&forecast_days=7`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Open-Meteo error: ${resp.status}`);
  const data = await resp.json();
  return parseForecastResponse(data);
}

export async function getWeatherForCity(city: string, state: string = ''): Promise<WeatherData | null> {
  const cached = getFromCache(city, state);
  if (cached) return cached;

  const searchTerm = state ? `${city} ${state}` : city;
  const geo = await geocodeCity(searchTerm);
  if (!geo) return null;

  const forecast = await fetchWeather(geo.latitude, geo.longitude);
  const result: WeatherData = {
    location: geo,
    forecast,
    fetchedAt: Date.now(),
  };

  saveToCache(city, state, result);
  return result;
}
