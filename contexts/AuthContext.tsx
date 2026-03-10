import React, { createContext, useContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { useUser, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  isGuest: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  userId: string;
  isAuthenticated: boolean;
  loading: boolean;
  continueAsGuest: () => void;
  login: (email?: string, password?: string) => Promise<void>;
  register: (name?: string, email?: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const GUEST_MODE_STORAGE_KEY = 'scout360:guest_mode';
const GUEST_NAME_STORAGE_KEY = 'scout360:guest_name';

// TEMPORARY: Desativando o Clerk temporariamente conforme solicitado.
// Para reativar depois, mude TEMPORARILY_DISABLE_CLERK para false.
export const TEMPORARILY_DISABLE_CLERK = true;

export const REQUIRE_CLERK_AUTH = !TEMPORARILY_DISABLE_CLERK && import.meta.env.VITE_REQUIRE_AUTH === 'true';

function readGuestModePreference(): boolean {
  if (TEMPORARILY_DISABLE_CLERK) return true; // Força visitante
  if (REQUIRE_CLERK_AUTH) return false;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function readGuestNamePreference(): string {
  if (typeof window === 'undefined') return 'Visitante';
  try {
    const stored = (window.localStorage.getItem(GUEST_NAME_STORAGE_KEY) || '').trim();
    return stored || 'Visitante';
  } catch {
    return 'Visitante';
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerkAuth();
  const clerk = useClerk();
  const [guestModeEnabled, setGuestModeEnabled] = useState<boolean>(() => readGuestModePreference());
  const [guestDisplayName, setGuestDisplayName] = useState<string>(() => readGuestNamePreference());

  const setGuestMode = useCallback((enabled: boolean) => {
    setGuestModeEnabled(enabled);
    if (typeof window === 'undefined') return;
    try {
      if (enabled) {
        window.localStorage.setItem(GUEST_MODE_STORAGE_KEY, '1');
      } else {
        window.localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
      }
    } catch {
      // Ignora falhas de storage (modo privado/restrições do browser).
    }
  }, []);

  useEffect(() => {
    if (isSignedIn && guestModeEnabled && !TEMPORARILY_DISABLE_CLERK) setGuestMode(false);
  }, [guestModeEnabled, isSignedIn, setGuestMode]);

  useEffect(() => {
    if (REQUIRE_CLERK_AUTH && guestModeEnabled) setGuestMode(false);
  }, [guestModeEnabled, setGuestMode]);

  useEffect(() => {
    if (!TEMPORARILY_DISABLE_CLERK) return;
    try {
      // Fecha qualquer modal/portal de autenticação remanescente do Clerk no modo visitante.
      (clerk as { closeSignIn?: () => void; closeSignUp?: () => void }).closeSignIn?.();
      (clerk as { closeSignIn?: () => void; closeSignUp?: () => void }).closeSignUp?.();
    } catch {
      // Evita quebrar a app caso a API interna do Clerk mude.
    }
  }, [clerk]);

  // Mapeia o usuário real do Clerk para o formato que o seu App já usava
  const user: AuthUser | null =
    isSignedIn && clerkUser && !TEMPORARILY_DISABLE_CLERK
      ? {
          id: clerkUser.id,
          displayName:
            clerkUser.fullName ||
            clerkUser.firstName ||
            clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] ||
            'Usuário',
          email: clerkUser.primaryEmailAddress?.emailAddress || '',
          isGuest: false,
        }
      : (!REQUIRE_CLERK_AUTH && guestModeEnabled) || TEMPORARILY_DISABLE_CLERK
        ? {
            id: 'guest',
            displayName: guestDisplayName || 'Visitante',
            email: '',
            isGuest: true,
          }
        : null;

  // As funções abaixo agora acionam o Clerk
  const continueAsGuest = () => {
    if (REQUIRE_CLERK_AUTH) return;
    setGuestMode(true);
  };
  const login = async () => {
    if (TEMPORARILY_DISABLE_CLERK) return;
    setGuestMode(false);
    clerk.openSignIn();
  };
  const register = async () => {
    if (TEMPORARILY_DISABLE_CLERK) return;
    setGuestMode(false);
    clerk.openSignUp();
  };
  const logout = async () => {
    if (guestModeEnabled && !isSignedIn) {
      setGuestMode(false);
      return;
    }
    if (!TEMPORARILY_DISABLE_CLERK) {
      await signOut();
    }
    setGuestMode(false);
  };
  
  const updateName = async (name: string) => {
    const normalizedName = name.trim() || 'Visitante';

    // Modo visitante: persiste localmente e atualiza imediatamente a UI.
    if (TEMPORARILY_DISABLE_CLERK || guestModeEnabled || !isSignedIn) {
      setGuestDisplayName(normalizedName);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(GUEST_NAME_STORAGE_KEY, normalizedName);
        } catch {
          // Ignora falhas de storage.
        }
      }
      return;
    }

    if (clerkUser && !TEMPORARILY_DISABLE_CLERK) {
      const parts = normalizedName.split(' ');
      await clerkUser.update({
        firstName: parts[0],
        lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.id || '',
        isAuthenticated: !!isSignedIn || (!REQUIRE_CLERK_AUTH && guestModeEnabled) || TEMPORARILY_DISABLE_CLERK,
        loading: TEMPORARILY_DISABLE_CLERK ? false : !isLoaded,
        continueAsGuest,
        login,
        register,
        logout,
        updateName,
        error: null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve estar dentro de AuthProvider');
  return ctx;
};
