import React, { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer'; // Vamos reutilizar seu renderizador implacável

interface WarRoomProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onExecuteOSINT: (prompt: string) => Promise<string>; // Função que vai chamar seu modelo Deep Research
}

type TabType = 'forense' | 'divida' | 'sangria' | 'sparring';

const COMPETITORS = ['TOTVS', 'Sankhya', 'SAP', 'GAtec', 'Mega', 'CHB', 'Siagri', 'Liberali (Franquia)'];

export default function WarRoom({ isOpen, onClose, isDarkMode, onExecuteOSINT }: WarRoomProps) {
  const [target, setTarget] = useState<string>('TOTVS');
  const [activeTab, setActiveTab] = useState<TabType>('forense');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [sparringInput, setSparringInput] = useState('');

  // Os Módulos de Ataque (Eles montam o mega prompt dinamicamente com base no Target)
  const osintModules = {
    forense: [
      { id: 'pricing', icon: '💰', title: 'Engenharia Reversa de Pricing', desc: 'Varre licitações e vazamentos para descobrir R$ da licença e valor da hora técnica.', 
        prompt: `Execute a varredura GOD MODE de Pricing para o alvo: ${target}. Busque propostas, editais after:2024-12-31 e monte a tabela mestra de TCO e hora técnica.` },
      { id: 'jusbrasil', icon: '⚖️', title: 'Bomba Trabalhista e Litígios', desc: 'Cruza o Jusbrasil buscando processos de ex-desenvolvedores e clientes pedindo rescisão.',
        prompt: `Faça um Deep Research em tribunais e Jusbrasil sobre o alvo ${target}. Busque litígios de inexecução contratual e processos trabalhistas de desenvolvedores nos últimos 12 meses.` },
      { id: 'cvm', icon: '🏦', title: 'Insider Dumping (CVM/B3)', desc: 'Monitora se diretores estão vendendo ações próprias em massa (fuga do barco).',
        prompt: `Analise relatórios da CVM e B3 do alvo ${target} (se capital aberto). Os diretores estão vendendo ações próprias? Há indícios de sangria financeira?` }
    ],
    divida: [
      { id: 'bugs', icon: '🦠', title: 'Autópsia de Suporte', desc: 'Raspa fóruns e ReclameAqui atrás dos piores bugs e quedas da última versão.',
        prompt: `Faça OSINT em fóruns de desenvolvedores, Telegram, ReclameAqui sobre o sistema ${target}. Liste as maiores falhas técnicas, bugs e quebras de integração relatadas nos últimos 6 meses.` },
      { id: 'vaporware', icon: '👻', title: 'Caça ao Vaporware', desc: 'Analisa se aquele módulo de IA que eles vendem realmente existe ou é powerpoint.',
        prompt: `O alvo ${target} está prometendo inovação (IA, Nuvem Nativa). Faça Deep Research para provar se o produto existe ou é 'Vaporware'. Busque menções de devs em repositórios sobre integração com essas APIs.` },
      { id: 'frankenstein', icon: '🧟', title: 'Efeito Frankenstein', desc: 'Mapeia as últimas M&As (compras) deles para provar que o sistema é uma colcha de retalhos.',
        prompt: `Mapeie as últimas 5 aquisições (M&A) do alvo ${target}. Crie um argumento técnico mostrando como esses sistemas comprados geram dívida técnica e banco de dados fragmentado para o cliente.` }
    ],
    sangria: [
      { id: 'vagas', icon: '🕵️', title: 'Paradoxo do Headcount', desc: 'Analisa vagas abertas para descobrir se a equipe de implantação debandou.',
        prompt: `Analise o portal de carreiras e LinkedIn do alvo ${target}. Eles estão perdendo seniores e contratando apenas juniores para implantação? Monte a tese de risco para o cliente.` },
      { id: 'churn', icon: '📉', title: 'Churn Silencioso (DNS)', desc: 'Descobre clientes grandes que desligaram o sistema deles recentemente.',
        prompt: `Faça Deep Research (BuiltWith, DNS records) e notícias de negócios para encontrar empresas médias/grandes que abandonaram o ERP ${target} recentemente para ir para a concorrência.` }
    ]
  };

  const handleRunOSINT = async (moduleId: string, title: string, prompt: string) => {
    setLoadingAction(moduleId);
    try {
      // Aqui nós chamamos o seu motor Deep Research
      const result = await onExecuteOSINT(prompt);
      setResults(prev => ({ ...prev, [moduleId]: result }));
    } catch (error) {
      setResults(prev => ({ ...prev, [moduleId]: '⚠️ Falha na varredura OSINT. O alvo pode ter blindado os dados ou a requisição falhou.' }));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSparring = async () => {
    if (!sparringInput.trim()) return;
    const moduleId = 'sparring-chat';
    setLoadingAction(moduleId);
    const prompt = `Você é um Especialista de Vendas Sênior atacando o concorrente ${target}. O cliente me disse o seguinte: "${sparringInput}". 
    Me dê o roteiro (Objection Handling) EXATO de contra-ataque para destruir essa objeção na mesa de negociação, usando falhas conhecidas do ${target}. Seja frio e tático.`;
    
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
              <p className={`text-[10px] uppercase font-bold ${textMuted}`}>Inteligência Competitiva & Dark OSINT</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors">✕</button>
        </div>

        {/* SELETOR DE ALVO */}
        <div className={`p-4 border-b ${panelBg}`}>
          <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Selecione o Inimigo (Target):</label>
          <select 
            value={target} 
            onChange={(e) => setTarget(e.target.value)}
            className={`w-full p-3 rounded-xl border text-sm font-bold outline-none focus:border-red-500 transition-colors appearance-none cursor-pointer ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            {COMPETITORS.map(comp => <option key={comp} value={comp}>{comp}</option>)}
          </select>
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
          
          {/* MÓDULOS OSINT (Forense, Dívida, Sangria) */}
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
                          <p className={`text-xs mt-1 ${textMuted}`}>{mod.desc}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRunOSINT(mod.id, mod.title, mod.prompt)}
                        disabled={loadingAction !== null}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shrink-0 transition-all ${
                          loadingAction === mod.id 
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20'
                        }`}
                      >
                        {loadingAction === mod.id ? 'VARRENDO...' : 'EXECUTAR OSINT'}
                      </button>
                    </div>
                  </div>

                  {/* RESULTADO (Renderizado implacávelmente) */}
                  {results[mod.id] && (
                    <div className={`p-5 border-t ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <MarkdownRenderer content={results[mod.id]} isDarkMode={isDarkMode} showCollapsibleSources={true} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* SPARRING MODE (Chat contra-ataque) */}
          {activeTab === 'sparring' && (
            <div className="h-full flex flex-col">
              <div className={`flex-1 rounded-xl border p-4 mb-4 overflow-y-auto ${panelBg}`}>
                {results['sparring-chat'] ? (
                  <MarkdownRenderer content={results['sparring-chat']} isDarkMode={isDarkMode} showCollapsibleSources={false} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                    <span className="text-6xl mb-4">🥊</span>
                    <p className="text-sm font-bold uppercase">Simulador de Objeções</p>
                    <p className="text-xs">Digite a mentira que o concorrente contou e receba a resposta de abate.</p>
                  </div>
                )}
              </div>
              <div className={`flex items-end gap-2 p-2 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}>
                <textarea
                  value={sparringInput}
                  onChange={(e) => setSparringInput(e.target.value)}
                  placeholder={`"O vendedor da ${target} disse que..."`}
                  className="flex-1 bg-transparent p-2 text-sm outline-none resize-none max-h-24 custom-scrollbar"
                  rows={2}
                />
                <button 
                  onClick={handleSparring}
                  disabled={!sparringInput.trim() || loadingAction === 'sparring-chat'}
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
