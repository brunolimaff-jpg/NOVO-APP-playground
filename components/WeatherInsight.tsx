import React, { useEffect, useState } from 'react';
import { getWeatherForCity, type WeatherData } from '../services/weatherService';
import { maxPrecipitation, precipBarHeight } from '../utils/weatherUtils';

interface WeatherInsightProps {
  city: string;
  state?: string;
  isDarkMode: boolean;
}

const WeatherInsight: React.FC<WeatherInsightProps> = ({ city, state, isDarkMode }) => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    getWeatherForCity(city, state)
      .then(result => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
          if (!result) setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [city, state]);

  if (loading) {
    return (
      <div className={`rounded-xl border p-3 mt-3 animate-pulse ${
        isDarkMode ? 'bg-sky-950/20 border-sky-800/30' : 'bg-sky-50/50 border-sky-200/50'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">🌤️</span>
          <div className={`h-3 w-32 rounded ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
        </div>
        <div className="flex gap-3 mt-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className={`h-12 w-10 rounded ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  const { location, forecast } = data;
  const maxPrecip = maxPrecipitation(forecast);
  const locationLabel = location.admin1
    ? `${location.name}, ${location.admin1}`
    : location.name;

  const cacheAge = Math.round((Date.now() - data.fetchedAt) / 60000);

  return (
    <div
      className={`rounded-xl border mt-3 overflow-hidden transition-all duration-200 ${
        isDarkMode ? 'bg-sky-950/20 border-sky-800/30' : 'bg-sky-50/50 border-sky-200/50'
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🌤️</span>
          <span className={`text-xs font-semibold ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>
            Clima — {locationLabel}
          </span>
        </div>
        <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {expanded ? '▴' : '▾'}
        </span>
      </button>

      {/* Forecast Grid — always visible */}
      <div className="px-3 pb-3">
        {/* Desktop: 7 cols inline */}
        <div className="hidden md:grid grid-cols-7 gap-1">
          {forecast.map(day => (
            <div key={day.date} className="flex flex-col items-center gap-0.5">
              <span className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {day.dayLabel}
              </span>
              <span className="text-base">{day.emoji}</span>
              <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                {day.tempMax}°
              </span>
              <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {day.tempMin}°
              </span>
            </div>
          ))}
        </div>

        {/* Mobile: 2 cols grid */}
        <div className="grid grid-cols-2 gap-1.5 md:hidden">
          {forecast.map(day => (
            <div
              key={day.date}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                isDarkMode ? 'bg-slate-800/40' : 'bg-white/60'
              }`}
            >
              <span className="text-base">{day.emoji}</span>
              <div className="flex-1 min-w-0">
                <span className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {day.dayLabel}
                </span>
                <span className={`text-[11px] font-semibold ml-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  {day.tempMax}°/{day.tempMin}°
                </span>
              </div>
              {day.precipitation > 0 && (
                <span className={`text-[9px] ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`}>
                  {day.precipitation}mm
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Precipitation mini-chart */}
        <div className="hidden md:flex items-end gap-1 mt-2 h-6">
          {forecast.map(day => {
            const h = precipBarHeight(day.precipitation, maxPrecip);
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                {h > 0 && (
                  <div
                    className={`w-full max-w-[16px] rounded-t-sm ${isDarkMode ? 'bg-sky-500/50' : 'bg-sky-400/60'}`}
                    style={{ height: `${Math.max(h * 0.24, 2)}px` }}
                    title={`${day.precipitation}mm`}
                  />
                )}
              </div>
            );
          })}
        </div>
        {forecast.some(d => d.precipitation > 0) && (
          <p className={`hidden md:block text-[9px] mt-0.5 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            chuva (mm)
          </p>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className={`mt-3 pt-3 border-t space-y-2 ${isDarkMode ? 'border-sky-800/30' : 'border-sky-200/50'}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {forecast.slice(0, 4).map(day => (
                <div
                  key={day.date}
                  className={`rounded-lg p-2 text-center ${isDarkMode ? 'bg-slate-800/40' : 'bg-white/70'}`}
                >
                  <p className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {day.dayLabel}
                  </p>
                  <p className="text-lg">{day.emoji}</p>
                  <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {day.description}
                  </p>
                  <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`}>
                    Chuva: {day.precipitation}mm
                  </p>
                </div>
              ))}
            </div>
            <p className={`text-[9px] text-right ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Fonte: Open-Meteo · {cacheAge > 0 ? `atualizado há ${cacheAge} min` : 'atualizado agora'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherInsight;
