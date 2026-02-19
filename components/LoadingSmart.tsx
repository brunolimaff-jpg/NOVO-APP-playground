import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMode } from '../constants';
import { generateLoadingCuriosities } from '../services/geminiService';

const FADE_DURATION = 400;

interface LoadingSmartProps {
  isLoading: boolean;
  mode: ChatMode;
  isDarkMode: boolean;
  onStop?: () => void;
  processing?: { stage?: string };
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
    if (!isLoading) { setElapsedTime(0); return; }
    const startTime = Date.now();
    const interval = setInterval(() => setElapsedTime(Date.now() - startTime), 1000);
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
          // Fallback com curiosidades estáticas
          curiositiesRef.current = [
            "O Mato Grosso lidera a produção de soja do Brasil — Fonte: IBGE",
            "A Senior atende mais de 13.000 grupos econômicos — Fonte: Senior",
            "O Brasil é o maior exportador de soja do mundo — Fonte: CONAB",
            "O agronegócio representa 25% do PIB brasileiro — Fonte: IBGE"
          ];
          setCurrentInsight(curiositiesRef.current[0]);
        }
      }).catch(() => {
        // Em caso de erro, usa fallback
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
      // Próxima curiosidade do array
      const nextIndex = (curiosityIndexRef.current + 1) % curiositiesRef.current.length;
      
      // Se chegou no fim e tem array vazio, reinicia
      if (curiositiesRef.current.length === 0) {
        setCurrentInsight("Analisando dados estratégicos...");
      } else {
        curiosityIndexRef.current = nextIndex;
        setCurrentInsight(curiositiesRef.current[nextIndex]);
      }
      
      setIsFadingOut(false); 
      
      // Troca a cada 5 segundos
      timerRef.current = setTimeout(cycleCuriosity, 5000);
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

  // Stage principal (muda durante a investigação)
  const displayStage = processing?.stage || "Investigando...";

  return (
    <div className={`
      flex flex-col w-full max-w-4xl mx-auto my-6 rounded-2xl border p-5 transition-all duration-300
      ${isDarkMode 
        ? 'bg-slate-900 border-emerald-500/20 shadow-2xl shadow-emerald-500/5' 
        : 'bg-white border-slate-200 shadow-xl'}
    `}>
      {/* LINHA 1: Stage Principal + Timer + Botão */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          {/* Spinner */}
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          
          {/* Stage Principal - EM DESTAQUE */}
          <div className="flex flex-col">
            <span className={`font-bold text-base uppercase tracking-tight ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} animate-pulse`}>
              {displayStage}
            </span>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              {Math.floor(elapsedTime / 1000)}s
            </span>
          </div>
        </div>
        
        {onStop && (
          <button 
            onClick={onStop} 
            className="bg-red-500/10 hover:bg-red-500 border border-red-500/30 text-red-500 hover:text-white px-3 py-1 rounded-full transition-all text-[10px] font-bold"
          >
            PARAR
          </button>
        )}
      </div>

      {/* LINHA 2: Curiosidades Rotativas (secundário) */}
      <div className={`pt-3 border-t ${isDarkMode ? 'border-emerald-500/10' : 'border-slate-100'} transition-opacity duration-300 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
        <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          💡 {currentInsight}
        </p>
      </div>
    </div>
  );
};

export default LoadingSmart;
