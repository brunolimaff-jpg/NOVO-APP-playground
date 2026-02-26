import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';

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

async function registrarAcesso(firebaseUser: FirebaseUser) {
  try {
    const ref = doc(db, 'acessos', firebaseUser.uid);
    await setDoc(ref, {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || firebaseUser.email,
      ultimoAcesso: serverTimestamp(),
      totalAcessos: (await import('firebase/firestore')).then(m => m.increment(1))
    }, { merge: true });
  } catch (e) {
    console.warn('Erro ao registrar acesso:', e);
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const mappedUser: AuthUser = {
          id: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email || 'Usuário',
          email: firebaseUser.email || '',
          isGuest: false
        };
        setUser(mappedUser);
        await registrarAcesso(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const messages: Record<string, string> = {
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.'
      };
      setError(messages[err.code] || 'Erro ao fazer login.');
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const updateName = (name: string) => {
    if (!user) return;
    setUser({ ...user, displayName: name });
    if (auth.currentUser) {
      updateProfile(auth.currentUser, { displayName: name });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userId: user?.id || '',
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      updateName,
      error
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
