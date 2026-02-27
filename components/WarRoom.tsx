import React, { useState, useRef, useEffect, useCallback } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { WarRoomMode, runWarRoomQuery } from '../services/geminiService';

interface WarRoomProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

const COMPETITORS = [
  'TOTVS', 'Sankhya', 'SAP', 'Aliare', 'Agrotis', 'CHB', 'Oracle',
  'LG Lugar de Gente', 'Sólides', 'Metadados', 'ADP', 'Gupy',
  'Intelipost', 'routEasy', 'Cobli', 'Lincros'
];

interface WRMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources?: Array<{ title: string; url: string }>;
  isLoading?: boolean;
  isError?: boolean;
}

const MODE_CONFIG: Record<WarRoomMode, { icon: string; label: string; subtitle: string; accent: string; placeholder: string }> = {
  tech: {
    icon: '🧠', label: 'Tira-Dúvidas Técnico', subtitle: 'ERP, Módulos, Processos e Integrações',
    accent: 'blue', placeholder: 'Como funciona o processo de compras no ERP Senior?',
  },
  killscript: {
    icon: '🎯', label: 'Kill-Script Generator', subtitle: 'Scripts de venda contra o concorrente',
    accent: 'red', placeholder: 'O cliente diz que o TOTVS é mais barato... como rebato?',
  },
  benchmark: {
    icon: '📊', label: 'Benchmark Tático', subtitle: 'Comparativo técnico lado a lado',
    accent: 'amber', placeholder: 'Compare o módulo de RH da Senior vs TOTVS',
  },
  objections: {
    icon: '🛡️', label: 'Análise de Objeções', subtitle: 'Desmonte objeções do cliente',
    accent: 'purple', placeholder: 'O cliente diz que SAP tem mais integrações...',
  },
};

export default function WarRoom({ isOpen, onClose }: WarRoomProps) {
  const [mode, setMode] = useState<WarRoomMode>('tech');
  const [target, setTarget] = useState('TOTVS');
  const [messages, setMessages] = useState<WRMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [queryCount, setQueryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen, mode]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    const userMsg: WRMessage = { id: Date.now().toString(), role: 'user', text };
    const botId = (Date.now() + 1).toString();
    const loadingMsg: WRMessage = { id: botId, role: 'model', text: '', isLoading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);
    setStatus('Preparando...');

    try {
      const history = messages
        .filter(m => !m.isLoading && !m.isError)
        .map(m => ({ role: m.role, text: m.text }));

      const result = await runWarRoomQuery(mode, text, history, target, setStatus);
      setQueryCount(prev => prev + 1);

      setMessages(prev => prev.map(m =>
        m.id === botId ? { ...m, text: result.text, sources: result.sources, isLoading: false } : m
      ));
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === botId ? { ...m, text: `⚠️ ${err.message || 'Erro de conexão'}`, isError: true, isLoading: false } : m
      ));
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  }, [input, isLoading, messages, mode, target]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleModeChange = (newMode: WarRoomMode) => {
    setMode(newMode);
    setMessages([]);
  };

  if (!isOpen) return null;

  const cfg = MODE_CONFIG[mode];
  const accentMap: Record<string, string> = {
    blue: 'from-blue-600 to-blue-800',
    red: 'from-red-600 to-red-800',
    amber: 'from-amber-600 to-amber-800',
    purple: 'from-purple-600 to-purple-800',
  };
  const accentBorder: Record<string, string> = {
    blue: 'border-blue-500/30', red: 'border-red-500/30', amber: 'border-amber-500/30', purple: 'border-purple-500/30',
  };
  const accentBg: Record<string, string> = {
    blue: 'bg-blue-500/10', red: 'bg-red-500/10', amber: 'bg-amber-500/10', purple: 'bg-purple-500/10',
  };
  const accentText: Record<string, string> = {
    blue: 'text-blue-400', red: 'text-red-400', amber: 'text-amber-400', purple: 'text-purple-400',
  };
  const accentBtn: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-500', red: 'bg-red-600 hover:bg-red-500',
    amber: 'bg-amber-600 hover:bg-amber-500', purple: 'bg-purple-600 hover:bg-purple-500',
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-[#0a1628] text-white animate-fade-in"
      style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(30,58,95,0.15) 0%, transparent 60%)' }}>

      {/* ============ SIDEBAR ARSENAL ============ */}
      <div className="w-72 flex-shrink-0 border-r border-slate-800/60 flex flex-col bg-[#0c1829]">
        {/* Header */}
        <div className="p-4 border-b border-red-900/40 bg-gradient-to-r from-red-950/40 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl filter drop-shadow-lg">⚔️</span>
              <div>
                <h2 className="font-black uppercase tracking-[0.2em] text-xs text-red-400">The War Room</h2>
                <p className="text-[9px] uppercase tracking-widest text-red-500/40 font-semibold">Centro de Comando Tático</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500/60 hover:text-red-400 transition-all text-xs">✕</button>
          </div>
        </div>

        {/* Competitor Selector */}
        <div className="p-3 border-b border-slate-800/40">
          <label className="block text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">🎯 Concorrente Alvo</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full p-2 rounded-lg border border-slate-700/50 bg-slate-900/80 text-xs font-semibold text-white outline-none focus:border-red-500/50 transition-colors cursor-pointer appearance-none"
          >
            {COMPETITORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Arsenal Cards */}
        <div className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">Arsenal de Inteligência</p>
          {(Object.keys(MODE_CONFIG) as WarRoomMode[]).map(m => {
            const c = MODE_CONFIG[m];
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group ${isActive
                    ? `${accentBg[c.accent]} ${accentBorder[c.accent]} shadow-lg`
                    : 'border-slate-800/40 hover:border-slate-700/60 bg-slate-900/30 hover:bg-slate-800/30'
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`text-lg ${isActive ? '' : 'opacity-60 group-hover:opacity-100'} transition-opacity`}>{c.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-bold truncate ${isActive ? accentText[c.accent] : 'text-slate-300'}`}>{c.label}</p>
                    <p className="text-[9px] text-slate-500 truncate">{c.subtitle}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Status Bar */}
        <div className="p-3 border-t border-slate-800/40 bg-slate-950/50">
          <div className="flex items-center justify-between text-[9px]">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              OPERACIONAL
            </span>
            <span className="text-slate-500">{queryCount} consulta{queryCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* ============ MAIN TERMINAL ============ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Terminal Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b border-slate-800/60 bg-gradient-to-r ${accentMap[cfg.accent]} bg-opacity-10`}
          style={{ background: `linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.8))` }}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{cfg.icon}</span>
            <div>
              <h3 className={`text-sm font-black uppercase tracking-wide ${accentText[cfg.accent]}`}>{cfg.label}</h3>
              <p className="text-[10px] text-slate-400">{cfg.subtitle} {mode !== 'tech' && `• vs ${target}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white border border-slate-700/50 hover:border-slate-600 transition-all"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <span className="text-5xl block mb-4 opacity-20">{cfg.icon}</span>
                <h4 className="text-slate-400 font-semibold text-sm mb-2">{cfg.label}</h4>
                <p className="text-slate-500 text-xs mb-6">{cfg.subtitle}</p>
                <div className="grid grid-cols-1 gap-2">
                  {[cfg.placeholder].map((hint, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(hint); inputRef.current?.focus(); }}
                      className={`text-left p-3 rounded-xl border border-slate-800/40 ${accentBg[cfg.accent]} hover:${accentBorder[cfg.accent]} transition-all text-xs text-slate-300`}
                    >
                      💡 {hint}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                  ? `bg-gradient-to-br ${accentMap[cfg.accent]} text-white shadow-lg`
                  : msg.isError
                    ? 'bg-red-950/30 border border-red-900/40 text-red-300'
                    : 'bg-slate-900/60 border border-slate-800/40 text-slate-200'
                }`}>
                {msg.isLoading ? (
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[10px] text-slate-400 animate-pulse">{status || 'Processando...'}</span>
                  </div>
                ) : msg.role === 'user' ? (
                  <p className="text-sm">{msg.text}</p>
                ) : (
                  <div>
                    <MarkdownRenderer content={msg.text} isDarkMode={true} />
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700/30">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Fontes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.slice(0, 5).map((s, i) => (
                            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/60 text-blue-400 hover:text-blue-300 hover:bg-slate-700/60 transition-colors truncate max-w-[200px]">
                              {s.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-800/60 bg-[#0c1829]">
          <div className={`flex items-end gap-3 rounded-xl border ${accentBorder[cfg.accent]} bg-slate-900/50 p-2 transition-colors focus-within:border-opacity-60`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={cfg.placeholder}
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none resize-none max-h-[120px] p-2"
              style={{ minHeight: '36px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-white ${accentBtn[cfg.accent]} transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg`}
            >
              {isLoading ? '⏳' : '▶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
