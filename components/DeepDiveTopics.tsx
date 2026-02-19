
import React from 'react';

interface DeepDiveTopicsProps {
  onDeepDive: (prompt: string, displayText?: string) => void;
  isDarkMode: boolean;
}

const DeepDiveTopics: React.FC<DeepDiveTopicsProps> = ({ onDeepDive, isDarkMode }) => {
  const topics = [
    {
      id: "blitz",
      label: "⚡ Modo Blitz",
      preview: "Resumo rápido em 30 segundos",
      prompt: "Me dá o BLITZ desta empresa. Resumo rápido em 30 segundos: score, o que são, cliente Senior ou não, o que vender, por que agora, como abordar."
    },
    {
      id: "alertas",
      label: "🔔 Verificar Alertas",
      preview: "Alertas de mudanças recentes na empresa",
      prompt: "Verifique alertas e novidades recentes desta empresa. Busque notícias, vagas, processos e mudanças dos últimos 30 dias. Me diga o que mudou e como usar isso na venda."
    },
    {
      id: "news",
      label: "📰 News & Movimentações",  
      preview: "Notícias recentes e movimentos estratégicos",
      prompt: "Busque as últimas notícias, movimentações de mercado, M&A, expansões e mudanças regulatórias que impactam esta empresa nos últimos 90 dias. Foque em gatilhos de venda."
    },
    {
      id: "radar",
      label: "📡 Radar do Setor",
      preview: "Panorama do setor e tendências",
      prompt: "Aprofunde o RADAR DO SETOR desta empresa. Quero: (1) Mais dados macro do setor com fontes IBGE/CONAB/CEPEA dos últimos 12 meses, (2) Posicionamento competitivo detalhado — rankings, market share, comparação com top 5 do setor, (3) Todas as tendências regulatórias e tecnológicas que impactam a venda, (4) Busque clientes Senior com operação similar e me diga exatamente o que eles usam para eu usar como referência de venda."
    },
    {
      id: "juridico",
      label: "⚖️ Jurídico & Risco",
      preview: "Processos, compliance e riscos legais",
      prompt: "Aprofundar apenas o lado jurídico e de risco dessa empresa: liste processos trabalhistas, civis e ambientais relevantes, ações civis públicas, TACs, multas e condenações, explicando em bullets o risco para diretoria e como isso vira gatilho de projeto."
    },
    {
      id: "fiscal",
      label: "💰 Fiscal & Incentivos",
      preview: "Benefícios fiscais e incentivos tributários",
      prompt: "Aprofundar só o tópico fiscal e de incentivos dessa empresa: detalhe incentivos estaduais e federais, regimes especiais, créditos presumidos, multas e autos de infração, apontando onde há risco de perda de benefício e como isso cria oportunidade para ERP Senior e consultoria fiscal."
    },
    {
      id: "tech",
      label: "💻 Tecnologia & Stack",
      preview: "ERP atual, sistemas e maturidade digital",
      prompt: "Aprofundar apenas o stack tecnológico dessa empresa: mapeie ERP, WMS, TMS, HCM, BI e agritechs em uso, avalie nível de integração entre eles e a maturidade digital, e indique em bullets onde Senior + GAtec encaixam melhor vs. stack atual (sem pitch agressivo, só inteligência)."
    },
    {
      id: "integracao",
      label: "🔌 Integração & Conectividade",
      preview: "Nível de integração entre sistemas",
      prompt: "Aprofundar especificamente em integração de sistemas e conectividade: investigue problemas de 'ilhas de dados' (sistemas que não conversam), uso de planilhas para cobrir buracos de integração, desafios de conectividade no campo (offline) e como a Plataforma Senior X resolveria essa arquitetura."
    },
    {
      id: "terras",
      label: "🗺️ Terras & Ambiental",
      preview: "CAR, licenças ambientais e compliance ESG",
      prompt: "Aprofundar somente o tema terras e ambiental: detalhe situação de CAR, SIGEF, licenças ambientais, áreas embargadas ou sensíveis, tamanho e dispersão das propriedades, e traduza isso em risco ambiental/ESG e em necessidade de sistemas de rastreabilidade e governança territorial."
    },
    {
      id: "hcm",
      label: "👥 HCM, Pessoas & Sindicatos",
      preview: "Colaboradores, RH e relações trabalhistas",
      prompt: "Aprofundar apenas o tema pessoas e HCM dessa empresa: estimar número real de colaboradores (fixos, safristas e terceiros), distribuição por filiais, sindicatos e convenções relevantes, existência de certificações como GPTW ou iniciativas de clima, histórico de passivos trabalhistas, riscos com eSocial e SST, e em quais pontos um HCM Senior robusto (ponto, folha, medicina/segurança, carreira) mais blindaria a diretoria."
    },
    {
      id: "logistica",
      label: "🚛 Logística & Supply",
      preview: "Frota, frete, armazenagem e supply chain",
      prompt: "Aprofundar unicamente a parte de logística e supply chain: detalhe armazenagem, frota própria versus terceiros, uso de portos e ferrovias, gargalos de escoamento e riscos de ruptura, e indique onde uma combinação de ERP Senior com WMS, TMS e YMS traria ganho operacional."
    },
    {
      id: "manutencao",
      label: "🔧 Frotas & Manutenção",
      preview: "Gestão de frota própria e terceiros",
      prompt: "Aprofundar na gestão de ativos, frotas e manutenção: investigue o tamanho da frota (pesada e leve), custos de manutenção, oficinas próprias vs terceiras, e gargalos na gestão de pneus e combustível. Indique como o módulo de Manutenção da Senior/GAtec reduz esse custo fixo."
    },
    {
      id: "governanca",
      label: "🏛️ Governança & Grupo",
      preview: "Holdings, participações e estrutura societária",
      prompt: "Aprofundar apenas governança e grupo econômico: desenhe o grupo (holdings, principais CNPJs, sucessão familiar), identifique indícios de conflitos societários ou profissionalização em andamento, e traduza isso em demandas por consolidação, governança, BI e controles que o ERP Senior atende."
    },
    {
      id: "esg",
      label: "♻️ ESG & Sustentabilidade",
      preview: "Certificações, regeneração e rastreabilidade",
      prompt: "Aprofundar no pilar ESG e Sustentabilidade: busque relatórios de sustentabilidade, certificações (RTRS, Bonsucro, etc), projetos sociais e passivos ambientais. Conecte isso à necessidade de rastreabilidade e compliance que as soluções Senior oferecem para acesso a crédito verde e exportação."
    },
    {
      id: "internacional",
      label: "🌎 Internacional & Novasoft",
      preview: "Operações internacionais e ERP global",
      prompt: "Aprofundar na operação internacional: investigue filiais na América Latina (Colômbia, Paraguai), verifique se há duplicação de ERPs e consolidação manual (Excel). Identifique a oportunidade de vender integração nativa Senior (Brasil) + Novasoft (Colômbia) para eliminar retrabalho financeiro."
    }
  ];

  const containerClass = isDarkMode 
    ? 'border-t border-slate-700/50' 
    : 'border-t border-slate-200';

  const titleClass = isDarkMode 
    ? 'text-slate-400' 
    : 'text-slate-500';

  const buttonClass = isDarkMode
    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-emerald-500/50'
    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-emerald-500/50 shadow-sm';

  return (
    <div className={`mt-4 pt-3 ${containerClass}`}>
      <div className={`text-[10px] uppercase font-bold tracking-wider mb-2 ${titleClass}`}>
        Aprofundar Tópico
      </div>
      <div className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all duration-200 ${buttonClass}`}
            onClick={() => onDeepDive(t.prompt, t.label)}
            title={t.preview} // Agora mostra o preview curto, não o prompt técnico
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DeepDiveTopics;
