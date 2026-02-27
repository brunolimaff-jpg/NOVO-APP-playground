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

export default function WarRoom({ isOpen, onClose, isDarkMode }: WarRoomProps) {
  const dk = isDarkMode;

  const [mode, setMode] = useState<WarRoomMode>('tech');
  const [target, setTarget] = useState('TOTVS');
  const [messages, setMessages] = useState<WRMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [queryCount, setQueryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Conversation is "active" if there are non-empty messages
  const hasConversation = messages.some(m => !m.isLoading && m.text);

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

  const handleClearAndSwitch = (newMode: WarRoomMode) => {
    setMessages([]);
    setMode(newMode);
  };

  if (!isOpen) return null;

  const cfg = MODE_CONFIG[mode];

  // ─── THEME TOKENS ─────────────────────────────────────────
  const t = {
    pageBg: dk ? 'bg-slate-950' : 'bg-slate-50',
    sidebarBg: dk ? 'bg-slate-900' : 'bg-white',
    sidebarBdr: dk ? 'border-slate-800' : 'border-slate-200',
    headerBg: dk ? 'bg-red-950/30' : 'bg-red-50',
    headerBdr: dk ? 'border-red-900/50' : 'border-red-200',
    headerTitle: dk ? 'text-red-400' : 'text-red-700',
    headerSub: dk ? 'text-red-500/40' : 'text-red-800/50',
    selectBg: dk ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900',
    labelTxt: dk ? 'text-slate-500' : 'text-slate-400',
    terminalBg: dk ? 'bg-slate-950' : 'bg-white',
    terminalHdr: dk ? 'bg-slate-900/80' : 'bg-slate-50',
    terminalBdr: dk ? 'border-slate-800' : 'border-slate-200',
    msgBotBg: dk ? 'bg-slate-900/60 border-slate-800/40 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800',
    msgBotErr: dk ? 'bg-red-950/30 border-red-900/40 text-red-300' : 'bg-red-50 border-red-200 text-red-700',
    emptyIcon: dk ? 'opacity-20' : 'opacity-10',
    emptyTxt: dk ? 'text-slate-400' : 'text-slate-500',
    emptySub: dk ? 'text-slate-500' : 'text-slate-400',
    inputBg: dk ? 'bg-slate-900/50' : 'bg-slate-50',
    inputTxt: dk ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400',
    inputWrap: dk ? 'bg-slate-900' : 'bg-white',
    statusBg: dk ? 'bg-slate-950/50' : 'bg-slate-100',
    statusTxt: dk ? 'text-slate-500' : 'text-slate-400',
    textMain: dk ? 'text-white' : 'text-slate-900',
    cardInactive: dk ? 'border-slate-800/40 bg-slate-900/30 hover:bg-slate-800/30 hover:border-slate-700/60'
      : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300',
    cardLocked: dk ? 'border-slate-800/20 bg-slate-900/20' : 'border-slate-200/50 bg-slate-100/50',
    cardTxt: dk ? 'text-slate-300' : 'text-slate-700',
    cardSub: dk ? 'text-slate-500' : 'text-slate-400',
    srcBg: dk ? 'bg-slate-800/60 hover:bg-slate-700/60' : 'bg-slate-100 hover:bg-slate-200',
    srcTxt: dk ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700',
    btnClear: dk ? 'text-slate-400 hover:text-white border-slate-700/50 hover:border-slate-600'
      : 'text-slate-500 hover:text-slate-800 border-slate-300 hover:border-slate-400',
    loadDot: dk ? 'bg-slate-400' : 'bg-slate-500',
    loadTxt: dk ? 'text-slate-400' : 'text-slate-500',
    hintBdr: dk ? 'border-slate-800/40' : 'border-slate-200',
    hintTxt: dk ? 'text-slate-300' : 'text-slate-600',
    closeTxt: dk ? 'text-red-500/60 hover:text-red-400 hover:bg-red-500/10'
      : 'text-red-400 hover:text-red-600 hover:bg-red-100',
    srcBdr: dk ? 'border-slate-700/30' : 'border-slate-200',
    srcLabel: dk ? 'text-slate-500' : 'text-slate-400',
  };

  // Accent colors per mode
  const accentGrad: Record<string, string> = {
    blue: 'from-blue-600 to-blue-700', red: 'from-red-600 to-red-700',
    amber: 'from-amber-500 to-amber-700', purple: 'from-purple-600 to-purple-700',
  };
  const accentBorder: Record<string, string> = {
    blue: dk ? 'border-blue-500/30' : 'border-blue-400/40',
    red: dk ? 'border-red-500/30' : 'border-red-400/40',
    amber: dk ? 'border-amber-500/30' : 'border-amber-400/40',
    purple: dk ? 'border-purple-500/30' : 'border-purple-400/40',
  };
  const accentBg: Record<string, string> = {
    blue: dk ? 'bg-blue-500/10' : 'bg-blue-50',
    red: dk ? 'bg-red-500/10' : 'bg-red-50',
    amber: dk ? 'bg-amber-500/10' : 'bg-amber-50',
    purple: dk ? 'bg-purple-500/10' : 'bg-purple-50',
  };
  const accentText: Record<string, string> = {
    blue: dk ? 'text-blue-400' : 'text-blue-700',
    red: dk ? 'text-red-400' : 'text-red-700',
    amber: dk ? 'text-amber-400' : 'text-amber-700',
    purple: dk ? 'text-purple-400' : 'text-purple-700',
  };
  const accentBtn: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-500', red: 'bg-red-600 hover:bg-red-500',
    amber: 'bg-amber-600 hover:bg-amber-500', purple: 'bg-purple-600 hover:bg-purple-500',
  };

  return (
    <div className={`fixed inset-0 z-50 flex ${t.pageBg} ${t.textMain} animate-fade-in`}>

      {/* ============ SIDEBAR ARSENAL ============ */}
      <div className={`w-72 flex-shrink-0 border-r ${t.sidebarBdr} flex flex-col ${t.sidebarBg}`}>
        {/* Header */}
        <div className={`p-4 border-b ${t.headerBdr} ${t.headerBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl filter drop-shadow-lg">⚔️</span>
              <div>
                <h2 className={`font-black uppercase tracking-[0.2em] text-xs ${t.headerTitle}`}>The War Room</h2>
                <p className={`text-[9px] uppercase tracking-widest font-semibold ${t.headerSub}`}>Centro de Comando Tático</p>
              </div>
            </div>
            <button onClick={onClose} className={`p-1.5 rounded-lg transition-all text-xs ${t.closeTxt}`}>✕</button>
          </div>
        </div>

        {/* Competitor Selector */}
        <div className={`p-3 border-b ${t.sidebarBdr}`}>
          <label className={`block text-[9px] font-bold uppercase tracking-[0.15em] ${t.labelTxt} mb-1.5`}>🎯 Concorrente Alvo</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={`w-full p-2 rounded-lg border text-xs font-semibold outline-none transition-colors cursor-pointer appearance-none ${t.selectBg}`}
          >
            {COMPETITORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Arsenal Cards */}
        <div className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
          <p className={`text-[9px] font-bold uppercase tracking-[0.15em] ${t.labelTxt} mb-2`}>Arsenal de Inteligência</p>
          {(Object.keys(MODE_CONFIG) as WarRoomMode[]).map(m => {
            const c = MODE_CONFIG[m];
            const isActive = mode === m;
            const isLocked = !isActive && (hasConversation || isLoading);

            return (
              <button
                key={m}
                onClick={() => !isLocked && handleClearAndSwitch(m)}
                disabled={isLocked}
                title={isLocked ? 'Limpe a conversa atual antes de trocar de modo' : c.label}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group ${isActive
                    ? `${accentBg[c.accent]} ${accentBorder[c.accent]} shadow-sm`
                    : isLocked
                      ? `${t.cardLocked} cursor-not-allowed opacity-50`
                      : t.cardInactive
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`text-lg transition-opacity ${isActive ? '' : isLocked ? 'opacity-30' : 'opacity-60 group-hover:opacity-100'
                    }`}>
                    {isLocked ? '🔒' : c.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[11px] font-bold truncate ${isActive ? accentText[c.accent] : isLocked ? t.cardSub : t.cardTxt
                      }`}>
                      {c.label}
                    </p>
                    <p className={`text-[9px] truncate ${t.cardSub}`}>
                      {isLocked ? 'Limpe a conversa para ativar' : c.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Status Bar */}
        <div className={`p-3 border-t ${t.sidebarBdr} ${t.statusBg}`}>
          <div className="flex items-center justify-between text-[9px]">
            <span className="flex items-center gap-1.5 text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              OPERACIONAL
            </span>
            <span className={t.statusTxt}>{queryCount} consulta{queryCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* ============ MAIN TERMINAL ============ */}
      <div className={`flex-1 flex flex-col min-w-0 ${t.terminalBg}`}>
        {/* Terminal Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${t.terminalBdr} ${t.terminalHdr}`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{cfg.icon}</span>
            <div>
              <h3 className={`text-sm font-black uppercase tracking-wide ${accentText[cfg.accent]}`}>{cfg.label}</h3>
              <p className={`text-[10px] ${t.emptySub}`}>{cfg.subtitle} {mode !== 'tech' && `• vs ${target}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${t.btnClear}`}
              >
                🗑️ Limpar
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <span className={`text-5xl block mb-4 ${t.emptyIcon}`}>{cfg.icon}</span>
                <h4 className={`font-semibold text-sm mb-2 ${t.emptyTxt}`}>{cfg.label}</h4>
                <p className={`text-xs mb-6 ${t.emptySub}`}>{cfg.subtitle}</p>
                <div className="grid grid-cols-1 gap-2">
                  {[cfg.placeholder].map((hint, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(hint); inputRef.current?.focus(); }}
                      className={`text-left p-3 rounded-xl border ${t.hintBdr} ${accentBg[cfg.accent]} transition-all text-xs ${t.hintTxt} hover:shadow-sm`}
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
                  ? `bg-gradient-to-br ${accentGrad[cfg.accent]} text-white shadow-lg`
                  : msg.isError
                    ? t.msgBotErr
                    : t.msgBotBg
                }`}>
                {msg.isLoading ? (
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${t.loadDot} animate-bounce`} style={{ animationDelay: '0ms' }} />
                      <span className={`w-1.5 h-1.5 rounded-full ${t.loadDot} animate-bounce`} style={{ animationDelay: '150ms' }} />
                      <span className={`w-1.5 h-1.5 rounded-full ${t.loadDot} animate-bounce`} style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className={`text-[10px] animate-pulse ${t.loadTxt}`}>{status || 'Processando...'}</span>
                  </div>
                ) : msg.role === 'user' ? (
                  <p className="text-sm">{msg.text}</p>
                ) : (
                  <div>
                    <MarkdownRenderer content={msg.text} isDarkMode={dk} />
                    {msg.sources && msg.sources.length > 0 && (
                      <div className={`mt-3 pt-3 border-t ${t.srcBdr}`}>
                        <p className={`text-[9px] uppercase tracking-wider font-bold mb-1.5 ${t.srcLabel}`}>Fontes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.slice(0, 5).map((s, i) => (
                            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                              className={`text-[10px] px-2 py-0.5 rounded-full ${t.srcBg} ${t.srcTxt} transition-colors truncate max-w-[200px]`}>
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
        <div className={`p-4 border-t ${t.terminalBdr} ${t.inputWrap}`}>
          <div className={`flex items-end gap-3 rounded-xl border ${accentBorder[cfg.accent]} ${t.inputBg} p-2 transition-colors focus-within:shadow-sm`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={cfg.placeholder}
              rows={1}
              className={`flex-1 bg-transparent text-sm outline-none resize-none max-h-[120px] p-2 ${t.inputTxt}`}
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
