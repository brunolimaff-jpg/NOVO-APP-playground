import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatMode } from '../constants';
import { generateLoadingCuriosities } from '../services/geminiService';
import { buildLoadingCuriositiesFallback } from '../utils/loadingCuriosities';
import { isPhaseTimelineStatus } from '../utils/loadingStatus';
import { sanitizeLoadingContextText, stripInternalMarkers } from '../utils/textCleaners';

const FADE_DURATION = 400;
const SOURCE_LINKS: Record<string, string> = {
  ibge: 'https://www.ibge.gov.br/',
  conab: 'https://www.conab.gov.br/',
  embrapa: 'https://www.embrapa.br/',
  senior: 'https://www.senior.com.br/',
  gatec: 'https://www.gatec.com.br/'
};

interface LoadingSmartProps {
  isLoading: boolean;
  mode: ChatMode;
  isDarkMode: boolean;
  onStop?: () => void;
  processing?: { stage?: string; completedStages?: string[] };
  searchQuery?: string;
  empresaAlvo?: string | null;
}

const LoadingSmart: React.FC<LoadingSmartProps> = ({
  isLoading,
  mode,
  isDarkMode,
  onStop,
  processing,
  searchQuery,
  empresaAlvo
}) => {
  const [currentInsight, setCurrentInsight] = useState<string>(
    'Empresas com disciplina operacional tendem a transformar dados em vantagem competitiva mais rápido.'
  );
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const curiositiesRef = useRef<string[]>([]);
  const curiosityIndexRef = useRef<number>(0);
  const extractCompanyFromQuery = useCallback((query?: string): string => {
    if (!query) return '';
    const cleanQuery = query.trim().replace(/[.]{2,}$/g, '').replace(/\s+/g, ' ');

    const deepDiveMatch = cleanQuery.match(/Dossi[eê]\s+completo\s+de\s+\[([^\]]+)\]/i);
    if (deepDiveMatch?.[1]) {
      return deepDiveMatch[1].trim();
    }

    const cadastroMatch = cleanQuery.match(/Contexto\s+cadastral\s+obrigat[oó]rio:\s*Empresa=([^;]+);/i);
    if (cadastroMatch?.[1]) {
      return cadastroMatch[1].trim();
    }

    const patterns = [
      /\b(?:do|da|de)\s+((?:grupo|empresa|fazenda|usina)?\s*[a-z0-9À-ÿ][a-z0-9À-ÿ&.\- ]{2,60})$/i,
      /\b(?:sobre|empresa|grupo)\s+((?:grupo|empresa)?\s*[a-z0-9À-ÿ][a-z0-9À-ÿ&.\- ]{2,60})$/i,
    ];

    for (const pattern of patterns) {
      const match = cleanQuery.match(pattern);
      if (match?.[1]) {
        return match[1].trim().replace(/[.,;:!?]+$/g, '');
      }
    }

    return '';
  }, []);

  const companyFocus = (empresaAlvo || extractCompanyFromQuery(searchQuery)).trim();
  const safeContext = companyFocus.trim();
  const safeSearchQuery = useMemo(
    () => sanitizeLoadingContextText(searchQuery || '', companyFocus),
    [searchQuery, companyFocus]
  );
  const loadingContext = (safeContext || safeSearchQuery).trim();
  const sanitizedQueryForCuriosities = useMemo(() => {
    return sanitizeLoadingContextText(searchQuery || '', companyFocus);
  }, [searchQuery, companyFocus]);
  const normalizeSourceLabel = useCallback((label: string): string => {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .trim();
  }, []);

  const renderInsight = useCallback((insight: string): React.ReactNode => {
    const sourceMatch = insight.match(/^(.*?)(?:\s+[—-]\s*Fonte:\s*)(.+)$/i);
    if (!sourceMatch) return insight;

    const prefix = sourceMatch[1].trim();
    const sourceLabel = sourceMatch[2].trim().replace(/[.)]+$/, '');
    const sourceKey = normalizeSourceLabel(sourceLabel);
    const sourceUrl = SOURCE_LINKS[sourceKey];

    if (!sourceUrl) {
      return insight;
    }

    return (
      <>
        {prefix} {' — '}Fonte:{' '}
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80 transition-opacity"
        >
          {sourceLabel}
        </a>
      </>
    );
  }, [normalizeSourceLabel]);

  const buildFallbackCuriosities = useCallback((context: string): string[] => {
    return buildLoadingCuriositiesFallback(context);
  }, []);

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
    if (isLoading) {
      curiosityIndexRef.current = 0;
      curiositiesRef.current = [];
      setCurrentInsight(
        companyFocus
          ? `${companyFocus} ganha previsibilidade quando operação e gestão acompanham os mesmos indicadores críticos.`
          : 'Empresas com disciplina operacional tendem a transformar dados em vantagem competitiva mais rápido.'
      );

      if (!loadingContext || loadingContext.length < 2) {
        curiositiesRef.current = buildFallbackCuriosities('');
        setCurrentInsight(curiositiesRef.current[0]);
        return;
      }

      generateLoadingCuriosities(loadingContext, sanitizedQueryForCuriosities).then(facts => {
        if (facts && facts.length > 0) {
          curiositiesRef.current = facts.map((fact) => stripInternalMarkers(fact)).filter(Boolean);
          setCurrentInsight(curiositiesRef.current[0] || buildFallbackCuriosities(loadingContext)[0]);
        } else {
          curiositiesRef.current = buildFallbackCuriosities(loadingContext);
          setCurrentInsight(curiositiesRef.current[0]);
        }
      }).catch(() => {
        curiositiesRef.current = buildFallbackCuriosities(loadingContext);
        setCurrentInsight(curiositiesRef.current[0]);
      });
    }
  }, [isLoading, companyFocus, loadingContext, sanitizedQueryForCuriosities, buildFallbackCuriosities]);

  // 3. Ciclo de rotação de curiosidades (SEMPRE ATIVO)
  const cycleCuriosity = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    setIsFadingOut(true);

    timerRef.current = setTimeout(() => {
      const nextIndex = (curiosityIndexRef.current + 1) % curiositiesRef.current.length;

      if (curiositiesRef.current.length === 0) {
        setCurrentInsight('Curiosidade: empresas que monitoram rotina operacional com consistência aceleram decisões comerciais.');
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

  const displayStageRaw = processing?.stage || (companyFocus ? `Investigando ${companyFocus}...` : 'Investigação em andamento...');
  const displayStage = stripInternalMarkers(displayStageRaw) || 'Investigação em andamento...';
  const completedStages = (processing?.completedStages || [])
    .map((stage) => stripInternalMarkers(stage))
    .filter(Boolean);
  const hasPhaseTimeline = [...completedStages, displayStage].some(isPhaseTimelineStatus);
  const visibleCompletedStages = hasPhaseTimeline
    ? completedStages.filter(isPhaseTimelineStatus)
    : completedStages;
  const visibleCurrentStage = hasPhaseTimeline && !isPhaseTimelineStatus(displayStage)
    ? 'Consolidando saída da fase atual...'
    : displayStage;
  const totalSteps = visibleCompletedStages.length + 1;

  return (
    <div className={`
      flex flex-col w-full rounded-xl p-4 transition-all duration-300
      ${
        isDarkMode
          ? 'border border-emerald-500/10 bg-slate-900/50'
          : 'border border-emerald-100 bg-emerald-50/30'
      }
    `}>
      {/* HEADER: Timer + Botão PARAR */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono px-2 py-1 rounded-md ${
            isDarkMode ? 'bg-slate-800 text-emerald-400' : 'bg-white text-emerald-600'
          }`}>
            {(() => { 
              const s = Math.floor(elapsedTime / 1000); 
              return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; 
            })()}
          </span>
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            isDarkMode ? 'text-slate-500' : 'text-slate-600'
          }`}>
            {hasPhaseTimeline ? `Fase ${totalSteps} em andamento` : (visibleCompletedStages.length > 0 ? `Passo ${totalSteps} em andamento` : 'Análise em andamento')}
          </span>
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

      {/* PROGRESS STEPS */}
      <div className="flex flex-col gap-1.5 mb-4">
        {/* Completed steps */}
        {visibleCompletedStages.map((stage, index) => (
          <div key={index} className="flex items-center gap-3 animate-fade-in">
            <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
              isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100'
            }`}>
              <svg className={`w-3 h-3 ${
                isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className={`text-sm ${
              isDarkMode ? 'text-slate-500' : 'text-slate-600'
            }`}>
              {stage}
            </span>
          </div>
        ))}

        {/* Current step */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <span className={`text-sm font-semibold ${
            isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
          }`}>
            {visibleCurrentStage}
          </span>
        </div>
      </div>

      {/* CURIOSIDADES PERSONALIZADAS (SEMPRE VISÍVEL) */}
      <div className={`pt-3 border-t ${
        isDarkMode ? 'border-emerald-500/10' : 'border-emerald-200'
      } transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}>
        <p className={`text-sm leading-relaxed ${
          isDarkMode ? 'text-slate-400' : 'text-slate-600'
        }`}>
          💡 {renderInsight(currentInsight)}
        </p>
      </div>
    </div>
  );
};

export default LoadingSmart;
