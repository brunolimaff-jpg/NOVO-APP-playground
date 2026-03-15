import React from 'react';
import {
  getCropsForState,
  getRegionName,
  getCropPhase,
  getCropPhaseLabel,
  getCropPhaseEmoji,
  getMonthLabel,
  getSafraRecommendation,
  type CropSeason,
} from '../utils/safraCalendar';

interface SafraTimelineProps {
  state: string;
  isDarkMode: boolean;
  compact?: boolean;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function isMonthInRange(month: number, start: number, end: number): boolean {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

function getBarColor(crop: CropSeason, month: number, isDarkMode: boolean): string {
  const isPlanting = isMonthInRange(month, crop.plantingStart, crop.plantingEnd);
  const isHarvest = isMonthInRange(month, crop.harvestStart, crop.harvestEnd);

  if (isPlanting) return isDarkMode ? 'bg-emerald-600' : 'bg-emerald-400';
  if (isHarvest) return isDarkMode ? 'bg-amber-500' : 'bg-amber-400';
  return isDarkMode ? 'bg-slate-800' : 'bg-slate-200';
}

const SafraTimeline: React.FC<SafraTimelineProps> = ({ state, isDarkMode, compact = false }) => {
  const crops = getCropsForState(state);
  if (crops.length === 0) return null;

  const currentMonth = new Date().getMonth() + 1;
  const region = getRegionName(state);
  const recommendation = getSafraRecommendation(state, currentMonth);

  // Compact version for CRM Detail
  if (compact) {
    if (!recommendation) return null;
    const phaseEmoji = getCropPhaseEmoji(recommendation.phase);
    const phaseLabel = getCropPhaseLabel(recommendation.phase);

    return (
      <div className={`rounded-xl border p-3 ${
        isDarkMode ? 'bg-amber-950/20 border-amber-800/30' : 'bg-amber-50/50 border-amber-200/40'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🌾</span>
            <span className={`text-xs font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Safra — {state}
            </span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
            recommendation.phase === 'entressafra'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : recommendation.phase === 'colheita'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
          }`}>
            {phaseEmoji} {phaseLabel}
          </span>
        </div>
        <p className={`mt-1.5 text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          {recommendation.mainCrop.emoji} {recommendation.mainCrop.crop}: {phaseLabel.toLowerCase()}
        </p>
        <p className={`mt-0.5 text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          💡 Janela ideal: {recommendation.idealMonths}
        </p>
      </div>
    );
  }

  // Full timeline version
  return (
    <div className={`rounded-xl border p-3 mt-3 ${
      isDarkMode ? 'bg-amber-950/20 border-amber-800/30' : 'bg-amber-50/30 border-amber-200/40'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🌾</span>
        <span className={`text-xs font-semibold ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
          Calendário Safra — {region} ({state})
        </span>
      </div>

      {/* Timeline bars */}
      <div className="space-y-2">
        {crops.map(crop => (
          <div key={crop.crop} className="flex items-center gap-2">
            <span className={`text-[10px] w-20 truncate font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {crop.emoji} {crop.crop}
            </span>
            <div className="flex-1 flex gap-px">
              {MONTHS.map(m => (
                <div
                  key={m}
                  className={`flex-1 h-3 rounded-sm relative ${getBarColor(crop, m, isDarkMode)} ${
                    m === currentMonth ? 'ring-1 ring-white dark:ring-slate-300 ring-offset-1 ring-offset-transparent' : ''
                  }`}
                  title={`${getMonthLabel(m)}: ${getCropPhaseLabel(getCropPhase(crop, m))}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Month labels */}
      <div className="flex items-center gap-2 mt-1">
        <span className="w-20" />
        <div className="flex-1 flex">
          {MONTHS.map(m => (
            <span
              key={m}
              className={`flex-1 text-center text-[8px] ${
                m === currentMonth
                  ? isDarkMode ? 'text-amber-400 font-bold' : 'text-amber-600 font-bold'
                  : isDarkMode ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              {getMonthLabel(m)}
            </span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className={`flex items-center gap-3 mt-2 text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-sm ${isDarkMode ? 'bg-emerald-600' : 'bg-emerald-400'}`} /> Plantio
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-sm ${isDarkMode ? 'bg-amber-500' : 'bg-amber-400'}`} /> Colheita
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-sm ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} /> Entressafra
        </span>
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className={`mt-2 pt-2 border-t ${isDarkMode ? 'border-amber-800/20' : 'border-amber-200/30'}`}>
          <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-amber-400/80' : 'text-amber-700'}`}>
            💡 {recommendation.recommendation}
          </p>
        </div>
      )}
    </div>
  );
};

export default SafraTimeline;
