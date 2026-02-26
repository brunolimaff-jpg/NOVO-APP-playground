import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

// ─── Base de usuários pré-carregada ──────────────────────────────────────────
// Para adicionar ou remover usuários, edite esta lista.
// Cada entrada: { email, password, displayName }
// ─────────────────────────────────────────────────────────────────────────────
interface UserRecord {
  email: string;
  password: string;
  displayName: string;
}

const USERS_DB: UserRecord[] = [
  { email: 'admin@senior.com.br',   password: 'Senior2026!',  displayName: 'Administrador'  },
  { email: 'bruno@senior.com.br',   password: 'Bruno2026!',   displayName: 'Bruno Lima'     },
  { email: 'vendas@senior.com.br',  password: 'Vendas2026!',  displayName: 'Equipe Vendas'  },
  // Adicione mais usuários aqui ↓
];
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'scout360_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restaura sessão salva ao carregar a página
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);

    if (!email || !email.includes('@')) {
      setError('Informe um e-mail válido.');
      throw new Error('invalid-email');
    }

    const record = USERS_DB.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );

    if (!record) {
      setError('E-mail não encontrado.');
      throw new Error('user-not-found');
    }

    if (record.password !== password) {
      setError('Senha incorreta.');
      throw new Error('wrong-password');
    }

    const newUser: AuthUser = {
      id: record.email,
      displayName: record.displayName,
      email: record.email,
      isGuest: false,
    };

    setUser(newUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const updateName = (name: string) => {
    if (!user) return;
    const updated = { ...user, displayName: name };
    setUser(updated);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
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
  if (!ctx) throw new Error('useAuth deve estar dentro de AuthProvider');
  return ctx;
};
