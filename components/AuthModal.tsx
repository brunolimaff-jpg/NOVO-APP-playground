import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const AuthModal: React.FC = () => {
  const { login, register, isAuthenticated, error } = useAuth();
  
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      // O erro já é tratado e exibido via contexto
    }
  };

  const handleGuestLogin = () => {
    login('', ''); // E-mail vazio ativa o modo Convidado no AuthContext
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-center mb-6 relative z-10">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent mb-2">
            Scout 360
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Inteligência Comercial para Executivos High-Ticket
          </p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-6 relative z-10">
          <button 
            onClick={() => { setTab('login'); setErrorLocal(); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${tab === 'login' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Entrar
          </button>
          <button 
            onClick={() => { setTab('register'); setErrorLocal(); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${tab === 'register' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Criar Conta
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs font-medium text-center animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative z-10">
          {tab === 'register' && (
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1 ml-1">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all"
                required={tab === 'register'}
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1 ml-1">E-mail Corporativo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1 ml-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all"
            />
            {tab === 'login' && (
              <div className="text-right mt-1">
                <a href="#" className="text-[10px] text-emerald-600 hover:underline">Esqueceu a senha?</a>
              </div>
            )}
          </div>
          
          <button
            type="submit"
            className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all transform active:scale-95 shadow-lg shadow-emerald-500/20 mb-4"
          >
            {tab === 'login' ? 'Acessar Plataforma ➤' : 'Criar Conta e Acessar ➤'}
          </button>
        </form>

        <div className="relative flex py-3 items-center mb-2 z-10">
            <div className="flex-grow border-t border-slate-300 dark:border-slate-700"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs">Apenas visualizando?</span>
            <div className="flex-grow border-t border-slate-300 dark:border-slate-700"></div>
        </div>

        <button
          onClick={handleGuestLogin}
          className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors relative z-10"
        >
          🕵️ Entrar como Visitante
        </button>

      </div>
    </div>
  );

  function setErrorLocal() {
    // Apenas limpa campos ao trocar de aba se preferir
  }
};
