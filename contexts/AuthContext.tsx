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

function readGuestModePreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerkAuth();
  const clerk = useClerk();
  const [guestModeEnabled, setGuestModeEnabled] = useState<boolean>(() => readGuestModePreference());

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
    if (isSignedIn && guestModeEnabled) setGuestMode(false);
  }, [guestModeEnabled, isSignedIn, setGuestMode]);

  // Mapeia o usuário real do Clerk para o formato que o seu App já usava
  const user: AuthUser | null =
    isSignedIn && clerkUser
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
      : guestModeEnabled
        ? {
            id: 'guest',
            displayName: 'Visitante',
            email: '',
            isGuest: true,
          }
        : null;

  // As funções abaixo agora acionam o Clerk
  const continueAsGuest = () => setGuestMode(true);
  const login = async () => {
    setGuestMode(false);
    clerk.openSignIn();
  };
  const register = async () => {
    setGuestMode(false);
    clerk.openSignUp();
  };
  const logout = async () => {
    if (guestModeEnabled && !isSignedIn) {
      setGuestMode(false);
      return;
    }
    await signOut();
    setGuestMode(false);
  };
  
  const updateName = async (name: string) => {
    if (clerkUser) {
      const parts = name.trim().split(' ');
      await clerkUser.update({ 
        firstName: parts[0], 
        lastName: parts.length > 1 ? parts.slice(1).join(' ') : '' 
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.id || '',
        isAuthenticated: !!isSignedIn || guestModeEnabled,
        loading: !isLoaded,
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
