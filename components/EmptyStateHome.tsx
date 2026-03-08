import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChatMode, APP_NAME } from '../constants';

interface EmptyStateHomeProps {
  mode: ChatMode;
  onPreFill: (text: string) => void;
  isDarkMode: boolean;
}

const EmptyStateHome: React.FC<EmptyStateHomeProps> = ({ mode, onPreFill, isDarkMode }) => {
  const { user } = useAuth();
  const userName = user?.displayName;

  const [randomGreeting] = useState(() => {
    const greetings = [
      'E aí, parceiro! Qual empresa a gente vai fuçar hoje?',
      'Bora, comandante! Qual alvo vamos investigar?',
      'Pronto pra ação! Qual empresa quer desvendar hoje?',
      'Salve, bandeirante! Quem é o alvo da vez?',
      'Tamo on! Manda o nome da empresa que eu faço o resto.',
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  });

  const displayGreeting =
    userName && userName !== 'Sair' && userName.trim().length > 0
      ? mode === 'operacao'
        ? `E aí, ${userName}! Bão? Bora vender.`
        : `Olá, ${userName}. Vamos investigar quem hoje?`
      : randomGreeting;

  const heroContent = {
    diretoria: {
      title: APP_NAME,
      subtitle: 'Inteligência comercial estratégica para contas complexas.',
    },
    operacao: {
      title: 'Modo Operação 🛻',
      subtitle: 'Inteligência forense direto ao ponto — sem rodeio, sem enrolação.',
    },
  };

  const currentHero = heroContent[mode];

  const quickActions = [
    { icon: '🔍', label: 'Investigar', desc: 'Dossiê completo', prompt: 'Investigar a empresa ' },
    { icon: '🔄', label: 'Cross-sell', desc: 'O que mais vender', prompt: 'O que consigo vender de cross na ' },
    {
      icon: '⚔️',
      label: 'Competitivo',
      desc: 'Ganhar da concorrência',
      prompt: 'Estou concorrendo contra a TOTVS na empresa ',
    },
    { icon: '📡', label: 'Radar', desc: 'Panorama do setor', prompt: 'Me dá o radar do setor de ' },
    { icon: '🔔', label: 'Alertas', desc: 'O que mudou', prompt: 'Verificar alertas e novidades da ' },
  ];

  const theme = {
    textPrimary: isDarkMode ? 'text-white' : 'text-slate-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-slate-500',
    heading: isDarkMode ? 'text-gray-500' : 'text-slate-400',
    cardBg: isDarkMode ? 'bg-gray-800/50' : 'bg-white shadow-sm',
    cardBorder: isDarkMode ? 'border-gray-700' : 'border-slate-200',
    cardHover: isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-slate-50',
    cardHoverBorder: isDarkMode ? 'hover:border-green-600' : 'hover:border-emerald-500',
    highlight: mode === 'operacao' ? 'text-orange-500' : 'text-green-500',
  };

  return (
    <div className="w-full h-full animate-fade-in pb-10">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">{mode === 'operacao' ? '🛻' : '✈️'}</div>
          <h1 className={`text-2xl font-bold mb-1 ${theme.textPrimary}`}>{currentHero.title}</h1>
          <p className={`${theme.textSecondary} text-sm`}>{currentHero.subtitle}</p>
          <p className={`${theme.highlight} font-medium text-sm mt-2`}>{displayGreeting}</p>
        </div>

        {/* Ações Rápidas */}
        <div className="mb-8">
          <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 px-1 ${theme.heading}`}>
            ✦ Por onde começar
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {quickActions.map(action => (
              <button
                key={action.label}
                onClick={() => onPreFill(action.prompt)}
                className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-3 text-left ${theme.cardHoverBorder} ${theme.cardHover} transition-all group`}
              >
                <div className="text-xl mb-1">{action.icon}</div>
                <div
                  className={`text-sm font-bold ${mode === 'operacao' ? 'group-hover:text-orange-500' : 'group-hover:text-green-500'} transition-colors ${theme.textPrimary}`}
                >
                  {action.label}
                </div>
                <div className={`text-xs ${theme.textSecondary}`}>{action.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`text-center text-xs font-bold ${theme.textSecondary} mt-6 pb-12 opacity-40 uppercase tracking-widest`}
        >
          SENIOR SCOUT 360 — INTELIGÊNCIA FORENSE
        </div>
      </div>
    </div>
  );
};

export default EmptyStateHome;
