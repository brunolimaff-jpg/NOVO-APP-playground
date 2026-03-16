import React, { useEffect, useState } from 'react';
import { fetchMarketPulse, type MarketPulseData, type MarketIndicator } from '../services/marketPulseService';

interface MarketPulseProps {
  isDarkMode: boolean;
}

const MarketPulseCard: React.FC<{ indicator: MarketIndicator; isDarkMode: boolean }> = ({ indicator, isDarkMode }) => {
  const isUp = indicator.variation > 0;
  const isDown = indicator.variation < 0;
  const isFlat = indicator.variation === 0;
  const unavailable = indicator.value === '--';

  const variationColor = isUp
    ? 'text-emerald-500'
    : isDown
      ? 'text-red-500'
      : isDarkMode ? 'text-slate-500' : 'text-slate-400';

  const variationIcon = isUp ? '▲' : isDown ? '▼' : '=';

  return (
    <div
      className={`rounded-xl p-3 flex flex-col items-center justify-center gap-0.5 transition-colors ${
        isDarkMode ? 'bg-slate-800/50 border border-slate-700/40' : 'bg-white border border-slate-200/80'
      } ${unavailable ? 'opacity-50' : ''}`}
    >
      <span className="text-lg">{indicator.emoji}</span>
      <span className={`text-[10px] font-medium uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {indicator.label}
      </span>
      <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
        {indicator.value}
      </span>
      {!isFlat && !unavailable ? (
        <span className={`text-[10px] font-medium ${variationColor}`}>
          {variationIcon} {Math.abs(indicator.variation).toFixed(1)}%
        </span>
      ) : (
        <span className={`text-[10px] ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>—</span>
      )}
    </div>
  );
};

const MarketPulse: React.FC<MarketPulseProps> = ({ isDarkMode }) => {
  const [data, setData] = useState<MarketPulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = (force: boolean = false) => {
    setLoading(true);
    setError(false);
    fetchMarketPulse(force)
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const lastUpdate = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="mt-6">
      {/* Section divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
        <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          📊 Pulso do Mercado
        </span>
        <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`rounded-xl p-3 h-20 animate-pulse ${
                isDarkMode ? 'bg-slate-800/50' : 'bg-slate-100'
              }`}
            />
          ))}
        </div>
      ) : error ? (
        <div className={`text-center py-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Dados de mercado indisponíveis no momento.
          </p>
          <button
            onClick={() => loadData(true)}
            className="mt-2 text-[11px] text-emerald-500 hover:text-emerald-400 font-medium"
          >
            Tentar novamente
          </button>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {data.indicators.map(ind => (
              <MarketPulseCard key={ind.id} indicator={ind} isDarkMode={isDarkMode} />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end mt-2 gap-2">
            <button
              onClick={() => loadData(true)}
              className={`text-[10px] hover:underline ${isDarkMode ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
              title="Atualizar indicadores"
            >
              🔄
            </button>
            {lastUpdate && (
              <span className={`text-[10px] ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                Atualiz. {lastUpdate}
              </span>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default MarketPulse;
