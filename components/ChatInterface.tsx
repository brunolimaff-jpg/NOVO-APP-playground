import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { ChatInterfaceProps, Sender } from '../types';
import { useMode } from '../contexts/ModeContext';
import { useAuth } from '../contexts/AuthContext';
import SessionsSidebar from './SessionsSidebar';
import SectionalBotMessage from './SectionalBotMessage';
import MarkdownRenderer from './MarkdownRenderer';
import LoadingSmart from './LoadingSmart';
import ErrorMessageCard from './ErrorMessageCard';
import EmptyStateHome from './EmptyStateHome';
import MessageActionsBar from './MessageActionsBar';
import { DeepDiveTopics } from './DeepDiveTopics';
import InvestigationDashboard from './InvestigationDashboard';
import SettingsDrawer from './SettingsDrawer';
import ScorePorta from './ScorePorta';
import WarRoom from './WarRoom';
import { cleanTitle, extractSources } from '../utils/textCleaners';
import { isFakeUrl } from '../services/apiConfig';
import { runWarRoomOSINT } from '../services/geminiService';
import ConfirmPopover from './ConfirmPopover';

const QUICK_ACTIONS = [
  { icon: "🎯", label: "Comparar", prompt: "Compare com o principal concorrente dessa empresa" },
  { icon: "💰", label: "Budget", prompt: "Qual o budget estimado para implementação completa com ERP, HCM e GAtec?" },
  { icon: "💡", label: "Abordagem", prompt: "Me sugira a melhor abordagem para esse decisor" },
  { icon: "✨", label: "Senior", prompt: "Como os produtos Senior resolveriam as dores dessa empresa?" },
];

function extractDisplayedSuggestions(content?: string): string[] {
  if (!content) return [];
  const suggestions: string[] = [];
  const patterns = [
    /\*\*(?:Sugestões|🔎\s*O que você quer descobrir agora\?)\*\*\n([\s\S]*?)(?=\n---|\n\*\*|$)/i,
    /(?:Sugestões|Próximos passos)[:\s]*\n([\s\S]*?)(?=\n---|\n\*\*|$)/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const lines = match[1].split('\n');
      lines.forEach(line => {
        const bulletMatch = line.match(/^[\*\-]\s*["']?([^"'\n]+)["']?/);
        if (bulletMatch && bulletMatch[1].trim().length > 5) {
          suggestions.push(bulletMatch[1].trim().replace(/["']$/, ''));
        }
      });
      if (suggestions.length > 0) break;
    }
  }
  return suggestions.slice(0, 4);
}

type ExtendedChatInterfaceProps = ChatInterfaceProps & {
  onDeleteMessage?: (id: string) => void;
  onSaveToCRM?: (sessionId: string) => void;
  onOpenKanban?: () => void;
};

const ChatInterface: React.FC<ExtendedChatInterfaceProps> = ({
  currentSession, sessions, onNewSession, onSelectSession, onDeleteSession,
  isSidebarOpen, onToggleSidebar, messages, isLoading, hasMore,
  onSendMessage, onFeedback, onSendFeedback, onSectionFeedback, onLoadMore,
  onExportConversation, onExportPDF, onExportMessage, onRetry, onClearChat,
  onRegenerateSuggestions, onStop, onReportError, onSaveRemote, isSavingRemote,
  remoteSaveStatus, isDarkMode, onToggleTheme, onToggleMessageSources,
  exportStatus, exportError, pdfReportContent, onOpenEmailModal,
  onOpenFollowUpModal, userHeaderNode, onLogout, lastUserQuery, processing,
  onDeepDive,
  onDeleteMessage,
  onSaveToCRM,
  onOpenKanban,
}) => {
  const { mode, setMode } = useMode();
  const { user, userId, updateName } = useAuth();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showWarRoom, setShowWarRoom] = useState(false);
  const [displayedSuggestions, setDisplayedSuggestions] = useState<string[]>([]);

  // ✅ TOAST PÓS-CANCELAMENTO
  const [showRetryToast, setShowRetryToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ UNDO para exclusão de mensagem (soft-delete: aguarda 5s antes de confirmar)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteWithUndo = (msgId: string) => {
    if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
    setPendingDeleteId(msgId);
    pendingDeleteTimer.current = setTimeout(() => {
      onDeleteMessage?.(msgId);
      setPendingDeleteId(null);
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
    setPendingDeleteId(null);
  };

  // ============================================
  // PRÉ-PREENCHIMENTO VIA EVENTO (CRM → Chat)
  // ============================================
  useEffect(() => {
    const handlePrefill = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (detail?.text) {
        setInput(detail.text);
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    };
    window.addEventListener('scout:prefill', handlePrefill);
    return () => window.removeEventListener('scout:prefill', handlePrefill);
  }, []);

  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length]);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === Sender.Bot && !lastMessage.isThinking && !lastMessage.isError) {
        setDisplayedSuggestions(extractDisplayedSuggestions(lastMessage.text));
      }
    }
  }, [messages]);

  useEffect(() => {
    setDisplayedSuggestions([]);
  }, [currentSession?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ Auto-fechar toast após 8 segundos
  useEffect(() => {
    if (showRetryToast) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setShowRetryToast(false);
      }, 8000);
    }
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [showRetryToast]);

  // ==========================================
  // LÓGICA PARA ESCONDER/EXIBIR SUGESTÕES
  // ==========================================
  const lastBotWithSuggestionsIndex = [...messages]
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.sender === Sender.Bot && m.suggestions && m.suggestions.length > 0)
    .map(({ i }) => i)
    .pop();

  const lastUserIndex = [...messages]
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.sender === Sender.User)
    .map(({ i }) => i)
    .pop();

  const hideSuggestionsForMessageId =
    lastBotWithSuggestionsIndex !== undefined &&
    lastUserIndex !== undefined &&
    lastUserIndex > lastBotWithSuggestionsIndex
      ? messages[lastBotWithSuggestionsIndex].id
      : null;

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
    setShowActionsMenu(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleActionClick = (prompt: string) => {
    setInput(prompt);
    setShowActionsMenu(false);
    textareaRef.current?.focus();
  };

  const handleCopyMarkdown = () => {
    const text = messages
      .filter(m => !m.isError && !m.isThinking)
      .map(m => `**${m.sender === Sender.User ? 'Você' : 'Scout 360'}:**\n${m.text}`)
      .join('\n\n---\n\n')
      .replace(/\[\[PORTA:\d+:P\d+:O\d+:R\d+:T\d+:A\d+\]\]/g, '');
    navigator.clipboard.writeText(text).then(() => alert('Copiado!'));
  };

  // ✅ STOP com toast
  const handleStopWithToast = () => {
    if (onStop) onStop();
    setShowRetryToast(true);
  };

  // ✅ Retry normal
  const handleRetryNormal = () => {
    setShowRetryToast(false);
    if (lastUserQuery) onSendMessage(lastUserQuery);
  };

  // ✅ Retry com modelo Flash (mais rápido)
  const handleRetryFlash = () => {
    setShowRetryToast(false);
    if (lastUserQuery) onSendMessage(lastUserQuery);
  };

  const headerTitle = cleanTitle(currentSession?.title || 'Nova Investigação');
  const displayTitle = headerTitle.length > 35 ? headerTitle.substring(0, 32) + '...' : headerTitle;
  const hasReport = messages.some(
    m => m.sender === Sender.Bot && !m.isThinking && !m.isError && (m.text?.length || 0) > 100
  );

  return (
    <div className={`flex h-[100dvh] w-full overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
      <SessionsSidebar
        sessions={sessions}
        currentSessionId={currentSession?.id || null}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
        onDeleteSession={onDeleteSession}
        onSaveToCRM={onSaveToCRM || (() => {})}
        onOpenKanban={onOpenKanban || (() => {})}
        isOpen={isSidebarOpen}
        onCloseMobile={onToggleSidebar}
        isDarkMode={isDarkMode}
      />

      <main className="flex-1 flex flex-col h-full min-h-0 relative w-full transition-all duration-300">

        <header className={`h-14 flex-shrink-0 flex items-center justify-between px-3 py-2 border-b backdrop-blur-md z-10 ${
          isDarkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            <button
              onClick={onToggleSidebar}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              ☰
            </button>
            <h1 className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {displayTitle}
            </h1>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasReport && !isLoading && (
              <>
                <button onClick={onExportPDF} className={`p-1.5 text-sm transition-colors ${
                  isDarkMode ? 'text-gray-400 hover:text-emerald-400' : 'text-gray-500 hover:text-emerald-500'
                }`} title="Exportar PDF">📄</button>
                <button onClick={onOpenEmailModal} className={`p-1.5 text-sm transition-colors ${
                  isDarkMode ? 'text-gray-400 hover:text-emerald-400' : 'text-gray-500 hover:text-emerald-500'
                }`} title="Enviar por email">📧</button>
                <button onClick={onOpenFollowUpModal} className={`p-1.5 text-sm transition-colors ${
                  isDarkMode ? 'text-gray-400 hover:text-emerald-400' : 'text-gray-500 hover:text-emerald-500'
                }`} title="Agendar follow-up">📅</button>
                <div className={`w-px h-4 mx-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
              </>
            )}
            <button
              onClick={() => setShowWarRoom(true)}
              className={`p-2 rounded-lg transition-all ${
                isDarkMode ? 'text-gray-500 hover:text-red-400 hover:bg-gray-800' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
              }`}
              title="War Room: Inteligência Competitiva"
            >⚔️</button>
            <ConfirmPopover message="Limpar conversa?" onConfirm={onClearChat} isDarkMode={isDarkMode}>
              {({ onClick }) => (
                <button
                  onClick={onClick}
                  className={`p-2 rounded-lg transition-all ${
                    isDarkMode ? 'text-gray-500 hover:text-red-400 hover:bg-gray-800' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
                  }`}
                  title="Limpar conversa"
                >🗑️</button>
              )}
            </ConfirmPopover>
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 rounded-lg transition-all ${
                isDarkMode ? 'text-gray-500 hover:text-emerald-400 hover:bg-gray-800' : 'text-gray-400 hover:text-emerald-500 hover:bg-gray-100'
              }`}
              title="Configurações"
            >⚙️</button>
          </div>
        </header>

        <SettingsDrawer
          isOpen={showSettings} onClose={() => setShowSettings(false)} userName={user?.displayName || ''}
          onUpdateName={updateName} mode={mode} onSetMode={setMode} isDarkMode={isDarkMode}
          onToggleTheme={onToggleTheme} onOpenDashboard={() => setShowDashboard(true)}
          onExportPDF={onExportPDF} onCopyMarkdown={handleCopyMarkdown}
          onSendEmail={onOpenEmailModal} onScheduleFollowUp={onOpenFollowUpModal} exportStatus={exportStatus}
        />

        {showDashboard && (
          <InvestigationDashboard
            onClose={() => setShowDashboard(false)}
            onSelectEmpresa={(empresa) => { onSendMessage(`Investigar ${empresa}`); setShowDashboard(false); }}
          />
        )}

        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 scroll-smooth custom-scrollbar relative">
          {messages.length === 0 ? (
            <EmptyStateHome mode={mode} onSendMessage={onSendMessage} onPreFill={(text) => setInput(text)} isDarkMode={isDarkMode} />
          ) : (
            <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-6 pb-4 px-2 md:px-6 lg:px-8">
              {hasMore && (
                <div className="flex justify-center">
                  <button onClick={onLoadMore} className="text-xs text-slate-500 hover:text-emerald-500">
                    Carregar anteriores
                  </button>
                </div>
              )}

              {messages.map((msg, idx) => {
                const isBot = msg.sender === Sender.Bot;
                const isLast = idx === messages.length - 1;

                if (msg.isThinking) {
                  return (
                    <div key={msg.id} className="flex justify-start animate-fade-in">
                      <div className={`rounded-2xl p-4 shadow-sm ${
                        isDarkMode ? 'bg-slate-900' : 'bg-white'
                      } border ${
                        isDarkMode ? 'border-gray-700/30' : 'border-gray-200'
                      } px-3 md:px-5 py-3 md:py-4 w-full`}>
                        <div className="flex items-center justify-between mb-2 opacity-70 text-[10px] uppercase font-bold tracking-wider select-none">
                          <span>{mode === 'operacao' ? '🚺 Operação' : '✈️ Diretoria'}</span>
                          <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <LoadingSmart
                          isLoading={isLoading}
                          mode={mode}
                          isDarkMode={isDarkMode}
                          onStop={isLoading ? handleStopWithToast : undefined}
                          processing={processing}
                          searchQuery={lastUserQuery}
                        />
                        <div className={`mt-2 text-xs font-mono ${isDarkMode ? 'text-emerald-600' : 'text-emerald-400'} animate-pulse select-none`}>
                          ▋
                        </div>
                      </div>
                    </div>
                  );
                }

                if (msg.isError && msg.errorDetails) {
                  return (
                    <ErrorMessageCard
                      key={msg.id}
                      error={msg.errorDetails}
                      onRetry={onRetry}
                      isLoadingRetry={isLoading}
                      isDarkMode={isDarkMode}
                      mode={mode}
                      onReportError={onReportError ? () => onReportError(msg.id, msg.errorDetails!) : undefined}
                    />
                  );
                }

                if (isBot && !msg.isThinking && !msg.isError && (!msg.text || msg.text.trim() === '')) {
                  return (
                    <div key={msg.id} className="flex justify-start animate-fade-in w-full max-w-3xl">
                      <div className={`rounded-2xl p-5 shadow-sm w-full border ${
                        isDarkMode ? 'bg-red-950/20 border-red-900/50' : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-start gap-3">
                          <span className="text-2xl mt-1">👻</span>
                          <div>
                            <h4 className={`text-xs font-black uppercase tracking-widest mb-1 ${
                              isDarkMode ? 'text-red-400' : 'text-red-700'
                            }`}>
                              Conexão Degolada (Ghost Message)
                            </h4>
                            <p className={`text-xs leading-relaxed mb-4 ${
                              isDarkMode ? 'text-red-300' : 'text-red-600'
                            }`}>
                              A conexão com o motor de inteligência foi interrompida pelo navegador (timeout ou oscilação de rede) antes da resposta chegar. O sistema preservou o histórico, mas os dados não puderam ser exibidos.
                            </p>
                            <button
                              onClick={() => onRetry && onRetry()}
                              disabled={isLoading}
                              className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg shadow-lg transition-all flex items-center gap-2 ${
                                isLoading
                                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none'
                                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                              }`}
                            >
                              <span>↻</span> {isLoading ? 'Processando...' : 'Tentar Novamente'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const textSources = extractSources(msg.text || '');
                const rawSources = (msg.groundingSources && msg.groundingSources.length > 0)
                  ? msg.groundingSources
                  : textSources;
                const displaySources = rawSources.filter(s => s.url && !isFakeUrl(s.url));
                const sourcesCount = displaySources.length;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      isBot ? 'justify-start' : 'justify-end'
                    } animate-fade-in group/msg items-start gap-1.5 transition-opacity duration-300 ${
                      pendingDeleteId === msg.id ? 'opacity-30 pointer-events-none' : ''
                    }`}
                  >
                    {!isBot && onDeleteMessage && (
                      <button
                        onClick={() => handleDeleteWithUndo(msg.id)}
                        className={`self-start mt-[38px] flex-shrink-0 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 p-1.5 rounded-lg text-sm ${
                          isDarkMode
                            ? 'text-slate-600 hover:text-red-400 hover:bg-slate-800'
                            : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                        }`}
                        title="Excluir esta mensagem"
                      >
                        🗑️
                      </button>
                    )}

                    <div className={`rounded-2xl p-4 shadow-sm relative ${
                      isBot
                        ? `${
                            isDarkMode ? 'bg-slate-900' : 'bg-white'
                          } border ${
                            isDarkMode ? 'border-gray-700/30' : 'border-gray-200'
                          } px-3 md:px-5 py-3 md:py-4 w-full`
                        : `${
                            isDarkMode
                              ? 'bg-emerald-900/20 border border-emerald-900/30 text-emerald-100'
                              : 'bg-emerald-50 border border-emerald-100 text-slate-800'
                          } max-w-[90%] md:max-w-[75%] lg:max-w-[60%]`
                    }`}>
                      <div className="flex items-center justify-between mb-2 opacity-70 text-[10px] uppercase font-bold tracking-wider select-none">
                        <span>{isBot ? (mode === 'operacao' ? '🚺 Operação' : '✈️ Diretoria') : '👤 Você'}</span>
                        <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {isBot ? (
                        <>
                          {msg.scorePorta && (
                            <ScorePorta
                              score={msg.scorePorta.score}
                              p={msg.scorePorta.p}
                              o={msg.scorePorta.o}
                              r={msg.scorePorta.r}
                              t={msg.scorePorta.t}
                              a={msg.scorePorta.a}
                              isDarkMode={isDarkMode}
                            />
                          )}

                          <SectionalBotMessage
                            message={{ ...msg, groundingSources: displaySources }}
                            sessionId={currentSession?.id}
                            userId={userId}
                            isDarkMode={isDarkMode}
                            mode={mode}
                            onPreFillInput={setInput}
                            onRegenerateSuggestions={onRegenerateSuggestions}
                            hideSuggestions={msg.id === hideSuggestionsForMessageId}
                          />

                          {isLast && !isLoading && onDeepDive && (
                            <DeepDiveTopics onSelectTopic={onDeepDive} />
                          )}

                          <MessageActionsBar
                            content={msg.text}
                            sourcesCount={sourcesCount}
                            currentFeedback={msg.feedback}
                            onFeedback={(fb) => onFeedback(msg.id, fb)}
                            onSubmitFeedback={(fb, comment, content) => onSendFeedback(msg.id, fb, comment, content)}
                            onToggleSources={() => onToggleMessageSources(msg.id)}
                            isSourcesVisible={!!msg.isSourcesOpen}
                            isDarkMode={isDarkMode}
                          />
                        </>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">
                          {msg.text}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {showRetryToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
            <div className={`rounded-xl shadow-2xl border px-4 py-3 min-w-[320px] max-w-md ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">⚠️</span>
                <div className="flex-1">
                  <p className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                    Cancelado — Tentar novamente?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRetryNormal}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                        isDarkMode
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      }`}
                    >
                      🔄 Tentar novamente
                    </button>
                    <button
                      onClick={handleRetryFlash}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                        isDarkMode
                          ? 'border-slate-600 hover:bg-slate-700 text-slate-300'
                          : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                      }`}
                      title="Tenta com o modelo mais rápido (Flash)"
                    >
                      ⚡ Mais rápido
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowRetryToast(false)}
                  className={`text-xl opacity-50 hover:opacity-100 transition-opacity ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        {/* UNDO DELETE TOAST */}
        {pendingDeleteId && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
            <div className={`flex items-center gap-3 rounded-xl shadow-xl border px-4 py-2.5 ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <span className="text-sm">Mensagem excluída</span>
              <button
                onClick={handleUndoDelete}
                className="text-sm font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                Desfazer
              </button>
            </div>
          </div>
        )}

        <div className={`flex-shrink-0 p-3 pb-4 md:p-6 border-t ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
        } z-20`}>
          <div className="w-full max-w-5xl xl:max-w-6xl mx-auto px-1 md:px-6 lg:px-8 relative">

            {showActionsMenu && (
              <div
                ref={actionsMenuRef}
                className={`absolute bottom-full left-2 md:left-8 mb-2 w-72 rounded-xl shadow-xl border overflow-hidden animate-fade-in z-50 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className={`px-4 py-3 border-b text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                  isDarkMode ? 'border-slate-700 text-emerald-400' : 'border-slate-100 text-emerald-600'
                }`}>
                  <span>⚡</span> Ações Rápidas
                </div>
                <div className="flex flex-col py-1 max-h-[40vh] overflow-y-auto">
                  {QUICK_ACTIONS.map((qa) => (
                    <button
                      key={qa.label}
                      onClick={() => handleActionClick(qa.prompt)}
                      className={`flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                        isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-emerald-50 text-slate-700'
                      }`}
                    >
                      <span className="text-lg">{qa.icon}</span>
                      <span className="font-medium">{qa.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`relative flex items-end w-full rounded-2xl border pl-2 pr-12 py-2 shadow-sm ${
              isDarkMode ? 'border-gray-700/50 bg-gray-800/80' : 'border-gray-300 bg-white'
            }`}>

              {!isLoading && messages.length > 0 && (
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className={`p-2 rounded-xl transition-colors flex-shrink-0 mr-1 mb-0.5 ${
                    isDarkMode ? 'text-emerald-400 hover:bg-slate-700' : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                  title="Ações Rápidas"
                >
                  ⚡
                </button>
              )}

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLoading ? 'Gerando resposta...' : 'Digite sua mensagem...'}
                disabled={isLoading}
                rows={1}
                className={`flex-1 bg-transparent text-sm outline-none resize-none min-h-[36px] max-h-[100px] mb-1 px-2 custom-scrollbar ${
                  isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
                }`}
                style={{ overflow: 'hidden' }}
              />

              {isLoading ? (
                <button
                  onClick={handleStopWithToast}
                  className={`absolute right-2 bottom-2 w-10 h-10 flex items-center justify-center rounded-xl transition-all border ${
                    isDarkMode
                      ? 'bg-red-950/70 hover:bg-red-900/90 border-red-900/60 text-red-400 hover:text-red-300'
                      : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-500 hover:text-red-600'
                  }`}
                  title="Parar geração"
                >
                  <span className="text-base leading-none">⏹</span>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={`absolute right-2 bottom-2 w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-md ${
                    !input.trim()
                      ? (isDarkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400')
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white hover:scale-105 active:scale-95 shadow-emerald-500/30'
                  }`}
                >
                  <span className="text-lg ml-0.5">➤</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <WarRoom
          isOpen={showWarRoom}
          onClose={() => setShowWarRoom(false)}
          isDarkMode={isDarkMode}
          onExecuteOSINT={async (prompt) => {
            try {
              return await runWarRoomOSINT(prompt);
            } catch (error: any) {
              return `**⚠️ Falha na Conexão OSINT.**\n\nDetalhe técnico: \`${error.message}\``;
            }
          }}
        />
      </main>
    </div>
  );
};

export default ChatInterface;
