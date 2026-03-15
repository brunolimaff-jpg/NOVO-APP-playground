import React, { useEffect, useState } from 'react';
import {
  fetchNewsForCompany,
  getSentimentEmoji,
  getSentimentLabel,
  formatRelativeTime,
  type NewsRadarData,
  type NewsItem,
} from '../services/newsRadarService';

interface NewsRadarProps {
  companyName: string;
  isDarkMode: boolean;
}

const NewsItemCard: React.FC<{ item: NewsItem; isDarkMode: boolean }> = ({ item, isDarkMode }) => {
  const sentimentBg = item.sentiment === 'positive'
    ? isDarkMode ? 'border-emerald-800/40' : 'border-emerald-200/60'
    : item.sentiment === 'negative'
      ? isDarkMode ? 'border-red-800/40' : 'border-red-200/60'
      : isDarkMode ? 'border-slate-700/40' : 'border-slate-200/60';

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${sentimentBg} ${
        isDarkMode ? 'bg-slate-800/30' : 'bg-white/80'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm">{getSentimentEmoji(item.sentiment)}</span>
        <span className={`text-[10px] font-medium ${
          item.sentiment === 'positive'
            ? 'text-emerald-500'
            : item.sentiment === 'negative'
              ? 'text-red-500'
              : isDarkMode ? 'text-slate-400' : 'text-slate-500'
        }`}>
          {getSentimentLabel(item.sentiment)}
        </span>
        <span className={`text-[10px] ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          · {formatRelativeTime(item.date)}
        </span>
      </div>

      {/* Title */}
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs font-semibold hover:underline block mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}
        >
          {item.title}
        </a>
      ) : (
        <p className={`text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
          {item.title}
        </p>
      )}

      {/* Source */}
      <p className={`text-[10px] mb-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        Fonte: {item.source}
      </p>

      {/* Summary */}
      <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
        {item.summary}
      </p>

      {/* Commercial insight */}
      {item.commercialInsight && (
        <div className={`mt-2 pt-2 border-t ${isDarkMode ? 'border-slate-700/30' : 'border-slate-200/50'}`}>
          <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-amber-400/80' : 'text-amber-600'}`}>
            💡 {item.commercialInsight}
          </p>
        </div>
      )}
    </div>
  );
};

const NewsRadar: React.FC<NewsRadarProps> = ({ companyName, isDarkMode }) => {
  const [data, setData] = useState<NewsRadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadNews = (force: boolean = false) => {
    setLoading(true);
    setError(false);
    fetchNewsForCompany(companyName, force)
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
    if (companyName) loadNews();
  }, [companyName]);

  const lastUpdate = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`rounded-xl border p-4 ${isDarkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          📰 Radar de Notícias
        </h3>
        <button
          onClick={() => loadNews(true)}
          disabled={loading}
          className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-colors ${
            loading
              ? isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400'
              : 'text-emerald-500 hover:bg-emerald-500/10'
          }`}
        >
          {loading ? 'Buscando...' : '🔄 Atualizar'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className={`rounded-xl p-3 h-24 animate-pulse ${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-100'}`}
            />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Não foi possível buscar notícias no momento.
          </p>
          <button
            onClick={() => loadNews(true)}
            className="mt-2 text-[11px] text-emerald-500 hover:text-emerald-400 font-medium"
          >
            Tentar novamente
          </button>
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="space-y-2">
          {data.items.map((item, i) => (
            <NewsItemCard key={`${item.title}-${i}`} item={item} isDarkMode={isDarkMode} />
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhuma notícia recente encontrada. Isso é bom!
          </p>
        </div>
      )}

      {/* Footer */}
      {lastUpdate && !loading && (
        <p className={`text-[9px] text-right mt-2 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          Última busca: {lastUpdate}
        </p>
      )}
    </div>
  );
};

export default NewsRadar;
