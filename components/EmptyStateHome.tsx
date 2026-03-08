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

  const godModeExamples = [
    { icon: '🤠', text: 'Levanta a capivara completa do Grupo Scheffer' },
    { icon: '🚛', text: 'Onde a COFCO está perdendo eficiência logística?' },
    { icon: '🕸️', text: 'Mapeie a teia societária e holdings do Grupo Amaggi' },
    { icon: '💻', text: 'Qual ERP e sistema de DP a Raízen usa atualmente?' },
    { icon: '🚨', text: 'Rastreie multas no MPT e risco FAP/RAT da BP Bunge' },
    { icon: '🩸', text: 'Busque risco de malha fina de LCDPR nos sócios da Bom Futuro' },
    { icon: '🌍', text: 'Analise o risco de embargo ambiental (EUDR) na SLC Agrícola' },
    { icon: '⚔️', text: 'Como tirar a TOTVS e o Secullum da operação da São Martinho?' },
  ];

  const theme = {
    textPrimary: isDarkMode ? 'text-white' : 'text-slate-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-slate-500',
    heading: isDarkMode ? 'text-gray-500' : 'text-slate-400',
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

        {/* Arsenal de Sugestões */}
        <div className="mb-8">
          <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 px-1 ${theme.heading}`}>
            💡 Arsenal de Sugestões
          </h2>
          <div className="space-y-2">
            {godModeExamples.map((ex, i) => (
              <button
                key={i}
                onClick={() => onPreFill(ex.text)}
                className={`w-full ${isDarkMode ? 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800/60' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'} border rounded-xl px-4 py-3 text-left ${theme.cardHoverBorder} transition-all flex items-center gap-3 group`}
              >
                <span className="text-xl flex-shrink-0">{ex.icon}</span>
                <span className={`text-sm font-medium ${theme.textSecondary} transition-colors`}>
                  "{ex.text}"
                </span>
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
