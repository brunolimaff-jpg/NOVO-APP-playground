import React, { useState } from 'react';
import { type RegulatoryItem } from '../services/sectorAnalysisService';

interface RegulatoryRadarProps {
  items: RegulatoryItem[];
  isDarkMode: boolean;
  compact?: boolean;
}

const levelConfig = {
  urgent: {
    emoji: '🔴',
    label: 'URGENTE',
    bgLight: 'bg-red-50 border-red-200/60',
    bgDark: 'bg-red-950/30 border-red-800/40',
    textLight: 'text-red-700',
    textDark: 'text-red-400',
  },
  attention: {
    emoji: '🟡',
    label: 'ATENÇÃO',
    bgLight: 'bg-amber-50 border-amber-200/60',
    bgDark: 'bg-amber-950/30 border-amber-800/40',
    textLight: 'text-amber-700',
    textDark: 'text-amber-400',
  },
  info: {
    emoji: '🟢',
    label: 'INFORMATIVO',
    bgLight: 'bg-slate-50 border-slate-200',
    bgDark: 'bg-slate-800/30 border-slate-700/40',
    textLight: 'text-slate-600',
    textDark: 'text-slate-400',
  },
};

const RegulatoryRadar: React.FC<RegulatoryRadarProps> = ({ items, isDarkMode, compact = false }) => {
  const [expanded, setExpanded] = useState(false);
  const dk = isDarkMode;

  if (items.length === 0) return null;

  const urgentCount = items.filter(i => i.level === 'urgent').length;
  const attentionCount = items.filter(i => i.level === 'attention').length;

  // Compact version for CRM Detail
  if (compact) {
    return (
      <div className={`rounded-xl border p-3 ${dk ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚖️</span>
            <span className={`text-xs font-semibold uppercase tracking-wide ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
              Compliance
            </span>
          </div>
          {urgentCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 font-semibold">
              🔴 {urgentCount} urgente{urgentCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="mt-1.5 space-y-0.5">
          {items.slice(0, 2).map((item) => (
            <p key={item.name} className={`text-[11px] ${dk ? 'text-slate-300' : 'text-slate-700'}`}>
              {levelConfig[item.level].emoji} {item.name}
            </p>
          ))}
          {items.length > 2 && (
            <p className={`text-[10px] ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
              +{items.length - 2} obrigações
            </p>
          )}
        </div>
        {urgentCount > 0 && (
          <p className={`mt-1 text-[10px] ${dk ? 'text-amber-400/70' : 'text-amber-600'}`}>
            💡 Use como gatilho de urgência na reunião
          </p>
        )}
      </div>
    );
  }

  // Full version for SectorAnalysis drawer
  const sorted = [...items].sort((a, b) => {
    const order = { urgent: 0, attention: 1, info: 2 };
    return order[a.level] - order[b.level];
  });

  const displayItems = expanded ? sorted : sorted.slice(0, 3);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
          ⚖️ Radar Regulatório
        </span>
        <div className="flex gap-1">
          {urgentCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 font-semibold">
              {urgentCount} 🔴
            </span>
          )}
          {attentionCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
              {attentionCount} 🟡
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {displayItems.map((item, i) => {
          const cfg = levelConfig[item.level];
          return (
            <div
              key={i}
              className={`rounded-lg border p-2.5 ${dk ? cfg.bgDark : cfg.bgLight}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold ${dk ? cfg.textDark : cfg.textLight}`}>
                    {cfg.emoji} {item.name}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${dk ? 'text-slate-400' : 'text-slate-600'}`}>
                    {item.description}
                  </p>
                </div>
              </div>
              <p className={`text-[10px] mt-1 ${dk ? 'text-indigo-400/70' : 'text-indigo-600'}`}>
                🎯 {item.seniorModule}
              </p>
            </div>
          );
        })}
      </div>

      {items.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className={`text-[10px] font-medium ${dk ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
        >
          {expanded ? '▴ Mostrar menos' : `▾ Ver todas (${items.length})`}
        </button>
      )}

      <p className={`text-[10px] leading-relaxed ${dk ? 'text-amber-400/70' : 'text-amber-600'}`}>
        💡 Obrigações {urgentCount > 0 ? '🔴 urgentes' : 'regulatórias'} são gatilhos poderosos de venda — compliance não é opcional.
      </p>
    </div>
  );
};

export default RegulatoryRadar;
