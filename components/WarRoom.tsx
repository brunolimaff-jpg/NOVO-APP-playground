import React, { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import LoadingSmart from './LoadingSmart';
import { ChatMode } from '../constants';

interface WarRoomProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onExecuteOSINT: (prompt: string) => Promise<string>;
}

type TabType = 'forense' | 'divida' | 'sangria' | 'sparring';

// Lista de Inimigos Estratégicos (Mapeada por Segmento para a Senior)
const COMPETITORS = [
  // ERP & Agro
  'TOTVS', 'Sankhya', 'SAP', 'Aliare', 'Agrotis', 'CHB', 'Oracle', 'Liberali (Franquia)',
  // HCM & HR Tech
  'LG Lugar de Gente', 'Sólides', 'Metadados', 'Apdata', 'ADP', 'Gupy',
  // Logística & WMS/TMS
  'Intelipost', 'routEasy', 'Cobli', 'Lincros'
];

const SEGMENTS = ['ERP', 'HCM', 'Gestão de Campo', 'Logística'];

export default function WarRoom({ isOpen, onClose, isDarkMode, onExecuteOSINT }: WarRoomProps) {
  const [target, setTarget] = useState<string>('TOTVS');
  const [segment, setSegment] = useState<string>('ERP');
  const [activeTab, setActiveTab] = useState<TabType>('forense');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [sparringInput, setSparringInput] = useState('');

  // =======================================================================
  // A DOUTRINA COMERCIAL (INJEÇÃO DE COMPORTAMENTO SNIPER NO DEEP RESEARCH)
  // =======================================================================
  const SALES_FORMAT = `
  ⚠️ REGRAS DESTRUTIVAS DE FORMATAÇÃO COMERCIAL (OBRIGATÓRIO):
  Você é um Diretor de Inteligência Competitiva armando um Vendedor Enterprise. 
  Não escreva como um analista passivo. Escreva como um predador corporativo.
  
  O formato da sua resposta DEVE SER EXATAMENTE ESTE (Use Markdown):
  
  ### 🚨 O SANGRAMENTO (A Fraqueza Descoberta)
  [Bullets curtos e grossos com o dado OSINT exato encontrado. Cite os nomes, as tecnologias velhas, os processos judiciais, os vazamentos].
  
  ### 💥 O IMPACTO (A Dor no Caixa do Cliente)
  [Traduza o problema técnico para risco de negócio. Como essa falha da ${target} gera multa, perda de safra, processos trabalhistas ou atraso no go-live?].
  
  ### 🔪 COMO ATACAR (Script de Vendas)
  [Escreva EXATAMENTE 1 parágrafo em primeira pessoa com a pergunta espinhosa e tática que o nosso vendedor da Senior Sistemas vai fazer na mesa para desestabilizar a confiança do cliente na ${target}].
  `;

  // Prompts com Dorks (Comandos Avançados de Busca)
  const osintModules = {
    forense: [
      { id: 'pricing', icon: '💰', title: 'Caça de Propostas Vazadas', desc: `Procura PDFs de orçamentos e mapeia os custos ocultos de ${segment}.`, 
        prompt: `Execute OSINT Forense de Pricing para: ${target} (${segment}). Use obrigatoriamente dorks avançados: (site:scribd.com OR site:docdroid.net OR site:slideshare.net) AND "${target}" AND ("proposta comercial" OR "orçamento" OR "TCO" OR "implantação"). Se não achar valores exatos, identifique onde eles escondem taxas extras (ex: customizações não inclusas). ${SALES_FORMAT}` },
      
      { id: 'jusbrasil', icon: '⚖️', title: 'Litígios e Inexecução (Tribunais)', desc: `Mergulha no Jusbrasil caçando clientes que processaram o sistema por falha.`,
        prompt: `Pesquise minuciosamente jurisprudência no Jusbrasil: "${target}" AND ("inexecução contratual" OR "falha na implantação" OR "lucros cessantes" OR "rescisão"). Foco em clientes do Agro, RH ou Logística que processaram a ${target} recentemente. Extraia a gravidade técnica da falha que gerou o processo. ${SALES_FORMAT}` },
      
      { id: 'cvm', icon: '🏦', title: 'Risco de Franquia e M&A', desc: 'Mapeia se a empresa é uma matriz sólida ou uma franquia instável que vai sumir.',
        prompt: `Analise o risco societário da ${target} no segmento de ${segment}. Eles operam no modelo de Franquia (pulverizando a responsabilidade legal)? Eles dependem de sistemas terceiros (ex: são apenas um Add-on pendurado no SAP)? Use isso para provar que assinar com eles é um risco jurídico para o cliente. ${SALES_FORMAT}` }
    ],
    divida: [
      { id: 'bugs', icon: '🦠', title: 'Fóruns de Devs e Shadow IT', desc: `O que os desenvolvedores escondem que o marketing promete entregando.`,
        prompt: `Faça OSINT em fóruns técnicos obscuros (GitHub/StackOverflow/Telegram) e ReclameAqui para ${target} (${segment}). Quais são as gambiarras (Shadow IT) que os clientes precisam fazer na mão? A integração cai? O banco trava no fechamento contábil/folha? ${SALES_FORMAT}` },
      
      { id: 'vaporware', icon: '👻', title: 'O Falso Nativo (Tecnologia Morta)', desc: `Prova se o sistema é próprio, em nuvem real ou tecnologia morta (ex: Delphi).`,
        prompt: `Investigue a arquitetura real da ${target} para ${segment}. A tecnologia base deles é antiga (ex: AdvPL, Delphi, Visual Basic)? Eles vendem "Nuvem", mas na verdade exigem servidores locais remotos (falso SaaS)? Detone a escalabilidade dessa arquitetura. ${SALES_FORMAT}` },
      
      { id: 'frankenstein', icon: '🧟', title: 'Efeito Frankenstein', desc: `Mapeia se o módulo tem bancos de dados separados porque compraram startups.`,
        prompt: `Pesquise se a ${target} construiu a solução nativa de ${segment} ou se comprou outras empresas (M&A) e apenas colocou o logo por cima. Como provar para o cliente que os módulos deles não se conversam de verdade, dobrando o custo de manutenção? ${SALES_FORMAT}` }
    ],
    sangria: [
      { id: 'vagas', icon: '🕵️', title: 'Sangria de Consultores Sêniores', desc: `Se eles perdem talentos, o projeto do seu cliente vai afundar.`,
        prompt: `Analise o Glassdoor e LinkedIn da ${target}. A equipe de implantação de ${segment} está debandando? Eles têm vagas abertas em desespero para júnior? Use reviews para provar "cultura tóxica" que fatalmente vai estourar no prazo de entrega do projeto do cliente. ${SALES_FORMAT}` },
      
      { id: 'churn', icon: '📉', title: 'O Ralo de Clientes (Churn Silencioso)', desc: `Grandes empresas que desligaram o sistema deles sem avisar o mercado.`,
        prompt: `Varra as notícias de TI, Agro e RH (Exame, Valor, NeoFeed, fóruns). Quais grandes clientes migraram recentemente e substituíram o sistema da ${target} de ${segment}? Se os casos forem sigilosos, qual o perfil de cliente que geralmente abandona essa ferramenta e por qual frustração principal? ${SALES_FORMAT}` }
    ]
  };

  const handleRunOSINT = async (moduleId: string, title: string, prompt: string) => {
    setLoadingAction(moduleId);
    try {
      const result = await onExecuteOSINT(prompt);
      setResults(prev => ({ ...prev, [moduleId]: result }));
    } catch (error) {
      setResults(prev => ({ ...prev, [moduleId]: '⚠️ **Falha Tática:** A varredura profunda falhou ou foi bloqueada. Revise a chave de API ou tente novamente em alguns segundos.' }));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSparring = async () => {
    if (!sparringInput.trim()) return;
    const moduleId = 'sparring-chat';
    setLoadingAction(moduleId);
    const prompt = `Você é o Diretor de Vendas Sênior da Senior Sistemas. Estamos disputando a conta contra a ${target} no módulo de ${segment}. 
    O cliente, iludido, acabou de me dizer a seguinte objeção baseada no pitch comercial deles: "${sparringInput}". 
    
    Me entregue imediatamente um "Kill Script" (Roteiro de Abate) em primeira pessoa, para eu falar agora na reunião. 
    Desmonte a mentira da ${target}, use gatilhos de medo (Risco, TCO oculto, Falha de SLA) e reverta a situação para o valor unificado da Senior. Seja frio, polido, mas letal.`;
    
    try {
      const result = await onExecuteOSINT(prompt);
      setResults(prev => ({ ...prev, [moduleId]: result }));
      setSparringInput('');
    } catch (error) {
      setResults(prev => ({ ...prev, [moduleId]: '⚠️ Ocorreu um erro ao gerar o roteiro de combate.' }));
    } finally {
      setLoadingAction(null);
    }
  };

  if (!isOpen) return null;

  const themeBg = isDarkMode ? 'bg-slate-950' : 'bg-slate-50';
  const panelBg = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textMain = isDarkMode ? 'text-white' : 'text-slate-900';
  const textMuted = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-md animate-fade-in">
      <div className={`w-full max-w-2xl h-full flex flex-col shadow-2xl ${themeBg} border-l border-red-900/40 transform transition-transform duration-300`}>
        
        {/* HEADER WAR ROOM */}
        <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'bg-red-950/30 border-red-900/50' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl filter drop-shadow-md">⚔️</span>
            <div>
              <h2 className={`font-black uppercase tracking-widest text-sm ${isDarkMode ? 'text-red-500' : 'text-red-700'}`}>The War Room</h2>
              <p className={`text-[10px] uppercase font-bold tracking-widest ${isDarkMode ? 'text-red-400/50' : 'text-red-800/50'}`}>Sistema de Inteligência Tática</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors">✕</button>
        </div>

        {/* SELETORES DE ATAQUE (Target & Segment) */}
        <div className={`p-4 border-b flex gap-4 ${panelBg}`}>
          <div className="flex-1">
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${textMuted}`}>Alvo (Inimigo):</label>
            <select 
              value={target} 
              onChange={(e) => setTarget(e.target.value)}
              className={`w-full p-3 rounded-lg border text-sm font-bold outline-none focus:border-red-500 transition-colors cursor-pointer appearance-none ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {COMPETITORS.map(comp => <option key={comp} value={comp}>{comp}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${textMuted}`}>Campo de Batalha:</label>
            <select 
              value={segment} 
              onChange={(e) => setSegment(e.target.value)}
              className={`w-full p-3 rounded-lg border text-sm font-bold outline-none focus:border-blue-500 transition-colors cursor-pointer appearance-none ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-300 text-blue-800'
              }`}
            >
              {SEGMENTS.map(seg => <option key={seg} value={seg}>{seg}</option>)}
            </select>
          </div>
        </div>

        {/* NAVEGAÇÃO DAS CÂMARAS */}
        <div className="flex border-b overflow-x-auto custom-scrollbar">
          {[
            { id: 'forense', icon: '🩸', label: 'Dossiê Forense' },
            { id: 'divida', icon: '🧟', label: 'Dívida Técnica' },
            { id: 'sangria', icon: '📉', label: 'Sangria de Mercado' },
            { id: 'sparring', icon: '🥊', label: 'Sparring Mode' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-red-500 text-red-500 bg-red-500/5' 
                  : `border-transparent ${textMuted} hover:text-red-400 hover:bg-slate-800/30`
              }`}
            >
              <span className="text-lg">{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* CONTEÚDO DINÂMICO (Os Cards de OSINT) */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
          {activeTab !== 'sparring' && (
            <>
              <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-blue-900/10 border-blue-900/30 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-800'} text-xs font-medium mb-2`}>
                ℹ️ Gerando dossiês contra a <strong>{target}</strong> especificamente nas fragilidades de <strong>{segment}</strong>.
              </div>

              {osintModules[activeTab as keyof typeof osintModules].map(mod => (
                <div key={mod.id} className={`rounded-xl border shadow-sm overflow-hidden ${panelBg}`}>
                  <div className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <span className="text-3xl filter drop-shadow-sm">{mod.icon}</span>
                        <div>
                          <h3 className={`font-black text-sm uppercase tracking-wide ${textMain}`}>{mod.title}</h3>
                          <p className={`text-xs mt-1.5 leading-relaxed ${textMuted}`}>{mod.desc}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRunOSINT(mod.id, mod.title, mod.prompt)}
                        disabled={loadingAction !== null}
                        className={`w-full md:w-auto px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0 transition-all ${
                          loadingAction === mod.id 
                            ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white border border-red-500/20'
                        }`}
                      >
                        {loadingAction === mod.id ? 'HACKEANDO...' : 'EXECUTAR OSINT'}
                      </button>
                    </div>
                  </div>

                  {/* LOADING INTEGRADOR (O mesmo visual do chat) */}
                  {loadingAction === mod.id && (
                    <div className={`p-5 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                      <LoadingSmart 
                        isLoading={true} 
                        mode={'diretoria' as ChatMode} 
                        isDarkMode={isDarkMode} 
                        searchQuery={target}
                        processing={{ 
                          stage: `Varredura Profunda (Deep Research) em ${target} - ${segment}...`, 
                          completedStages: ["Infiltrando bases de dados", "Quebrando dorks em PDFs"] 
                        }}
                      />
                    </div>
                  )}

                  {/* RESULTADOS DA PESQUISA (Kill Sheet Formatted) */}
                  {results[mod.id] && loadingAction !== mod.id && (
                    <div className={`p-6 border-t ${isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <MarkdownRenderer content={results[mod.id]} isDarkMode={isDarkMode} showCollapsibleSources={true} />
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* SPARRING MODE (Chat de Objeções) */}
          {activeTab === 'sparring' && (
            <div className="h-full flex flex-col gap-4">
              <div className={`flex-1 rounded-xl border p-5 overflow-y-auto shadow-inner ${panelBg}`}>
                {loadingAction === 'sparring-chat' && (
                  <div className="mb-4">
                    <LoadingSmart 
                      isLoading={true} 
                      mode={'diretoria' as ChatMode} 
                      isDarkMode={isDarkMode} 
                      searchQuery={target}
                      processing={{ stage: `Forjando Roteiro de Combate contra ${target}...`, completedStages: [] }}
                    />
                  </div>
                )}
                
                {results['sparring-chat'] && loadingAction !== 'sparring-chat' ? (
                  <div className="animate-fade-in">
                    <MarkdownRenderer content={results['sparring-chat']} isDarkMode={isDarkMode} showCollapsibleSources={false} />
                  </div>
                ) : !loadingAction && (
                  <div className="h-full flex flex-col items-center justify-center opacity-40 text-center p-8">
                    <span className="text-7xl mb-6 filter drop-shadow-md">🥊</span>
                    <p className="text-base font-black uppercase tracking-widest text-red-500 mb-2">Simulador de Objeções</p>
                    <p className="text-xs max-w-xs leading-relaxed font-medium">O cliente jogou o preço da <strong>{target}</strong> na mesa? Ou disse que o <strong>{segment}</strong> deles é melhor? Digite a mentira abaixo e receba a resposta para fechar o negócio.</p>
                  </div>
                )}
              </div>
              
              <div className={`flex items-end gap-3 p-3 rounded-xl border shadow-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}>
                <textarea
                  value={sparringInput}
                  onChange={(e) => setSparringInput(e.target.value)}
                  placeholder={`"A ${target} disse que o módulo fiscal do ${segment} já atende a reforma tributária e tá metade do preço..."`}
                  className="flex-1 bg-transparent p-3 text-sm font-medium outline-none resize-none max-h-32 custom-scrollbar placeholder-slate-500"
                  rows={2}
                />
                <button 
                  onClick={handleSparring}
                  disabled={!sparringInput.trim() || loadingAction !== null}
                  className={`p-4 rounded-xl transition-all font-black text-xs uppercase tracking-wider flex-shrink-0 mb-1 ${
                    !sparringInput.trim() || loadingAction !== null
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                  }`}
                >
                  {loadingAction === 'sparring-chat' ? 'PROCESSANDO...' : 'CONTRA-ATACAR'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}