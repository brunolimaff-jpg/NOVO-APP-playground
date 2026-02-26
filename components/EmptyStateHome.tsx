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
      subtitle: "Inteligência comercial estratégica para contas complexas.",
    },
    operacao: {
      title: "Modo Operação 🛻",
      subtitle: "Inteligência forense direto ao ponto — sem rodeio, sem enrolação.",
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

  // As 8 sugestões Lethal God Mode com os maiores alvos do mercado
  const suggestionCategories = {
    linha1: [
      { icon: "🤠", text: "Levanta a capivara completa do Grupo Scheffer" },
      { icon: "🚛", text: "Onde a COFCO está perdendo eficiência logística?" },
    ],
    linha2: [
      { icon: "🕸️", text: "Mapeie a teia societária e holdings do Grupo Amaggi" },
      { icon: "💻", text: "Qual ERP e sistema de DP a Raízen usa atualmente?" },
    ],
    linha3: [
      { icon: "🚨", text: "Rastreie multas no MPT e risco FAP/RAT da BP Bunge" },
      { icon: "🩸", text: "Busque risco de malha fina de LCDPR nos sócios da Bom Futuro" },
    ],
    linha4: [
      { icon: "🌍", text: "Analise o risco de embargo ambiental (EUDR) na SLC Agrícola" },
      { icon: "⚔️", text: "Como tirar a TOTVS e o Secullum da operação da São Martinho?" },
    ],
  };

  const steps = [
    { num: "1", icon: "🎯", title: "O Alvo", desc: "Digite o nome do grupo, CNPJ ou descreva o cenário." },
    { num: "2", icon: "🔍", title: "A Varredura", desc: "O Scout cruza web search, diários oficiais, QSA, IBAMA e vagas." },
    { num: "3", icon: "🧠", title: "A Inteligência", desc: "Você recebe a teia de CNPJs, a pilha de software atual e o passivo financeiro." },
    { num: "4", icon: "⚡", title: "O Ataque", desc: "Use os botões de Dossiê para gerar a argumentação letal pro C-Level." },
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
    <div className="w-full h-full animate-fade-in pb-10">
      <div className="max-w-3xl mx-auto px-4 pt-4 md:pt-8">
        
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
          isDarkMode ? 'bg-slate-900/50 border-emerald-500/20' : 'bg-white border-emerald-200'
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🎯</span>
            <h3 className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Metodologia P.O.R.T.A.
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              Score 0–100
            </span>
          </div>
          <p className={`text-xs mb-4 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
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
                  <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{label}</span>
                  <span className={`text-xs ml-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{desc}</span>
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
          <p className={`text-[11px] text-center italic ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
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
                <div className={`text-sm font-bold ${mode === 'operacao' ? 'group-hover:text-orange-500' : 'group-hover:text-green-500'} transition-colors ${theme.textPrimary}`}>
                  {action.label}
                </div>
                <div className={`text-xs ${theme.textSecondary}`}>{action.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sugestões God Mode */}
        <div className="mb-8">
          <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 px-1 ${theme.heading}`}>
            💡 Arsenal de Sugestões
          </h2>
          <div className="space-y-2">
            {[...suggestionCategories.linha1, ...suggestionCategories.linha2, ...suggestionCategories.linha3, ...suggestionCategories.linha4].map((ex, i) => (
              <button
                key={i}
                onClick={() => onPreFill(ex.text)}
                className={`w-full ${theme.exampleBg} border ${theme.exampleBorder} rounded-xl px-4 py-3 text-left ${theme.cardHoverBorder} ${theme.exampleHover} transition-all flex items-center gap-3 group`}
              >
                <span className="text-xl flex-shrink-0">{ex.icon}</span>
                <span className={`text-sm font-medium ${theme.textSecondary} group-hover:${theme.textPrimary} transition-colors`}>
                  "{ex.text}"
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Como funciona */}
        <div className="mb-8">
          <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 px-1 ${theme.heading}`}>
            📖 Como funciona o OSINT
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {steps.map((step) => (
              <div key={step.num} className={`${theme.tutorialBg} border ${theme.tutorialBorder} rounded-xl p-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`${mode === 'operacao' ? 'bg-orange-600' : 'bg-green-600'} text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0`}>
                    {step.num}
                  </span>
                  <span className={`text-sm font-bold ${theme.textPrimary}`}>{step.title}</span>
                  <span className="text-base">{step.icon}</span>
                </div>
                <p className={`text-xs leading-relaxed ${theme.textSecondary} ml-6`}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* O que faz vs não faz */}
        <div className="mb-8">
          <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 px-1 ${theme.heading}`}>
            ℹ️ Limites da Plataforma
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`${theme.checkBg} border ${theme.checkBorder} rounded-xl p-4`}>
              <div className="text-sm font-bold text-green-600 dark:text-green-500 mb-3 flex items-center gap-2">
                ✅ Superpoderes Ativos
              </div>
              <ul className={`text-xs ${theme.textSecondary} space-y-2`}>
                <li><strong className={theme.textPrimary}>🕸️ Teia Societária:</strong> Mapeia holdings, laranjas e matrizes cruzadas em até 3 camadas.</li>
                <li><strong className={theme.textPrimary}>💻 Pilha Tech:</strong> Rastreia o software atual (ERP/HR) via vagas e vazamentos.</li>
                <li><strong className={theme.textPrimary}>🚨 Passivo Oculto:</strong> Expõe dívida ativa, FAP/RAT, multas do MPT e Lista Suja.</li>
                <li><strong className={theme.textPrimary}>🌐 Deep Research:</strong> Acesso em tempo real à internet e cruzamento de bases.</li>
              </ul>
            </div>
            <div className={`${theme.crossBg} border ${theme.crossBorder} rounded-xl p-4`}>
              <div className="text-sm font-bold text-red-600 dark:text-red-500 mb-3 flex items-center gap-2">
                ❌ Limites Éticos (Guardrails)
              </div>
              <ul className={`text-xs ${theme.textSecondary} space-y-2`}>
                <li><strong className={theme.textPrimary}>🚫 Alucinação Zero:</strong> Não inventa CNPJs. Se não achar na web pública, ele avisa.</li>
                <li><strong className={theme.textPrimary}>🚫 Sigilo:</strong> Não invade painéis sob senha, sistemas fechados ou contas bancárias.</li>
                <li><strong className={theme.textPrimary}>🚫 Fator Humano:</strong> Não substitui o relacionamento e a leitura de cenário do Executivo.</li>
                <li><strong className={theme.textPrimary}>🚫 LGPD:</strong> Não quebra privacidade buscando dados médicos ou sensíveis de pessoas físicas.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`text-center text-xs font-bold ${theme.textSecondary} mt-6 pb-12 opacity-40 uppercase tracking-widest`}>
          SENIOR SCOUT 360 — INTELIGÊNCIA FORENSE
        </div>

      </div>
    </div>
  );
};

export default EmptyStateHome;
