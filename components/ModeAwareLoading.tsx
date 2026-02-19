
import React, { useState, useEffect, useRef } from 'react';
import { ChatMode } from '../constants';

interface ModeAwareLoadingProps {
  isLoading: boolean;
  mode: ChatMode;
  isDarkMode: boolean;
}

const ModeAwareLoading: React.FC<ModeAwareLoadingProps> = ({ isLoading, mode, isDarkMode }) => {
  const [isVisible, setIsVisible] = useState(false);
  const startTimeRef = useRef<number>(0);
  const minDuration = 800; // ms

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (isLoading) {
      startTimeRef.current = Date.now();
      setIsVisible(true);
    } else {
      // Calculate how much time has passed since loading started
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, minDuration - elapsed);

      // Wait at least the remaining time before hiding to prevent flash
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, remaining);
    }

    return () => clearTimeout(timeoutId);
  }, [isLoading]);

  if (!isVisible) return null;

  // Configurations per mode
  const config = {
    operacao: {
      icons: ['🤠', '🚜', '🐄', '🌾', '⭐', '🛻'],
      texts: [
        "Enxergando a lavoura...",
        "Contando os bois...",
        "Checando a porteira...",
        "Consultando o vaqueiro...",
        "Lendo o almanaque rural...",
        "Afiançando a tropa...",
        "Moendo a cana..."
      ],
      spinnerClass: "animate-bounce",
      containerClass: isDarkMode ? "bg-[#2d1b0e]/90 border-orange-900/50" : "bg-[#fff8f0] border-orange-200",
      textClass: isDarkMode ? "text-orange-200" : "text-orange-800",
      accentClass: "text-orange-500"
    },
    diretoria: {
      icons: ['🎯', '📊', '🔍', '💼', '✈️'],
      texts: [
        "Analisando dados...",
        "Mapeando oportunidades...",
        "Verificando fontes...",
        "Processando informações...",
        "Cruzando referências...",
        "Gerando insights..."
      ],
      spinnerClass: "animate-spin", // Modern spinner rotation
      containerClass: isDarkMode ? "bg-slate-800/90 border-slate-700" : "bg-white border-slate-200",
      textClass: isDarkMode ? "text-slate-300" : "text-slate-600",
      accentClass: "text-emerald-500"
    }
  };

  const currentConfig = config[mode];
  
  // Random text selection on mount (or re-render when visible)
  const randomTextIndex = Math.floor(Math.random() * currentConfig.texts.length);
  const text = currentConfig.texts[randomTextIndex];

  return (
    <div className="flex flex-col items-start animate-fade-in pl-1 my-4">
      <div className={`rounded-2xl p-4 border rounded-tl-none shadow-sm flex items-center gap-4 ${currentConfig.containerClass} backdrop-blur-sm transition-colors duration-300`}>
        
        {/* Spinner / Icon Animation */}
        <div className="relative w-8 h-8 flex items-center justify-center">
            {mode === 'operacao' ? (
                // Bouncing Cowboy/Tractor for Operacao
                <div className="text-2xl animate-bounce">
                    {currentConfig.icons[Math.floor(Math.random() * currentConfig.icons.length)]}
                </div>
            ) : (
                // Modern Spinner for Diretoria
                <div className={`w-6 h-6 border-2 border-current border-t-transparent rounded-full ${currentConfig.spinnerClass} ${currentConfig.accentClass}`}></div>
            )}
        </div>

        <div className="flex flex-col">
            <span className={`text-sm font-medium ${currentConfig.textClass} animate-pulse`}>
                {text}
            </span>
            {mode === 'diretoria' && (
                <div className="flex space-x-1 mt-1">
                    <div className={`w-1 h-1 rounded-full ${currentConfig.accentClass} animate-ping`} style={{animationDuration: '1s'}}></div>
                    <div className={`w-1 h-1 rounded-full ${currentConfig.accentClass} animate-ping`} style={{animationDelay: '0.2s', animationDuration: '1s'}}></div>
                    <div className={`w-1 h-1 rounded-full ${currentConfig.accentClass} animate-ping`} style={{animationDelay: '0.4s', animationDuration: '1s'}}></div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ModeAwareLoading;
