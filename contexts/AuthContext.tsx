import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

function initFirebase() {
  if (typeof window === 'undefined') return null;
  const fb = window.firebase;
  if (!fb) return null;
  if (!fb.apps || !fb.apps.length) {
    fb.initializeApp(window.firebaseConfig);
  }
  return fb;
}

async function registrarAcesso(uid: string, email: string, displayName: string) {
  try {
    const fb = initFirebase();
    if (!fb) return;
    await fb.firestore().collection('acessos').doc(uid).set({
      uid,
      email,
      displayName,
      ultimoAcesso: fb.firestore.FieldValue.serverTimestamp(),
      totalAcessos: fb.firestore.FieldValue.increment(1)
    }, { merge: true });
  } catch (e) {
    console.warn('registrarAcesso falhou:', e);
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let attempts = 0;
    const maxAttempts = 30; // 3 segundos max

    const tryInit = () => {
      const fb = initFirebase();
      if (!fb) {
        attempts++;
        if (attempts >= maxAttempts) {
          // Firebase não carregou, libera sem auth
          console.warn('Firebase SDK não carregou após 3s');
          setLoading(false);
          return;
        }
        setTimeout(tryInit, 100);
        return;
      }

      unsubscribe = fb.auth().onAuthStateChanged(async (firebaseUser: any) => {
        if (firebaseUser) {
          const mappedUser: AuthUser = {
            id: firebaseUser.uid,
            displayName: firebaseUser.displayName || firebaseUser.email || 'Usuário',
            email: firebaseUser.email || '',
            isGuest: false
          };
          setUser(mappedUser);
          registrarAcesso(firebaseUser.uid, firebaseUser.email || '', firebaseUser.displayName || '');
        } else {
          setUser(null);
        }
        setLoading(false);
      });
    };

    tryInit();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const fb = initFirebase();
      if (!fb) throw new Error('Firebase não disponível');
      await fb.auth().signInWithEmailAndPassword(email, password);
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.'
      };
      setError(msgs[err.code] || 'Erro ao fazer login.');
      throw err;
    }
  };

  const logout = async () => {
    const fb = initFirebase();
    if (fb) await fb.auth().signOut();
    setUser(null);
  };

  const updateName = (name: string) => {
    if (!user) return;
    setUser({ ...user, displayName: name });
    const fb = initFirebase();
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
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
};
