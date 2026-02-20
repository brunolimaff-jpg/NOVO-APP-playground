import React from 'react';

interface DeepDiveTopicsProps {
  onDeepDive: (prompt: string) => void;  // AGORA: preenche input, não envia
  isDarkMode: boolean;
  empresaContext?: string | null;  // Contexto da empresa para personalizar
}

// ============================================================
// TÓPICOS DE APROFUNDAMENTO DINÂMICOS
// 4 sobre a empresa + 2 sobre Senior = 6 total
// ============================================================
const getTopics = (empresa?: string | null) => {
  const empresaNome = empresa || 'esta empresa';
  
  return [
    // ========================
    // 4 TÓPICOS SOBRE A EMPRESA
    // ========================
    {
      id: "alertas",
      category: "empresa",
      label: "🔔 Alertas Recentes",
      prompt: `Verifique alertas e novidades recentes de ${empresaNome}. Busque notícias, vagas, processos e mudanças dos últimos 30 dias. Me diga o que mudou e como usar isso na venda.`
    },
    {
      id: "tech",
      category: "empresa",
      label: "💻 Tech Stack",
      prompt: `Qual o ERP e sistemas atuais de ${empresaNome}? Investigue o stack tecnológico, nível de integração entre sistemas, e onde a Senior pode encaixar.`
    },
    {
      id: "operacao",
      category: "empresa",
      label: "🏭 Operação Logística",
      prompt: `Como funciona a operação logística de ${empresaNome}? Investigue armazéns, frota, escoamento, gargalos e onde WMS/TMS traria ganho.`
    },
    {
      id: "pessoas",
      category: "empresa",
      label: "👥 Pessoas & RH",
      prompt: `Quantos colaboradores tem ${empresaNome}? Investigue quadro de pessoal, sazonalidade, passivos trabalhistas, e onde HCM faria sentido.`
    },
    
    // ========================
    // 2 TÓPICOS SOBRE SENIOR
    // ========================
    {
      id: "senior-fit",
      category: "senior",
      label: "🏆 Fit Senior",
      prompt: `Baseado em tudo que descobrimos sobre ${empresaNome}, quais produtos Senior (ERP, HCM, GAtec, Flow) fazem mais sentido? Por quê? Seja específico com base nos dados encontrados.`
    },
    {
      id: "cases",
      label: "🤝 Cases Similares",
      prompt: `Busque clientes Senior que tenham operação similar a ${empresaNome}. Quero casos concretos de empresas do mesmo setor ou porte que usam ERP Senior, GAtec ou HCM para usar como referência de venda.`
    }
  ];
};

const DeepDiveTopics: React.FC<DeepDiveTopicsProps> = ({ onDeepDive, isDarkMode, empresaContext }) => {
  const topics = getTopics(empresaContext);

  const containerClass = isDarkMode 
    ? 'border-t border-slate-700/50' 
    : 'border-t border-slate-200';

  const titleClass = isDarkMode 
    ? 'text-slate-400' 
    : 'text-slate-500';

  // Estilo para botões de empresa
  const empresaButtonClass = isDarkMode
    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-emerald-500/50'
    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-emerald-500/50 shadow-sm';

  // Estilo para botões de Senior (destaque)
  const seniorButtonClass = isDarkMode
    ? 'bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-300 border border-emerald-700/50 hover:border-emerald-500'
    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 hover:border-emerald-400 shadow-sm';

  // Separar tópicos por categoria
  const empresaTopics = topics.filter(t => t.category === 'empresa' || !t.category);
  const seniorTopics = topics.filter(t => t.category === 'senior');

  return (
    <div className={`mt-4 pt-3 ${containerClass}`}>
      {/* Tópicos da Empresa */}
      <div className={`text-[10px] uppercase font-bold tracking-wider mb-2 ${titleClass}`}>
        🔍 Aprofundar na Empresa
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {empresaTopics.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all duration-200 hover:scale-105 ${empresaButtonClass}`}
            onClick={() => onDeepDive(t.prompt)}
            title={t.label}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tópicos Senior */}
      <div className={`text-[10px] uppercase font-bold tracking-wider mb-2 ${titleClass}`}>
        ✨ Soluções Senior
      </div>
      <div className="flex flex-wrap gap-2">
        {seniorTopics.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-105 ${seniorButtonClass}`}
            onClick={() => onDeepDive(t.prompt)}
            title={t.label}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DeepDiveTopics;
