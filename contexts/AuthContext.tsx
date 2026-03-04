import React, { createContext, useContext, ReactNode } from 'react';
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
  login: (email?: string, password?: string) => Promise<void>;
  register: (name?: string, email?: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerkAuth();
  const clerk = useClerk();

  // Mapeia o usuário real do Clerk para o formato que o seu App já usava
  const user: AuthUser | null = isSignedIn && clerkUser ? {
    id: clerkUser.id,
    displayName: clerkUser.fullName || clerkUser.firstName || clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Usuário',
    email: clerkUser.primaryEmailAddress?.emailAddress || '',
    isGuest: false,
  } : null;

  // As funções abaixo agora acionam o Clerk
  const login = async () => { clerk.openSignIn(); };
  const register = async () => { clerk.openSignUp(); };
  const logout = async () => { await signOut(); };
  
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
        isAuthenticated: !!isSignedIn,
        loading: !isLoaded,
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
