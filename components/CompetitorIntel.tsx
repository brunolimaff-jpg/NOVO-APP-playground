import React from 'react';
import { type CompetitorInfo } from '../services/sectorAnalysisService';

interface CompetitorIntelProps {
  items: CompetitorInfo[];
  salesArgument: string;
  isDarkMode: boolean;
}

const sizeConfig: Record<string, { label: string; emoji: string }> = {
  superior: { label: 'Maior', emoji: '📈' },
  similar: { label: 'Similar', emoji: '📊' },
  inferior: { label: 'Menor', emoji: '📉' },
};

const CompetitorIntel: React.FC<CompetitorIntelProps> = ({ items, salesArgument, isDarkMode }) => {
  const dk = isDarkMode;

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className={`text-xs font-semibold uppercase tracking-wide ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
        📊 Competidores do Prospect
      </span>

      <div className="space-y-1.5">
        {items.map((comp, i) => {
          const size = sizeConfig[comp.relativeSize] || sizeConfig.similar;
          return (
            <div
              key={i}
              className={`rounded-lg border p-2.5 ${
                dk ? 'bg-purple-950/20 border-purple-800/30' : 'bg-purple-50/40 border-purple-200/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-[11px] font-semibold ${dk ? 'text-slate-200' : 'text-slate-800'}`}>
                  🏢 {comp.name}
                </p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                  dk ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  {size.emoji} {size.label}
                </span>
              </div>
              <p className={`text-[10px] mt-0.5 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                Tech: {comp.techStack}
              </p>
              <p className={`text-[10px] mt-1 ${dk ? 'text-purple-300/70' : 'text-purple-700'}`}>
                ⚠️ {comp.insight}
              </p>
            </div>
          );
        })}
      </div>

      {salesArgument && (
        <div className={`rounded-lg border p-2.5 ${
          dk ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-emerald-50/40 border-emerald-200/40'
        }`}>
          <p className={`text-[10px] font-semibold ${dk ? 'text-emerald-400' : 'text-emerald-700'}`}>
            💡 ARGUMENTO DE VENDA:
          </p>
          <p className={`text-[11px] mt-0.5 leading-relaxed ${dk ? 'text-emerald-300/80' : 'text-emerald-800'}`}>
            "{salesArgument}"
          </p>
        </div>
      )}
    </div>
  );
};

export default CompetitorIntel;
