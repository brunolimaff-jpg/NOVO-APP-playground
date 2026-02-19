
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const AuthModal: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const [input, setInput] = useState('');

  if (isAuthenticated) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(input);
  };

  const handleGuestLogin = () => {
    login(); // Sem argumentos = Convidado
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent mb-2">
            Senior Scout 360
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
            Inteligência comercial para o agronegócio.
            </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1 ml-1">Como quer ser chamado?</label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Seu nome ou apelido (Opcional)"
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all"
            autoFocus
          />
          
          <button
            type="submit"
            className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all transform active:scale-95 shadow-lg shadow-emerald-500/20 mb-3"
          >
            {input.trim() ? `Entrar como ${input.trim()}` : 'Continuar'} ➤
          </button>
        </form>

        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-300 dark:border-slate-700"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs">ou</span>
            <div className="flex-grow border-t border-slate-300 dark:border-slate-700"></div>
        </div>

        <button
          onClick={handleGuestLogin}
          className="w-full py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 font-medium transition-colors"
        >
          🙋 Entrar como Convidado
        </button>

        <p className="text-center text-[10px] text-slate-400 mt-4">
            Seus dados são usados apenas para personalizar sua experiência e salvar seu histórico localmente.
        </p>
      </div>
    </div>
  );
};
