import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { WarRoomMode, queryWarRoom } from '../services/warRoomService';
import { buildAuditableSources, normalizeSourceUrl, type AuditableSource } from '../utils/textCleaners';
import { fetchLinkStatuses, type LinkValidationResult } from '../utils/linkValidation';

interface WarRoomProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  defaultCompetitorTarget?: string | null;
}

interface WRMessage {
  id: string;
  role: 'user' | 'model';
  mode: WarRoomMode;
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

const EMPTY_MODE_MESSAGES: Record<WarRoomMode, WRMessage[]> = {
  tech: [],
  killscript: [],
  benchmark: [],
  objections: [],
};

const extractCompetitorFromMessage = (message: string): string => {
  const candidate = message.match(/(?:vs|contra)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ._/-]{1,60})/i)?.[1] || '';
  return candidate.trim().replace(/[.,;:!?]+$/, '');
};

export default function WarRoom({ isOpen, onClose, isDarkMode, defaultCompetitorTarget }: WarRoomProps) {
  const dk = isDarkMode;

  const [mode, setMode] = useState<WarRoomMode>('tech');
  const [messagesByMode, setMessagesByMode] = useState<Record<WarRoomMode, WRMessage[]>>(EMPTY_MODE_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [queryCount, setQueryCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [linkStatuses, setLinkStatuses] = useState<Record<string, LinkValidationResult>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages = messagesByMode[mode];
  const messageSourcesMap = useMemo<Record<string, AuditableSource[]>>(() => {
    const map: Record<string, AuditableSource[]> = {};
    for (const msg of messages) {
      if (msg.role !== 'model' || msg.isLoading) continue;
      map[msg.id] = buildAuditableSources(msg.text || '', msg.sources || []);
    }
    return map;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen, mode]);

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setCopyFeedback('Conteúdo copiado.');
      setTimeout(() => setCopiedId(null), 2000);
      setTimeout(() => setCopyFeedback(null), 2200);
    } catch {
      setCopyFeedback('Não foi possível copiar. Copie manualmente.');
      setTimeout(() => setCopyFeedback(null), 2600);
    }
  }, []);

  useEffect(() => {
    if (!isOpen && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsLoading(false);
      setStatus('');
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    const urls = Array.from(
      new Set(
        Object.values(messageSourcesMap)
          .flatMap((sources) => sources.map((s) => s.url).filter(Boolean) as string[])
      )
    );
    if (urls.length === 0) return;

    let cancelled = false;
    fetchLinkStatuses(urls).then((results) => {
      if (!cancelled) setLinkStatuses(results);
    });
    return () => {
      cancelled = true;
    };
  }, [messageSourcesMap]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const activeMessages = messagesByMode[mode];
    const inferredTarget = extractCompetitorFromMessage(text);
    let target = '';

    if (mode !== 'tech') {
      target = inferredTarget || (defaultCompetitorTarget || '').trim();
    }

    setInput('');
    setIsSidebarOpen(false);
    const userMsg: WRMessage = { id: Date.now().toString(), role: 'user', mode, text };
    const botId = (Date.now() + 1).toString();
    const loadingMsg: WRMessage = { id: botId, role: 'model', mode, text: '', isLoading: true };

    setMessagesByMode(prev => ({ ...prev, [mode]: [...prev[mode], userMsg, loadingMsg] }));
    setIsLoading(true);
    setStatus('Preparando...');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = activeMessages
        .filter(m => !m.isLoading && !m.isError)
        .map(m => ({ role: m.role, text: m.text }));

      const result = await queryWarRoom(mode, text, history, target, setStatus, {
        signal: controller.signal,
        timeoutMs: 30000,
      });
      setQueryCount(prev => prev + 1);

      setMessagesByMode(prev => ({
        ...prev,
        [mode]: prev[mode].map(m =>
          m.id === botId ? { ...m, text: result.text, sources: result.sources, isLoading: false } : m
        )
      }));
    } catch (err: any) {
      setMessagesByMode(prev => ({
        ...prev,
        [mode]: prev[mode].map(m =>
          m.id === botId ? { ...m, text: `⚠️ ${err.message || 'Erro de conexão'}`, isError: true, isLoading: false } : m
        )
      }));
    } finally {
      setIsLoading(false);
      setStatus('');
      abortRef.current = null;
    }
  }, [defaultCompetitorTarget, input, isLoading, messagesByMode, mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleModeSwitch = (newMode: WarRoomMode) => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsLoading(false);
      setStatus('');
    }
    setMode(newMode);
    setIsSidebarOpen(false);
  };

  if (!isOpen) return null;

  const cfg = MODE_CONFIG[mode];

  const t = {
    pageBg: dk ? 'bg-slate-950' : 'bg-slate-50',
    sidebarBg: dk ? 'bg-slate-900' : 'bg-white',
    sidebarBdr: dk ? 'border-slate-800' : 'border-slate-200',
    headerBg: dk ? 'bg-red-950/30' : 'bg-red-50',
    headerBdr: dk ? 'border-red-900/50' : 'border-red-200',
    headerTitle: dk ? 'text-red-400' : 'text-red-700',
    headerSub: dk ? 'text-red-500/40' : 'text-red-800/50',
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
    cardTxt: dk ? 'text-slate-300' : 'text-slate-700',
    cardSub: dk ? 'text-slate-500' : 'text-slate-400',
    srcBg: dk ? 'bg-slate-800/60 hover:bg-slate-700/60' : 'bg-slate-100 hover:bg-slate-200',
    srcTxt: dk ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700',
    btnClear: dk ? 'text-slate-400 hover:text-white border-slate-700/50 hover:border-slate-600'
      : 'text-slate-500 hover:text-slate-800 border-slate-300 hover:border-slate-400',
    btnCopy: dk ? 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
      : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50',
    loadDot: dk ? 'bg-slate-400' : 'bg-slate-500',
    loadTxt: dk ? 'text-slate-400' : 'text-slate-500',
    hintBdr: dk ? 'border-slate-800/40' : 'border-slate-200',
    hintTxt: dk ? 'text-slate-300' : 'text-slate-600',
    closeTxt: dk ? 'text-red-500/60 hover:text-red-400 hover:bg-red-500/10'
      : 'text-red-400 hover:text-red-600 hover:bg-red-100',
    srcBdr: dk ? 'border-slate-700/30' : 'border-slate-200',
    srcLabel: dk ? 'text-slate-500' : 'text-slate-400',
  };

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
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 sm:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <div className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        sm:translate-x-0 sm:relative fixed inset-y-0 left-0 z-50
        w-80 sm:w-72 flex-shrink-0 border-r ${t.sidebarBdr} flex flex-col ${t.sidebarBg}
        transition-transform duration-300 ease-in-out
      `}>
        <div className={`p-4 border-b ${t.headerBdr} ${t.headerBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl filter drop-shadow-lg">⚔️</span>
              <div>
                <h2 className={`font-black uppercase tracking-[0.2em] text-xs ${t.headerTitle}`}>The War Room</h2>
                <p className={`text-[10px] sm:text-[9px] uppercase tracking-widest font-semibold ${t.headerSub}`}>Centro de Comando Tático</p>
              </div>
            </div>
            <button onClick={onClose} className={`p-1.5 rounded-lg transition-all text-xs ${t.closeTxt}`}>✕</button>
          </div>
        </div>

        <div className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
          <p className={`text-[10px] sm:text-[9px] font-bold uppercase tracking-[0.15em] ${t.labelTxt} mb-2`}>Arsenal de Inteligência</p>
          {(Object.keys(MODE_CONFIG) as WarRoomMode[]).map(m => {
            const c = MODE_CONFIG[m];
            const isActive = mode === m;
            return (
              <button key={m} onClick={() => handleModeSwitch(m)}
                className={`w-full text-left p-3 sm:p-3 rounded-xl border transition-all duration-200 group ${isActive
                  ? `${accentBg[c.accent]} ${accentBorder[c.accent]} shadow-sm` : t.cardInactive}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-xl sm:text-lg transition-opacity flex-shrink-0 ${isActive ? '' : 'opacity-60 group-hover:opacity-100'}`}>
                    {c.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs sm:text-[11px] font-bold leading-tight mb-0.5 ${isActive ? accentText[c.accent] : t.cardTxt}`}>
                      {c.label}
                    </p>
                    <p className={`text-[10px] sm:text-[9px] leading-snug ${t.cardSub}`}>{c.subtitle}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className={`p-3 border-t ${t.sidebarBdr} ${t.statusBg}`}>
          <div className="flex items-center justify-between text-[10px] sm:text-[9px]">
            <span className="flex items-center gap-1.5 text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />OPERACIONAL
            </span>
            <span className={t.statusTxt}>{queryCount} consulta{queryCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className={`flex-1 flex flex-col min-w-0 ${t.terminalBg}`}>
        <div className={`flex items-center justify-between px-3 sm:px-5 py-3 border-b ${t.terminalBdr} ${t.terminalHdr}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`sm:hidden p-2 rounded-lg ${t.btnClear} border`}>☰</button>
            <span className="text-xl">{cfg.icon}</span>
            <div className="min-w-0">
              <h3 className={`text-sm font-black uppercase tracking-wide ${accentText[cfg.accent]} truncate`}>{cfg.label}</h3>
              <p className={`text-[10px] ${t.emptySub} truncate`}>{cfg.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button onClick={() => setMessagesByMode(prev => ({ ...prev, [mode]: [] }))}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${t.btnClear}`}>
                🗑️ <span className="hidden sm:inline">Limpar</span>
              </button>
            )}
            {isLoading && (
              <button
                onClick={() => {
                  if (abortRef.current) abortRef.current.abort();
                }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all text-red-500 border-red-400/40 hover:bg-red-500/10"
              >
                ⏹ <span className="hidden sm:inline">Parar</span>
              </button>
            )}
          </div>
        </div>

        {copyFeedback && (
          <div className={`mx-3 sm:mx-5 mt-2 text-[11px] rounded-lg px-3 py-2 ${dk ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
            {copyFeedback}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 custom-scrollbar">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center h-full px-4">
              <div className="text-center max-w-md">
                <span className={`text-5xl block mb-4 ${t.emptyIcon}`}>{cfg.icon}</span>
                <h4 className={`font-semibold text-sm mb-2 ${t.emptyTxt}`}>{cfg.label}</h4>
                <p className={`text-xs mb-6 ${t.emptySub}`}>{cfg.subtitle}</p>
                <div className="grid grid-cols-1 gap-2">
                  {[cfg.placeholder].map((hint, i) => (
                    <button key={i} onClick={() => { setInput(hint); inputRef.current?.focus(); }}
                      className={`text-left p-3 rounded-xl border ${t.hintBdr} ${accentBg[cfg.accent]} transition-all text-xs ${t.hintTxt} hover:shadow-sm`}>
                      💡 {hint}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map(msg => {
            const mergedSources = messageSourcesMap[msg.id] || [];
            return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[95%] sm:max-w-[85%] rounded-2xl px-3 sm:px-4 py-3 relative group ${msg.role === 'user'
                ? `bg-gradient-to-br ${accentGrad[MODE_CONFIG[msg.mode].accent]} text-white shadow-lg`
                : msg.isError ? t.msgBotErr : t.msgBotBg}`}>
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
                    {/* BOTÃO COPIAR */}
                    <button
                      onClick={() => copyToClipboard(msg.text, msg.id)}
                      className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${t.btnCopy}`}
                      title="Copiar resposta"
                    >
                      {copiedId === msg.id ? '✓' : '📋'}
                    </button>
                    <MarkdownRenderer content={msg.text} isDarkMode={dk} allowRawHtml={false} auditableSources={mergedSources} />
                    {mergedSources.length > 0 && (
                      <div className={`mt-3 pt-3 border-t ${t.srcBdr}`}>
                        <p className={`text-[9px] uppercase tracking-wider font-bold mb-1.5 ${t.srcLabel}`}>Fontes</p>
                        <ul className="space-y-1.5">
                          {mergedSources.map((s, i) => {
                            const status = s.url ? linkStatuses[s.url] || linkStatuses[normalizeSourceUrl(s.url)] : undefined;
                            const statusLabel = !s.url
                              ? 'inferido - validar manualmente'
                              : status?.status === 'valid'
                                ? 'validado'
                                : status?.status === 'broken'
                                  ? status.note || 'indisponivel'
                                  : 'validacao pendente';
                            const context = s.contexts[0] || (s.url
                              ? 'Referência usada para sustentar parte da resposta.'
                              : 'Menção inferida sem URL explícita; valide manualmente.');

                            return (
                              <li key={s.key || i} className="text-[10px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold opacity-80">
                                    {s.citationIndex ? `[${s.citationIndex}]` : '[inferida]'}
                                  </span>
                                  {s.url ? (
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className={`${t.srcTxt} hover:underline break-all`}>
                                      {s.title || s.url}
                                    </a>
                                  ) : (
                                    <span className={dk ? 'text-slate-300' : 'text-slate-700'}>{s.title}</span>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded-full ${
                                    statusLabel.includes('validado')
                                      ? (dk ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700')
                                      : (dk ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700')
                                  }`}>
                                    {statusLabel}
                                  </span>
                                </div>
                                <p className={`mt-0.5 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>{context}</p>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )})}
          <div ref={messagesEndRef} />
        </div>

        <div className={`p-3 sm:p-4 border-t ${t.terminalBdr} ${t.inputWrap}`}>
          <div className={`flex items-end gap-2 sm:gap-3 rounded-xl border ${accentBorder[cfg.accent]} ${t.inputBg} p-2 transition-colors focus-within:shadow-sm`}>
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={cfg.placeholder} rows={1}
              className={`flex-1 bg-transparent text-sm outline-none resize-none max-h-[120px] p-2 ${t.inputTxt}`}
              style={{ minHeight: '36px' }} />
            <button onClick={handleSend} disabled={!input.trim() || isLoading}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-white ${accentBtn[cfg.accent]} transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg flex-shrink-0`}>
              {isLoading ? '⏳' : '▶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
