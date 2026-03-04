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
  login: (email: string, password?: string) => Promise<void>;
  register: (name: string, email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => void;
  error: string | null;
}

const SESSION_KEY = 'scout360_session';
const USERS_DB_KEY = 'scout360_users_db'; // Onde vamos salvar os novos cadastros

// Usuários padrão para a apresentação
const DEFAULT_USERS = [
  { email: 'admin@senior.com.br', password: '123', displayName: 'Administrador' },
  { email: 'vendas@senior.com.br', password: '123', displayName: 'Equipe Vendas' }
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inicializa banco local e sessão
  useEffect(() => {
    try {
      // Garante que os usuários padrão existam
      const existingDb = localStorage.getItem(USERS_DB_KEY);
      if (!existingDb) {
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(DEFAULT_USERS));
      }

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

  const login = async (email: string, password?: string) => {
    setError(null);
    
    // Login como Convidado
    if (!email) {
      const guestUser: AuthUser = {
        id: 'guest_' + Math.random().toString(36).substr(2, 9),
        displayName: 'Visitante',
        email: 'guest@scout360.com',
        isGuest: true,
      };
      setUser(guestUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify(guestUser));
      return;
    }

    const dbRaw = localStorage.getItem(USERS_DB_KEY);
    const db = dbRaw ? JSON.parse(dbRaw) : DEFAULT_USERS;

    const record = db.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

    if (!record) {
      setError('E-mail não encontrado. Crie uma conta.');
      throw new Error('user-not-found');
    }

    if (password && record.password !== password) {
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

  const register = async (name: string, email: string, password?: string) => {
    setError(null);
    
    if (!name || !email) {
      setError('Preencha todos os campos obrigatórios.');
      throw new Error('missing-fields');
    }

    const dbRaw = localStorage.getItem(USERS_DB_KEY);
    const db = dbRaw ? JSON.parse(dbRaw) : DEFAULT_USERS;

    if (db.find((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
      setError('Este e-mail já está cadastrado.');
      throw new Error('email-exists');
    }

    // Adiciona ao "banco"
    db.push({ email, password: password || '', displayName: name });
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(db));

    // Já loga o usuário automaticamente
    const newUser: AuthUser = {
      id: email,
      displayName: name,
      email,
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
        register,
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
