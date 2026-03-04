import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { useAuth } from '../contexts/AuthContext';

export const AuthModal: React.FC = () => {
  const { isAuthenticated } = useAuth();

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
        <div className="shadow-2xl rounded-2xl overflow-hidden">
          <SignIn routing="hash" />
        </div>

      </div>
    </div>
  );
};
