
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChatMode, DEFAULT_MODE } from '../constants';

interface ModeContextType {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  toggleMode: () => void;
  systemInstruction: string;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const ModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ChatMode>(DEFAULT_MODE);
  const [systemInstruction, setSystemInstruction] = useState<string>('');
  const ENFORCED_MODE: ChatMode = 'operacao';

  useEffect(() => {
    // MVP: diretoria desativado temporariamente. Força operação.
    setModeState(ENFORCED_MODE);
    localStorage.setItem('scout360_mode', ENFORCED_MODE);
  }, []);

  // Lazy-load prompts (code-splitting: ~50KB deferred)
  useEffect(() => {
    import('../prompts/systemPrompts').then(({ OPERACAO_PROMPT, DIRETORIA_PROMPT }) => {
      setSystemInstruction(mode === 'operacao' ? OPERACAO_PROMPT : DIRETORIA_PROMPT);
    });
  }, [mode]);

  const setMode = (_newMode: ChatMode) => {
    setModeState(ENFORCED_MODE);
    localStorage.setItem('scout360_mode', ENFORCED_MODE);
  };

  const toggleMode = () => {
    setMode(ENFORCED_MODE);
  };

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
