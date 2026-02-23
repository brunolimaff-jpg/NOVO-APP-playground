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

const COMPETITORS = [
  // ERP & Agro
  'TOTVS', 'Sankhya', 'SAP', 'Aliare', 'Agrotis', 'CHB', 'Oracle', 'Liberali (Franquia)',
  // HCM & HR Tech
  'LG Lugar de Gente', 'Sólides', 'Metadados', 'Apdata', 'ADP',
  // Logística
  'Intelipost', 'Senior (Legado/Concorrente)'
];

const SEGMENTS = ['ERP', 'HCM', 'Gestão de Campo', 'Logística'];

export default function WarRoom({ isOpen, onClose, isDarkMode, onExecuteOSINT }: WarRoomProps) {
  const [target, setTarget] = useState<string>('TOTVS');
  const [segment, setSegment] = useState<string>('ERP');
  const [activeTab, setActiveTab] = useState<TabType>('forense');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [sparringInput, setSparringInput] = useState('');

    // Prompts dinâmicos com INJEÇÃO DE GOOGLE DORKS (Shadow IT, Scribd, Drive e Jusbrasil)
  const osintModules = {
    forense: [
      { id: 'pricing', icon: '💰', title: 'Caça de Propostas Vazadas', desc: `Força a IA a usar Google Dorks para achar PDFs de orçamentos no Scribd, Drive e DocDroid.`, 
        prompt: `Execute OSINT Forense Avançado de Pricing para o alvo: ${target} (${segment}). 
        REGRAS DE BUSCA (USE DORKS): Pesquise obrigatoriamente usando (site:scribd.com OR site:docdroid.net OR site:slideshare.net OR site:drive.google.com) AND "${target}" AND ("proposta comercial" OR "orçamento" OR "escopo" OR "tabela de preços" OR "R$"). Use filetype:pdf. 
        Como empresas privadas não usam Diário Oficial, procure contratos B2B que vazaram na web para estimar o TCO e valor da hora técnica.` },
      
      { id: 'jusbrasil', icon: '⚖️', title: 'Litígios e Inexecução (Tribunais)', desc: `Mergulha no Jusbrasil caçando processos onde o cliente processou o ERP por falha.`,
        prompt: `Faça Deep Research focado em jurisprudência. Use o dork: site:jusbrasil.com.br "${target}" AND ("inexecução contratual" OR "falha na implantação" OR "lucros cessantes" OR "rescisão"). 
        Mapeie litígios recentes (após 2022) onde clientes de ${segment} processaram o alvo. Extraia as reclamações técnicas expostas nos autos do processo e, se citado nos autos, o valor original do contrato.` },
      
      { id: 'cvm', icon: '🏦', title: 'Saúde Financeira e M&A', desc: 'Monitora movimentações suspeitas de capital, fusões e investidores por trás da marca.',
        prompt: `Analise a estrutura corporativa do alvo ${target}. Para alvos menores/regionais, pesquise se eles foram adquiridos por algum fundo de investimento ou se operam "pendurados" em plataformas maiores (ex: a Liberali opera add-ons sobre o SAP B1). Qual o risco financeiro de longo prazo para um cliente que contrata esse sistema para ${segment}?` }
    ],
    divida: [
      { id: 'bugs', icon: '🦠', title: 'Fóruns de Devs e Shadow IT', desc: `Raspa o GitHub e fóruns obscuros para achar o que os devs escondem.`,
        prompt: `Vá além do marketing. Faça OSINT em comunidades (site:github.com OR site:stackoverflow.com OR site:reddit.com) AND "${target}" AND ("bug" OR "integration" OR "error" OR "API"). 
        No segmento de ${segment}, quais são as gambiarras técnicas (Shadow IT) que os clientes do ${target} são forçados a fazer porque o sistema nativo não funciona?` },
      
      { id: 'vaporware', icon: '👻', title: 'O Falso Nativo (A Mentira Comercial)', desc: `Prova se o sistema é próprio ou um puxadinho de outro ERP maior.`,
        prompt: `Investigue a arquitetura real do ${target} para ${segment}. Use dorks em PDFs vazados. 
        O sistema deles é verdadeiramente nativo ou eles vendem um "Add-on" que precisa ser acoplado em ERPs gigantes (como o SAP Business One) gerando custo de licenciamento duplo para o cliente? Detalhe essa dívida técnica.` },
      
      { id: 'frankenstein', icon: '🧟', title: 'Efeito Frankenstein', desc: `Mapeia se o módulo foi comprado de outra empresa e tem bancos de dados separados.`,
        prompt: `Pesquise o histórico de aquisições (M&A) do alvo ${target}. O módulo de ${segment} que eles vendem foi desenvolvido "dentro de casa" ou eles compraram uma startup terceirizada e enveloparam com a marca deles? Prove como isso gera problemas de integração e bases de dados não unificadas.` }
    ],
    sangria: [
      { id: 'vagas', icon: '🕵️', title: 'Sangria de Consultores Sêniores', desc: `Analisa o LinkedIn e vagas abertas para descobrir se a equipe de implantação debandou.`,
        prompt: `Use OSINT em portais de emprego (site:glassdoor.com.br OR site:gupy.io OR LinkedIn). O alvo ${target} está abrindo dezenas de vagas de urgência para ${segment}? 
        Procure reviews de ex-funcionários detonando prazos surreais e código legado. Monte o argumento: "A equipe sênior deles saiu, seu projeto será laboratório para juniores."` },
      
      { id: 'churn', icon: '📉', title: 'O Ralo de Clientes (Churn)', desc: `Mapeia empresas que usavam o sistema, mas migraram recentemente.`,
        prompt: `Faça Deep Research cruzando notícias de TI agro e ferramentas de stack. Busque por empresas do agronegócio ou ${segment} que substituíram o ${target} pela concorrência nos últimos 24 meses. Se não achar casos públicos, busque por vagas nessas usinas exigindo "Migração de sistema ${target}".` }
    ]
  };

  const handleRunOSINT = async (moduleId: string, title: string, prompt: string) => {
    setLoadingAction(moduleId);
    try {
      const result = await onExecuteOSINT(prompt);
      setResults(prev => ({ ...prev, [moduleId]: result }));
    } catch (error) {
      setResults(prev => ({ ...prev, [moduleId]: '⚠️ Falha Crítica na Varredura. Verifique os logs do console.' }));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSparring = async () => {
    if (!sparringInput.trim()) return;
    const moduleId = 'sparring-chat';
    setLoadingAction(moduleId);
    const prompt = `Você é um Especialista de Vendas Sênior atacando o concorrente ${target} no segmento de ${segment}. O cliente me disse: "${sparringInput}". 
    Me dê o roteiro de contra-ataque letal e tático para destruir essa objeção na mesa de negociação, evidenciando as falhas conhecidas do ${target} em ${segment}.`;
    
    try {
      const result = await onExecuteOSINT(prompt);
      setResults(prev => ({ ...prev, [moduleId]: result }));
      setSparringInput('');
    } catch (error) {
      setResults(prev => ({ ...prev, [moduleId]: 'Erro no Sparring.' }));
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`w-full max-w-2xl h-full flex flex-col shadow-2xl ${themeBg} border-l border-red-900/30 transform transition-transform duration-300`}>
        
        {/* HEADER WAR ROOM */}
        <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'bg-red-950/20 border-red-900/30' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <h2 className={`font-black uppercase tracking-widest text-sm ${isDarkMode ? 'text-red-500' : 'text-red-700'}`}>The War Room</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors">✕</button>
        </div>

        {/* SELETORES DE ATAQUE */}
        <div className={`p-4 border-b flex gap-4 ${panelBg}`}>
          <div className="flex-1">
            <label className={`block text-[10px] font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Alvo (Concorrente):</label>
            <select 
              value={target} 
              onChange={(e) => setTarget(e.target.value)}
              className={`w-full p-3 rounded-lg border text-sm font-bold outline-none focus:border-red-500 transition-colors cursor-pointer ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {COMPETITORS.map(comp => <option key={comp} value={comp}>{comp}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className={`block text-[10px] font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Segmento em Disputa:</label>
            <select 
              value={segment} 
              onChange={(e) => setSegment(e.target.value)}
              className={`w-full p-3 rounded-lg border text-sm font-bold outline-none focus:border-blue-500 transition-colors cursor-pointer ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-300 text-blue-700'
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
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-red-500 text-red-500' 
                  : `border-transparent ${textMuted} hover:text-red-400`
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* CONTEÚDO DINÂMICO */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab !== 'sparring' && (
            <div className="space-y-4">
              {osintModules[activeTab as keyof typeof osintModules].map(mod => (
                <div key={mod.id} className={`rounded-xl border overflow-hidden ${panelBg}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-1">{mod.icon}</span>
                        <div>
                          <h3 className={`font-bold text-sm ${textMain}`}>{mod.title}</h3>
                          <p className={`text-xs mt-1 leading-relaxed ${textMuted}`}>{mod.desc}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRunOSINT(mod.id, mod.title, mod.prompt)}
                        disabled={loadingAction !== null}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0 transition-all ${
                          loadingAction === mod.id 
                            ? 'bg-red-500 text-white animate-pulse'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20'
                        }`}
                      >
                        {loadingAction === mod.id ? 'VARRENDO...' : 'EXECUTAR OSINT'}
                      </button>
                    </div>
                  </div>

                  {/* LOADING INTEGRADOR */}
                  {loadingAction === mod.id && (
                    <div className={`p-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                      <LoadingSmart 
                        isLoading={true} 
                        mode={'operacao' as ChatMode} 
                        isDarkMode={isDarkMode} 
                        searchQuery={target}
                        processing={{ 
                          stage: `Varrida OSINT em ${target} (${segment})...`, 
                          completedStages: ["Preparando alvos", "Iniciando varredura profunda"] 
                        }}
                      />
                    </div>
                  )}

                  {/* RESULTADOS DA PESQUISA */}
                  {results[mod.id] && loadingAction !== mod.id && (
                    <div className={`p-5 border-t ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <MarkdownRenderer content={results[mod.id]} isDarkMode={isDarkMode} showCollapsibleSources={true} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sparring' && (
            <div className="h-full flex flex-col">
              <div className={`flex-1 rounded-xl border p-4 mb-4 overflow-y-auto ${panelBg}`}>
                {loadingAction === 'sparring-chat' && (
                  <div className="mb-4">
                    <LoadingSmart 
                      isLoading={true} 
                      mode={'operacao' as ChatMode} 
                      isDarkMode={isDarkMode} 
                      searchQuery={target}
                      processing={{ stage: `Buscando falhas de ${target} em ${segment}...`, completedStages: [] }}
                    />
                  </div>
                )}
                
                {results['sparring-chat'] && loadingAction !== 'sparring-chat' ? (
                  <MarkdownRenderer content={results['sparring-chat']} isDarkMode={isDarkMode} showCollapsibleSources={false} />
                ) : !loadingAction && (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                    <span className="text-6xl mb-4">🥊</span>
                    <p className="text-sm font-bold uppercase">Simulador de Objeções</p>
                    <p className="text-xs">Digite a mentira que o concorrente contou na reunião sobre {segment}.</p>
                  </div>
                )}
              </div>
              <div className={`flex items-end gap-2 p-2 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}>
                <textarea
                  value={sparringInput}
                  onChange={(e) => setSparringInput(e.target.value)}
                  placeholder={`"A ${target} garantiu que o módulo de ${segment} está 100% pronto..."`}
                  className="flex-1 bg-transparent p-2 text-sm outline-none resize-none max-h-24 custom-scrollbar"
                  rows={2}
                />
                <button 
                  onClick={handleSparring}
                  disabled={!sparringInput.trim() || loadingAction !== null}
                  className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-bold text-xs uppercase"
                >
                  {loadingAction === 'sparring-chat' ? '...' : 'Contra-atacar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
