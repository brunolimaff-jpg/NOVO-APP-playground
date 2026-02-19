
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChatMode, DEFAULT_MODE, DIRETORIA_PROMPT, OPERACAO_PROMPT } from '../constants';

interface ModeContextType {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  toggleMode: () => void;
  systemInstruction: string;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const ModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ChatMode>(DEFAULT_MODE);

  useEffect(() => {
    const savedMode = localStorage.getItem('scout360_mode');
    // Migração de nomes antigos se existirem no storage
    if (savedMode === 'sincerao') {
      setModeState('operacao');
      localStorage.setItem('scout360_mode', 'operacao');
    } else if (savedMode === 'normal') {
      setModeState('diretoria');
      localStorage.setItem('scout360_mode', 'diretoria');
    } else if (savedMode === 'operacao' || savedMode === 'diretoria') {
      setModeState(savedMode);
    }
  }, []);

  const setMode = (newMode: ChatMode) => {
    setModeState(newMode);
    localStorage.setItem('scout360_mode', newMode);
  };

  const toggleMode = () => {
    const newMode = mode === 'operacao' ? 'diretoria' : 'operacao';
    setMode(newMode);
  };

  const systemInstruction = mode === 'operacao' ? OPERACAO_PROMPT : DIRETORIA_PROMPT;

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode, systemInstruction }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode deve ser usado dentro de um ModeProvider');
  }
  return context;
};
