
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface AuthUser {
  id: string;
  displayName: string;
  isGuest: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  userId: string; // Mantido para compatibilidade (retorna user.id ou vazio)
  isAuthenticated: boolean;
  login: (name?: string) => void;
  logout: () => void;
  updateName: (name: string) => void; // Nova função
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'scout360.user';
const STORAGE_KEY_OLD_ID = 'scout360.userId';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // 1. Tenta carregar o usuário novo (JSON)
    const savedUserJson = localStorage.getItem(STORAGE_KEY_USER);
    
    if (savedUserJson) {
      try {
        const parsed = JSON.parse(savedUserJson);
        if (parsed && parsed.id) {
          setUser(parsed);
          return;
        }
      } catch (e) {
        console.error("Erro ao ler usuário salvo", e);
      }
    }

    // 2. Fallback / Migração: Tenta carregar o formato antigo (apenas string ID)
    const oldId = localStorage.getItem(STORAGE_KEY_OLD_ID);
    if (oldId) {
      // Migra o usuário antigo para o novo formato assumindo que o ID era o nome (comportamento anterior)
      const migratedUser: AuthUser = {
        id: oldId, // Mantém o ID antigo para não perder histórico
        displayName: oldId, // Antes o ID era o input do usuário
        isGuest: false
      };
      setUser(migratedUser);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(migratedUser));
      // Não removemos o oldId imediatamente por segurança, mas o novo tem preferência
    }
  }, []);

  const login = (name?: string) => {
    let newUser: AuthUser;

    if (name && name.trim()) {
      // Modo Nomeado
      newUser = {
        id: uuidv4(),
        displayName: name.trim(),
        isGuest: false
      };
    } else {
      // Modo Convidado
      newUser = {
        id: uuidv4(),
        displayName: "Convidado",
        isGuest: true
      };
    }

    setUser(newUser);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
    localStorage.removeItem(STORAGE_KEY_OLD_ID);
  };

  const updateName = (name: string) => {
    if (!user) return;
    const updatedUser = { ...user, displayName: name };
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_OLD_ID);
    setUser(null);
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userId: user?.id || '', 
      isAuthenticated: !!user,
      login,
      logout,
      updateName
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve estar dentro de AuthProvider');
  return ctx;
};
