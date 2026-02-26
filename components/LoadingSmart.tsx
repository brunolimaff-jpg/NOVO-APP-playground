import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMode } from '../constants';
import { generateLoadingCuriosities } from '../services/geminiService';

const FADE_DURATION = 400;

interface LoadingSmartProps {
  isLoading: boolean;
  mode: ChatMode;
  isDarkMode: boolean;
  onStop?: () => void;
  processing?: { stage?: string; completedStages?: string[] };
  searchQuery?: string;
}

const LoadingSmart: React.FC<LoadingSmartProps> = ({
  isLoading,
  mode,
  isDarkMode,
  onStop,
  processing,
  searchQuery
}) => {
  const [currentInsight, setCurrentInsight] = useState<string>("Preparando investigação...");
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const curiositiesRef = useRef<string[]>([]);
  const curiosityIndexRef = useRef<number>(0);

  // 1. Contador de Tempo
  useEffect(() => {
    if (!isLoading) { 
      setElapsedTime(0); 
      return; 
    }
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // 2. Busca curiosidades quando inicia nova investigação
  useEffect(() => {
    if (isLoading && searchQuery && searchQuery.length > 3) {
      curiosityIndexRef.current = 0;
      curiositiesRef.current = [];

      generateLoadingCuriosities(searchQuery).then(facts => {
        if (facts && facts.length > 0) {
          curiositiesRef.current = facts;
          setCurrentInsight(facts[0]);
        } else {
          curiositiesRef.current = [
            "O Mato Grosso lidera a produção de soja do Brasil — Fonte: IBGE",
            "A Senior atende mais de 13.000 grupos econômicos — Fonte: Senior",
            "O Brasil é o maior exportador de soja do mundo — Fonte: CONAB",
            "O agronegócio representa 25% do PIB brasileiro — Fonte: IBGE"
          ];
          setCurrentInsight(curiositiesRef.current[0]);
        }
      }).catch(() => {
        curiositiesRef.current = [
          "O Mato Grosso lidera a produção de soja do Brasil — Fonte: IBGE",
          "A Senior atende mais de 13.000 grupos econômicos — Fonte: Senior",
          "O Brasil é o maior exportador de soja do mundo — Fonte: CONAB"
        ];
        setCurrentInsight(curiositiesRef.current[0]);
      });
    }
  }, [isLoading, searchQuery]);

  // 3. Ciclo de rotação de curiosidades
  const cycleCuriosity = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    setIsFadingOut(true);

    timerRef.current = setTimeout(() => {
      const nextIndex = (curiosityIndexRef.current + 1) % curiositiesRef.current.length;

      if (curiositiesRef.current.length === 0) {
        setCurrentInsight("Analisando dados estratégicos...");
      } else {
        curiosityIndexRef.current = nextIndex;
        setCurrentInsight(curiositiesRef.current[nextIndex]);
      }

      setIsFadingOut(false);

      timerRef.current = setTimeout(cycleCuriosity, 12000);
    }, FADE_DURATION);
  }, []);

  // 4. Controle de Exibição
  useEffect(() => {
    if (isLoading) {
      setIsVisible(true);
      setIsFadingOut(false);
      cycleCuriosity();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsFadingOut(true);
      setTimeout(() => setIsVisible(false), FADE_DURATION);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoading, cycleCuriosity]);

  if (!isVisible) return null;

  const displayStage = processing?.stage || "Investigando...";
  const completedStages = processing?.completedStages || [];
  const totalSteps = completedStages.length + 1;

  return (
    <div className={`
      flex flex-col w-full rounded-xl p-4 transition-all duration-300
      ${isDarkMode
        ? 'border border-emerald-500/10 bg-slate-900/50'
        : 'border border-emerald-100 bg-emerald-50/30'}
    `}>
      {/* HEADER: Timer + Botão PARAR */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono px-2 py-1 rounded-md ${isDarkMode ? 'bg-slate-800 text-emerald-400' : 'bg-white text-emerald-600'}`}>
            {(() => { const s = Math.floor(elapsedTime / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; })()}
          </span>
          <span className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
            Etapa {totalSteps} em andamento
          </span>
        </div>

        {/* ✅ APENAS BOTÃO PARAR - UX limpa sem ansiedade */}
        {onStop && (
          <button
            onClick={onStop}
            className="bg-red-500/10 hover:bg-red-500 border border-red-500/30 text-red-500 hover:text-white px-3 py-1 rounded-full transition-all text-[10px] font-bold"
          >
            PARAR
          </button>
        )}
      </div>

      {/* PROGRESS STEPS */}
      <div className="flex flex-col gap-1.5 mb-4">
        {/* Completed steps */}
        {completedStages.map((stage, index) => (
          <div key={index} className="flex items-center gap-3 animate-fade-in">
            <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
              <svg className={`w-3 h-3 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              {stage}
            </span>
          </div>
        ))}

        {/* Current step */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <span className={`text-sm font-semibold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {displayStage}
          </span>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className={`w-full h-1 rounded-full overflow-hidden mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-emerald-100'}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out relative overflow-hidden"
          style={{ width: `${Math.min(Math.max(totalSteps * 14, 8), 100)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* CURIOSIDADES */}
      <div className={`pt-3 border-t ${isDarkMode ? 'border-emerald-500/10' : 'border-emerald-200'} transition-opacity duration-300 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
        <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          💡 {currentInsight}
        </p>
      </div>
    </div>
  );
};

export default LoadingSmart;
