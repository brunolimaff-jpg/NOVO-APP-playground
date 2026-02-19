
import React from 'react';
import { useMode } from '../contexts/ModeContext';
import { MODE_LABELS } from '../constants';

const ModeToggle: React.FC = () => {
  const { mode, toggleMode } = useMode();
  const currentConfig = MODE_LABELS[mode];
  const targetMode = mode === 'operacao' ? 'diretoria' : 'operacao';
  const targetIcon = MODE_LABELS[targetMode].icon;

  const { theme } = currentConfig;

  return (
    <div className="relative group">
      <button
        onClick={toggleMode}
        className={`
          flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border-2 
          transition-all duration-200 ease-out transform hover:scale-105 active:scale-95 shadow-lg
          ${theme.bg} ${theme.text} ${theme.border} ${theme.hover}
        `}
        title={`Modo Atual: ${currentConfig.label}. Clique para alternar.`}
      >
        <span className="text-lg md:text-xl drop-shadow-md filter">{currentConfig.icon}</span>
        <span className="font-bold text-xs md:text-sm whitespace-nowrap hidden sm:inline-block tracking-wide">
          {currentConfig.label}
        </span>
        
        {/* Separator */}
        <div className={`w-px h-4 mx-1 ${mode === 'operacao' ? 'bg-orange-400/50' : 'bg-blue-400/50'}`}></div>
        
        {/* Switch Icon */}
        <div className="flex items-center text-[10px] opacity-80 gap-1">
            <span>⇄</span>
            <span>{targetIcon}</span>
        </div>
      </button>

      {/* Tooltip */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center border border-gray-700">
        <p className="font-bold mb-1">{currentConfig.label}</p>
        <p className="text-gray-300 leading-tight">{currentConfig.description}</p>
        <p className="mt-2 text-[10px] text-emerald-400 font-mono">Clique para trocar</p>
      </div>
    </div>
  );
};

export default ModeToggle;
