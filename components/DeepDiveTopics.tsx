import React from 'react';

interface DeepDiveTopicsProps {
  onDeepDive: (prompt: string) => void;
  isDarkMode: boolean;
  empresaContext?: string;
}

const DEEP_DIVE_OPTIONS = [
  { icon: "🚨", label: "Alertas Recentes", prompt: "Quais são as notícias e alertas mais recentes e críticos sobre esta empresa?", tooltip: "Busca notícias de impacto e movimentações recentes de mercado" },
  { icon: "💻", label: "Tech Stack", prompt: "Faça um mapeamento da infraestrutura de TI e softwares que essa empresa utiliza.", tooltip: "Mapeia ERPs concorrentes, nuvem e nível de digitalização na operação" },
  { icon: "🚚", label: "Logística", prompt: "Como funciona a operação logística, armazenagem e distribuição deles?", tooltip: "Analisa gargalos de frota, escoamento de safra e WMS" },
  { icon: "👥", label: "Pessoas & RH", prompt: "Como é a estrutura de RH, número de funcionários e cultura organizacional?", tooltip: "Tamanho da folha de pagamento e dores que o HCM resolve" },
  { icon: "🌱", label: "Sustentabilidade", prompt: "Quais as iniciativas e desafios ESG e de sustentabilidade desta empresa?", tooltip: "Certificações verdes, pegada de carbono e projetos ESG" },
  { icon: "⚖️", label: "Jurídico", prompt: "Existe algum passivo trabalhista ou ambiental relevante público sobre a empresa?", tooltip: "Varredura rápida de processos trabalhistas e embargos (ex: Ibama)" }
];

const DeepDiveTopics: React.FC<DeepDiveTopicsProps> = ({ onDeepDive, isDarkMode, empresaContext }) => {
  return (
    <div className={`mt-4 pt-4 border-t border-dashed ${isDarkMode ? 'border-gray-700/50' : 'border-gray-200'} animate-fade-in`}>
      <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-3 ${isDarkMode ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>
        🔍 Aprofundar na Empresa {empresaContext ? `(${empresaContext})` : ''}
      </span>
      <div className="flex flex-wrap gap-2">
        {DEEP_DIVE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onDeepDive(opt.prompt)}
            title={opt.tooltip} // <-- Aqui está o explicativo ao passar o mouse
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all shadow-sm border active:scale-95 ${
              isDarkMode 
                ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-emerald-500 hover:bg-slate-800' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
            }`}
          >
            <span className="text-sm">{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DeepDiveTopics;
