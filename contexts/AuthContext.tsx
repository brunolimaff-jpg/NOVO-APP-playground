import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MASTER_PASSWORD = 'Senior2026!';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    setError(null);
    if (!email || !email.includes('@')) {
      setError('Informe um e-mail válido.');
      throw new Error('invalid-email');
    }
    if (password !== MASTER_PASSWORD) {
      setError('Senha incorreta.');
      throw new Error('wrong-password');
    }
    const displayName = email.split('@')[0];
    const newUser: AuthUser = {
      id: email,
      displayName,
      email,
      isGuest: false,
    };
    setUser(newUser);
  };

  const logout = async () => {
    setUser(null);
  };

  const updateName = (name: string) => {
    if (!user) return;
    setUser({ ...user, displayName: name });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.id || '',
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        updateName,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
};
