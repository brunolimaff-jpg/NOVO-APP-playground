import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChatMode, APP_NAME } from '../constants';

interface EmptyStateHomeProps {
  mode: ChatMode;
  onSendMessage: (text: string) => void;
  onPreFill: (text: string) => void;
  isDarkMode: boolean;
}

const EmptyStateHome: React.FC<EmptyStateHomeProps> = ({ mode, onSendMessage, onPreFill, isDarkMode }) => {
  const { user } = useAuth();
  const userName = user?.displayName;

  const [randomGreeting] = useState(() => {
    const greetings = [
      "E aí, parceiro! Qual empresa a gente vai fuçar hoje?",
      "Bora, comandante! Qual alvo vamos investigar?",
      "Pronto pra ação! Qual empresa quer desvendar hoje?",
      "Salve, bandeirante! Quem é o alvo da vez?",
      "Tamo on! Manda o nome da empresa que eu faço o resto.",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  });

  const displayGreeting = (userName && userName !== 'Sair' && userName.trim().length > 0)
    ? (mode === 'operacao' ? `E aí, ${userName}! Bão? Bora vender.` : `Olá, ${userName}. Vamos investigar quem hoje?`)
    : randomGreeting;

  const heroContent = {
    diretoria: {
      title: APP_NAME,
      subtitle: "Inteligência comercial estratégica para contas do agronegócio.",
    },
    operacao: {
      title: "Modo Operação 🛻",
      subtitle: "Inteligência comercial direto ao ponto — sem rodeio, sem enrolação.",
    }
  };

  const currentHero = heroContent[mode];

  const quickActions = [
    { icon: "⚡", label: "Blitz", desc: "Dossiê rápido em 30s", prompt: "Blitz do Grupo " },
    { icon: "🔍", label: "Investigar", desc: "Dossiê completo", prompt: "Investigar a empresa " },
    { icon: "🔄", label: "Cross-sell", desc: "O que mais vender", prompt: "O que consigo vender de cross na " },
    { icon: "⚔️", label: "Competitivo", desc: "Ganhar da concorrência", prompt: "Estou concorrendo contra a TOTVS na empresa " },
    { icon: "📡", label: "Radar", desc: "Panorama do setor", prompt: "Me dá o radar do setor de " },
    { icon: "🔔", label: "Alertas", desc: "O que mudou", prompt: "Verificar alertas e novidades da " },
  ];

  // 6 sugestões organizadas por categoria
  const suggestionCategories = {
    investigar: mode === 'operacao' ? [
      { icon: "🤠", text: "Levanta a capivara completa do Grupo Scheffer" },
      { icon: "💸", text: "Onde a COFCO está perdendo eficiência logística?" },
    ] : [
      { icon: "🏢", text: "Investigar Grupo Amaggi com foco em riscos" },
      { icon: "🏭", text: "Mapear dores operacionais em usina de etanol" },
    ],
    concorrente: [
      { icon: "⚔️", text: "Compare TOTVS vs Senior para esse perfil" },
      { icon: "🎯", text: "Onde a CHB perde para GAtec em usinas?" },
    ],
    senior: [
      { icon: "✨", text: "Como o ERP Senior melhoraria essa operação?" },
      { icon: "🌱", text: "Quais módulos GAtec são ideais e por quê?" },
    ],
    budget: [
      { icon: "💰", text: "Qual o budget para implementação completa?" },
      { icon: "📊", text: "Qual o ROI potencial em 12 meses?" },
    ],
  };

  const steps = [
    { num: "1", icon: "💬", title: "Fala a empresa", desc: "Nome, CNPJ ou descreve a situação." },
    { num: "2", icon: "🔎", title: "Scout investiga", desc: "Puxa dados fiscais, societários, tech e cruza com base Senior." },
    { num: "3", icon: "🎯", title: "Você recebe o dossiê", desc: "Score, gaps de cross-sell e script de abordagem." },
    { num: "4", icon: "🔬", title: "Aprofunda", desc: "Use os botões de drill-down para detalhar." },
  ];

  const theme = {
    textPrimary: isDarkMode ? 'text-white' : 'text-slate-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-slate-500',
    heading: isDarkMode ? 'text-gray-500' : 'text-slate-400',
    cardBg: isDarkMode ? 'bg-gray-800/50' : 'bg-white shadow-sm',
    cardBorder: isDarkMode ? 'border-gray-700' : 'border-slate-200',
    cardHover: isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-slate-50',
    cardHoverBorder: isDarkMode ? 'hover:border-green-600' : 'hover:border-emerald-500',
    exampleBg: isDarkMode ? 'bg-gray-800/30' : 'bg-slate-50',
    exampleBorder: isDarkMode ? 'border-gray-700/50' : 'border-slate-200',
    exampleHover: isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-slate-100',
    tutorialBg: isDarkMode ? 'bg-gray-800/30' : 'bg-slate-50',
    tutorialBorder: isDarkMode ? 'border-gray-800' : 'border-slate-200',
    checkBg: isDarkMode ? 'bg-green-900/10' : 'bg-emerald-50',
    checkBorder: isDarkMode ? 'border-green-900/30' : 'border-emerald-100',
    crossBg: isDarkMode ? 'bg-red-900/10' : 'bg-red-50',
    crossBorder: isDarkMode ? 'border-red-900/30' : 'border-red-100',
    highlight: mode === 'operacao' ? 'text-orange-500' : 'text-green-500'
  };

  return (
    <div className="flex-1 overflow-auto animate-fade-in custom-scrollbar">
      <div className="max-w-3xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">{mode === 'operacao' ? '🛻' : '✈️'}</div>
          <h1 className={`text-2xl font-bold mb-1 ${theme.textPrimary}`}>
            {currentHero.title}
          </h1>
          <p className={`${theme.textSecondary} text-sm`}>
            {currentHero.subtitle}
          </p>
          <p className={`${theme.highlight} font-medium text-sm mt-2`}>
            {displayGreeting}
          </p>
        </div>

        {/* Card PORTA */}
        <div className={`w-full max-w-2xl mx-auto mb-8 rounded-2xl border p-5 md:p-6 ${
          isDarkMode 
            ? 'bg-slate-900/50 border-emerald-500/20' 
            : 'bg-white border-emerald-200'
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🎯</span>
            <h3 className={`text-sm font-bold uppercase tracking-wider ${
              isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
            }`}>
              Metodologia P.O.R.T.A.
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
            }`}>
              Score 0–100
            </span>
          </div>

          <p className={`text-xs mb-4 leading-relaxed ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}>
            Como avaliamos a compatibilidade de cada conta:
          </p>

          <div className="space-y-2.5 mb-5">
            {[
              { letter: 'P', label: 'Porte Real', desc: 'Estrutura societária + hectares' },
              { letter: 'O', label: 'Operação', desc: 'Verticalização e complexidade' },
              { letter: 'R', label: 'Retorno', desc: 'Risco fiscal e custo do erro' },
              { letter: 'T', label: 'Tecnologia', desc: 'Integração e conectividade' },
              { letter: 'A', label: 'Adoção', desc: 'Governança, sponsor e mudança' },
            ].map(({ letter, label, desc }) => (
              <div key={letter} className="flex items-center gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {letter}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-semibold ${
                    isDarkMode ? 'text-white' : 'text-slate-800'
                  }`}>
                    {label}
                  </span>
                  <span className={`text-xs ml-2 ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {desc}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            <div className="flex-1 text-center py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs font-bold text-red-400">0 — 40</p>
              <p className="text-[10px] text-red-400/70">Baixa</p>
            </div>
            <div className="flex-1 text-center py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs font-bold text-yellow-400">41 — 70</p>
              <p className="text-[10px] text-yellow-400/70">Média</p>
            </div>
            <div className="flex-1 text-center py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs font-bold text-emerald-400">71 — 100</p>
              <p className="text-[10px] text-emerald-400/70">Alta</p>
            </div>
          </div>

          <p className={`text-[11px] text-center italic ${
            isDarkMode ? 'text-slate-500' : 'text-slate-400'
          }`}>
            "Não é o tamanho que define o fit, é a complexidade."
          </p>
        </div>

        {/* Ações Rápidas */}
        <div className="mb-8">
          <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 px-1 ${theme.heading}`}>
            ⚡ Ação Rápida
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => onPreFill(action.prompt)}
                className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-3 text-left ${theme.cardHoverBorder} ${theme.cardHover} transition-all group`}
              >
                <div className="text-xl mb-1">{action.icon}</div>
                <div className={`text-sm font-bold group-hover:${mode === 'operacao' ? 'text-orange-500' : 'text-green-500'} transition-colors ${theme.textPrimary}`}>
                  {action.label}
                </div>
                <div className={`text-xs ${theme.textSecondary}`}>{action.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sugestões por Categoria (Corrigido para onPreFill) */}
        <div className="mb-8">
          <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 px-1 ${theme.heading}`}>
            💡 Sugestões
          </h2>
          
          <div className="space-y-2 mb-3">
            {[...suggestionCategories.investigar, ...suggestionCategories.concorrente].map((ex, i) => (
              <button
                key={i}
                // 👉 AQUI FOI CORRIGIDO: Agora ele preenche em vez de enviar!
                onClick={() => onPreFill(ex.text)}
                className={`w-full ${theme.exampleBg} border ${theme.exampleBorder} rounded-xl px-4 py-3 text-left ${theme.cardHoverBorder} ${theme.exampleHover} transition-all flex items-center gap-3 group`}
              >
                <span className="text-xl flex-shrink-0">{ex.icon}</span>
                <span className={`text-sm ${theme.textSecondary} group-hover:${theme.textPrimary} transition-colors`}>
                  "{ex.text}"
                </span>
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[...suggestionCategories.senior, ...suggestionCategories.budget].map((ex, i) => (
              <button
                key={i}
                // 👉 AQUI FOI CORRIGIDO TAMBÉM!
                onClick={() => onPreFill(ex.text)}
                className={`${theme.exampleBg} border ${theme.exampleBorder} rounded-xl px-4 py-3 text-left ${theme.cardHoverBorder} ${theme.exampleHover} transition-all flex items-center gap-2 group`}
              >
                <span className="text-lg flex-shrink-0">{ex.icon}</span>
                <span className={`text-xs ${theme.textSecondary} group-hover:${theme.textPrimary} transition-colors`}>
                  "{ex.text}"
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Mini Tutorial */}
        <div className="mb-8">
          <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 px-1 ${theme.heading}`}>
            📖 Como funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {steps.map((step) => (
              <div
                key={step.num}
                className={`${theme.tutorialBg} border ${theme.tutorialBorder} rounded-xl p-3`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`${mode === 'operacao' ? 'bg-orange-600' : 'bg-green-600'} text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0`}>
                    {step.num}
                  </span>
                  <span className={`text-sm font-bold ${theme.textPrimary}`}>{step.title}</span>
                  <span className="text-lg">{step.icon}</span>
                </div>
                <p className={`text-xs ${theme.textSecondary} ml-7`}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* O que faz vs não faz */}
        <div className="mb-8">
          <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 px-1 ${theme.heading}`}>
            ℹ️ O que o Scout faz e não faz
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`${theme.checkBg} border ${theme.checkBorder} rounded-xl p-3`}>
              <div className="text-sm font-bold text-green-500 mb-2">✅ Faz</div>
              <ul className={`text-xs ${theme.textSecondary} space-y-1.5`}>
                <li>🔍 Investiga em 10 fases (fiscal, gente, tech, risco...)</li>
                <li>🏭 Cruza com a base de clientes Senior</li>
                <li>⚔️ Monta estratégia contra concorrência</li>
                <li>🎯 Calcula score de oportunidade</li>
                <li>📞 Gera script de abordagem</li>
                <li>📡 Identifica tendências e benchmark</li>
              </ul>
            </div>
            <div className={`${theme.crossBg} border ${theme.crossBorder} rounded-xl p-3`}>
              <div className="text-sm font-bold text-red-500 mb-2">❌ Não faz</div>
              <ul className={`text-xs ${theme.textSecondary} space-y-1.5`}>
                <li>🚫 Não inventa dados — se não acha, avisa</li>
                <li>🚫 Não chuta nome de executivo sem fonte</li>
                <li>🚫 Não usa argumentos genéricos</li>
                <li>🚫 Não substitui a visita presencial</li>
                <li>🚫 Não acessa dados sigilosos internos</li>
                <li>🚫 Não gera proposta comercial oficial</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`text-center text-xs ${theme.textSecondary} mt-4 pb-4 opacity-50`}>
          Senior Scout 360 — v4.7
        </div>

      </div>
    </div>
  );
};

export default EmptyStateHome;
