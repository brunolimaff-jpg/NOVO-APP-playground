import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Este projeto usa importmap (ESM via CDN) — Firebase via compat SDK global
declare global {
  interface Window {
    firebase: any;
    firebaseConfig: any;
  }
}

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

function getFirebase() {
  if (typeof window === 'undefined' || !window.firebase) return null;
  if (!window.firebase.apps?.length) {
    window.firebase.initializeApp(window.firebaseConfig);
  }
  return window.firebase;
}

async function registrarAcesso(uid: string, email: string, displayName: string) {
  try {
    const fb = getFirebase();
    if (!fb) return;
    const db = fb.firestore();
    await db.collection('acessos').doc(uid).set({
      uid,
      email,
      displayName,
      ultimoAcesso: fb.firestore.FieldValue.serverTimestamp(),
      totalAcessos: fb.firestore.FieldValue.increment(1)
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
    // Aguarda SDK compat carregar
    const init = () => {
      const fb = getFirebase();
      if (!fb) {
        setTimeout(init, 200);
        return;
      }
      const auth = fb.auth();
      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: any) => {
        if (firebaseUser) {
          const mappedUser: AuthUser = {
            id: firebaseUser.uid,
            displayName: firebaseUser.displayName || firebaseUser.email || 'Usuário',
            email: firebaseUser.email || '',
            isGuest: false
          };
          setUser(mappedUser);
          await registrarAcesso(firebaseUser.uid, firebaseUser.email || '', firebaseUser.displayName || firebaseUser.email || '');
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const fb = getFirebase();
      if (!fb) throw new Error('Firebase não inicializado');
      await fb.auth().signInWithEmailAndPassword(email, password);
    } catch (err: any) {
      const messages: Record<string, string> = {
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.'
      };
      setError(messages[err.code] || 'Erro ao fazer login.');
      throw err;
    }
  };

  const logout = async () => {
    const fb = getFirebase();
    if (fb) await fb.auth().signOut();
    setUser(null);
  };

  const updateName = (name: string) => {
    if (!user) return;
    setUser({ ...user, displayName: name });
    const fb = getFirebase();
    if (fb?.auth().currentUser) {
      fb.auth().currentUser.updateProfile({ displayName: name });
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
