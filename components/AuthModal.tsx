import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { REQUIRE_CLERK_AUTH, useAuth } from '../contexts/AuthContext';

export const AuthModal: React.FC = () => {
  const { isAuthenticated, loading, continueAsGuest } = useAuth();

  // Se o usuário já está logado no Clerk, este modal desaparece e mostra o App
  if (isAuthenticated) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in p-4 overflow-y-auto">
      <div className="w-full max-w-md flex flex-col items-center justify-center">
        {/* Decorative elements */}
        <div className="text-center mb-6 relative z-10">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent mb-2">
            Scout 360
          </h2>
          <p className="text-slate-300 text-sm font-medium">
            Inteligência Comercial para o Agronegócio
          </p>
        </div>

        {/* Componente Oficial do Clerk que lida com Sign In, Sign Up, Esqueceu a Senha e Google Auth */}
        {loading ? (
          <div className="w-full max-w-sm rounded-2xl border border-slate-700/70 bg-slate-900/70 px-5 py-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
            <p className="text-slate-200 text-sm font-medium">Conectando autenticação...</p>
          </div>
        ) : (
          <div className="shadow-2xl rounded-2xl overflow-hidden">
            <SignIn routing="hash" />
          </div>
        )}

        {!REQUIRE_CLERK_AUTH && (
          <>
            <button
              onClick={continueAsGuest}
              className="mt-4 text-sm font-semibold text-emerald-300 hover:text-emerald-200 transition-colors underline underline-offset-2"
            >
              Continuar sem login
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400 max-w-xs">
              Se o login travar no navegador, entre como visitante e continue a análise normalmente.
            </p>
          </>
        )}

      </div>
    </div>
  );
};
