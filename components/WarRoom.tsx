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

const COMPETITORS = [
  'TOTVS', 'Sankhya', 'SAP', 'Aliare', 'Agrotis', 'CHB', 'Oracle', 'Liberali (Franquia)',
  'LG Lugar de Gente', 'Sólides', 'Metadados', 'Apdata', 'ADP', 'Gupy',
  'Intelipost', 'routEasy', 'Cobli', 'Lincros'
];

export default function WarRoom({ isOpen, onClose, isDarkMode, onExecuteOSINT }: WarRoomProps) {
  const [target, setTarget] = useState<string>('TOTVS');

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [techInput, setTechInput] = useState('');
  const [compareInput, setCompareInput] = useState('');

  const executeAction = async (id: string, prompt: string, titleStage: string) => {
    setLoadingAction(id);
    setErrors(prev => { const next = { ...prev }; delete next[id]; return next; });

    try {
      const result = await onExecuteOSINT(prompt);
      if (result.includes("⚠️ Falha") || result.includes("Load failed")) throw new Error(result);

      setResults(prev => ({ ...prev, [id]: result }));
    } catch (error: any) {
      setErrors(prev => ({ ...prev, [id]: "Falha de comunicação com a inteligência. O serviço pode estar sobrecarregado." }));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTechQuery = () => {
    if (!techInput.trim()) return;
    const prompt = `[DÚVIDA TÉCNICA] Responda de forma direta, técnica e estruturada à seguinte dúvida: "${techInput}". 
    Você deve atuar como Consultor Técnico Sênior. Se houver relação com a concorrência (${target}), pode mencionar. 
    Use formatação markdown profissional e cite fontes se houver. DEVE RESPONDER A PERGUNTA. NÃO EXIJA EMPRESA ALVO.`;
    executeAction('tech', prompt, 'Analisando Base Técnica...');
  };

  const handleCompareQuery = () => {
    if (!compareInput.trim()) return;
    const prompt = `[COMPARATIVO COMERCIAL] O usuário trouxe este cenário/dúvida: "${compareInput}". 
    Atue como Arquiteto de Soluções e faça um comparativo agressivo e tático entre SENIOR SISTEMAS vs ${target}.
    Estrutura obrigatória:
    ### ⚔️ O Cenário
    ### 🛡️ Visão da ${target}
    ### 🚀 O Contra-Ataque Senior
    ### 🔪 Script de Vendas (O que falar na mesa)
    DEVE RESPONDER DIRETAMENTE, NÃO EXIJA EMPRESA ALVO.`;
    executeAction('compare', prompt, 'Mapeando Fraquezas da Concorrência...');
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
              <p className={`text-[10px] uppercase font-bold tracking-widest ${isDarkMode ? 'text-red-400/50' : 'text-red-800/50'}`}>Consultoria Técnica e Tática</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors">✕</button>
        </div>

        {/* SELETOR DE ALVO */}
        <div className={`p-4 border-b flex gap-4 ${panelBg}`}>
          <div className="flex-1">
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${textMuted}`}>Concorrente Principal:</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={`w-full max-w-xs p-3 rounded-lg border text-sm font-bold outline-none focus:border-red-500 transition-colors cursor-pointer appearance-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
            >
              {COMPETITORS.map(comp => <option key={comp} value={comp}>{comp}</option>)}
            </select>
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL DIVIDIDO */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-6">

          {/* SEÇÃO 1: Dúvidas Técnicas */}
          <div className={`rounded-xl border shadow-sm overflow-hidden flex flex-col ${panelBg}`}>
            <div className={`p-4 border-b flex items-center gap-3 ${isDarkMode ? 'bg-blue-900/10' : 'bg-blue-50'}`}>
              <span className="text-2xl">🧠</span>
              <div>
                <h3 className={`font-black text-sm uppercase tracking-wide ${isDarkMode ? 'text-blue-400' : 'text-blue-800'}`}>Tira-Dúvidas Técnico</h3>
                <p className={`text-[10px] uppercase font-semibold ${textMuted}`}>Pergunte sobre Manuais, ERP, Integrações e Arquitetura Superior</p>
              </div>
            </div>

            <div className="p-4 flex flex-col">
              <textarea
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                placeholder="Exemplo: Como é o fluxo de aprovação de compras no ERP da Senior? Fica no Sapiens nativo?"
                className={`w-full p-3 rounded-lg border text-sm outline-none resize-none min-h-[80px] mb-3 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-500 text-white' : 'bg-white border-slate-300 focus:border-blue-500 text-slate-900'
                  }`}
              />
              <button
                onClick={handleTechQuery}
                disabled={!techInput.trim() || loadingAction !== null}
                className="self-end px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50"
              >
                {loadingAction === 'tech' ? 'Analisando...' : 'Consultar Base Técnica'}
              </button>
            </div>

            {loadingAction === 'tech' && (
              <div className="p-6 border-t border-slate-200 dark:border-slate-800">
                <LoadingSmart isLoading={true} mode={'diretoria'} isDarkMode={isDarkMode} searchQuery="Base Híbrida" processing={{ stage: 'Analisando Documentação...', completedStages: [] }} />
              </div>
            )}
            {errors['tech'] && !loadingAction && (
              <div className="p-4 bg-red-500/10 text-red-500 text-xs font-bold border-t border-red-500/20">{errors['tech']}</div>
            )}
            {results['tech'] && !loadingAction && !errors['tech'] && (
              <div className="p-6 border-t border-slate-200 dark:border-slate-800">
                <MarkdownRenderer content={results['tech']} isDarkMode={isDarkMode} />
              </div>
            )}
          </div>

          {/* SEÇÃO 2: Comparativo Tático */}
          <div className={`rounded-xl border shadow-sm overflow-hidden flex flex-col ${panelBg}`}>
            <div className={`p-4 border-b flex items-center gap-3 ${isDarkMode ? 'bg-red-900/10' : 'bg-red-50'}`}>
              <span className="text-2xl">🥊</span>
              <div>
                <h3 className={`font-black text-sm uppercase tracking-wide ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>Comparativo de Mercado vs {target}</h3>
                <p className={`text-[10px] uppercase font-semibold ${textMuted}`}>Solicite argumentos de venda, kill-sheets e objeções</p>
              </div>
            </div>

            <div className="p-4 flex flex-col">
              <textarea
                value={compareInput}
                onChange={(e) => setCompareInput(e.target.value)}
                placeholder={`Exemplo: O cliente diz que o ${target} é mais barato e rápido para implantar... como eu quebro essa objeção?`}
                className={`w-full p-3 rounded-lg border text-sm outline-none resize-none min-h-[80px] mb-3 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-red-500 text-white' : 'bg-white border-slate-300 focus:border-red-500 text-slate-900'
                  }`}
              />
              <button
                onClick={handleCompareQuery}
                disabled={!compareInput.trim() || loadingAction !== null}
                className="self-end px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-50"
              >
                {loadingAction === 'compare' ? 'Forjando Argumentos...' : 'Gerar Kill-Script'}
              </button>
            </div>

            {loadingAction === 'compare' && (
              <div className="p-6 border-t border-slate-200 dark:border-slate-800">
                <LoadingSmart isLoading={true} mode={'diretoria'} isDarkMode={isDarkMode} searchQuery={target} processing={{ stage: 'Vasculhando Fraquezas...', completedStages: [] }} />
              </div>
            )}
            {errors['compare'] && !loadingAction && (
              <div className="p-4 bg-red-500/10 text-red-500 text-xs font-bold border-t border-red-500/20">{errors['compare']}</div>
            )}
            {results['compare'] && !loadingAction && !errors['compare'] && (
              <div className="p-6 border-t border-slate-200 dark:border-slate-800">
                <MarkdownRenderer content={results['compare']} isDarkMode={isDarkMode} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

