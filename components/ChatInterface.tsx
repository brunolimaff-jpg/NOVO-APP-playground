import React, { useRef, useEffect, useLayoutEffect, useState, useMemo, useCallback } from 'react';
import MessageRow, { MessageRowData } from './MessageRow';
import { ChatInterfaceProps, Sender } from '../types';
import { useMode } from '../contexts/ModeContext';
import { useAuth } from '../contexts/AuthContext';
import SessionsSidebar from './SessionsSidebar';
import EmptyStateHome from './EmptyStateHome';
const InvestigationDashboard = React.lazy(() => import('./InvestigationDashboard'));
const SettingsDrawer = React.lazy(() => import('./SettingsDrawer'));
const WarRoom = React.lazy(() => import('./WarRoom'));
import { cleanTitle } from '../utils/textCleaners';
import { parseSmartOptions } from './SmartOptions'; // <-- ADICIONADO AQUI

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
        if (bulletMatch && bulletMatch[1].trim().length > 5)
          suggestions.push(bulletMatch[1].trim().replace(/["']$/, ''));
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
  canAccessInternalTools?: boolean;
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
  onDeepDive, onDeleteMessage, onSaveToCRM, onOpenKanban, canAccessInternalTools = true,
}) => {
  const { mode, setMode } = useMode();
  const { user, userId, updateName } = useAuth();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showWarRoom, setShowWarRoom] = useState(false);
  const [showRetryToast, setShowRetryToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    const handlePrefill = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (detail?.text) { setInput(detail.text); setTimeout(() => textareaRef.current?.focus(), 100); }
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

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node))
        setShowActionsMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showRetryToast) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowRetryToast(false), 8000);
    }
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [showRetryToast]);

  const lastBotWithSuggestionsIndex = useMemo(() =>
    [...messages]
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.sender === Sender.Bot && ((m.suggestions && m.suggestions.length > 0) || parseSmartOptions(m.text).options.length > 0)) // <-- CORREÇÃO AQUI
      .map(({ i }) => i)
      .pop(),
    [messages]);
    
  const lastUserIndex = useMemo(() =>
    [...messages].map((m, i) => ({ m, i })).filter(({ m }) => m.sender === Sender.User).map(({ i }) => i).pop(),
    [messages]);
    
  const hideSuggestionsForMessageId =
    lastBotWithSuggestionsIndex !== undefined &&
      lastUserIndex !== undefined &&
      lastUserIndex > lastBotWithSuggestionsIndex
      ? messages[lastBotWithSuggestionsIndex].id
      : null;

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input); setInput(''); setShowActionsMenu(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSend(); }
  };

  const handleActionClick = (prompt: string) => {
    setInput(prompt);
    setShowActionsMenu(false);
    textareaRef.current?.focus();
  };

  const handleCopyMarkdown = useCallback(() => {
    const text = messages.filter(m => !m.isError && !m.isThinking)
      .map(m => `**${m.sender === Sender.User ? 'Você' : 'Scout 360'}:**\n${m.text}`).join('\n\n---\n\n')
      .replace(/\[\[PORTA:\d+:P\d+:O\d+:R\d+:T\d+:A\d+\]\]/g, '');
    navigator.clipboard.writeText(text).then(() => alert('Copiado!'));
  }, [messages]);

  const handleStopWithToast = () => {
    if (onStop) onStop();
    setShowRetryToast(true);
  };

  const handleRetryNormal = () => {
    setShowRetryToast(false);
    if (onRetry) onRetry();
  };

  const headerTitle = cleanTitle(currentSession?.title || 'Nova Investigação');
  const displayTitle = headerTitle.length > 35 ? headerTitle.substring(0, 32) + '...' : headerTitle;
  const hasReport = messages.some(m => m.sender === Sender.Bot && !m.isThinking && !m.isError && (m.text?.length || 0) > 100);

  const itemData = useMemo<MessageRowData>(() => ({
    messages, isLoading, isDarkMode, mode, onRetry, onDeleteMessage, onReportError,
    onFeedback, onSendFeedback, onToggleMessageSources, onDeepDive, onRegenerateSuggestions,
    handleDeleteWithUndo,
    pendingDeleteId,
    hideSuggestionsForMessageId, setInput,
    sessionId: currentSession?.id, userId, processing, lastUserQuery,
    onStop: handleStopWithToast,
    onSendMessage, // <-- CORREÇÃO AQUI (Para as sugestões clicáveis enviarem sozinhas)
    empresaAlvo: currentSession?.empresaAlvo || null, // <-- NOVO: passar o nome da empresa
  }), [
    messages, isLoading, isDarkMode, mode, onRetry, onDeleteMessage, onReportError,
    onFeedback, onSendFeedback, onToggleMessageSources, onDeepDive, onRegenerateSuggestions,
    pendingDeleteId, hideSuggestionsForMessageId,
    currentSession?.id, currentSession?.empresaAlvo, userId, processing, lastUserQuery, handleStopWithToast,
    onSendMessage, // <-- CORREÇÃO AQUI NAS DEPENDÊNCIAS
  ]);

  return (
    <div className={`flex h-full w-full overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
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
        showCRMTools={canAccessInternalTools}
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
            >☰</button>
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
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 rounded-lg transition-all ${
                isDarkMode ? 'text-gray-500 hover:text-emerald-400 hover:bg-gray-800' : 'text-gray-400 hover:text-emerald-500 hover:bg-gray-100'
              }`}
              title="Configurações"
            >⚙️</button>
          </div>
        </header>

        {showSettings && (
          <React.Suspense fallback={null}>
            <SettingsDrawer
              isOpen={showSettings} onClose={() => setShowSettings(false)} userName={user?.displayName || ''}
              onUpdateName={updateName} mode={mode} onSetMode={setMode} isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme} onOpenDashboard={() => canAccessInternalTools && setShowDashboard(true)}
              onExportPDF={onExportPDF} onCopyMarkdown={handleCopyMarkdown}
              onSendEmail={onOpenEmailModal} onScheduleFollowUp={onOpenFollowUpModal} exportStatus={exportStatus}
              showInternalTools={canAccessInternalTools}
            />
          </React.Suspense>
        )}

        {canAccessInternalTools && showDashboard && (
          <React.Suspense fallback={null}>
            <InvestigationDashboard
              onClose={() => setShowDashboard(false)}
              onSelectEmpresa={(empresa) => { onSendMessage(`Investigar ${empresa}`); setShowDashboard(false); }}
            />
          </React.Suspense>
        )}

        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full p-4 md:p-6">
              <EmptyStateHome mode={mode} onSendMessage={onSendMessage} onPreFill={(text) => setInput(text)} isDarkMode={isDarkMode} />
            </div>
          ) : (
            <div className="py-4">
              {hasMore && (
                <div className="flex justify-center mb-2">
                  <button onClick={onLoadMore} className="text-xs text-slate-500 hover:text-emerald-500 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full shadow">
                    Carregar anteriores
                  </button>
                </div>
              )}
              {messages.map((msg, idx) => (
                <MessageRow key={msg.id} index={idx} data={itemData} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {showRetryToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
            <div className={`rounded-xl shadow-2xl border px-4 py-3 min-w-[320px] max-w-md ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">⚠️</span>
                <div className="flex-1">
                  <p className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                    Cancelado — Tentar novamente?
                  </p>
                  <button
                    onClick={handleRetryNormal}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    }`}
                  >
                    🔄 Tentar novamente
                  </button>
                </div>
                <button
                  onClick={() => setShowRetryToast(false)}
                  className={`text-xl opacity-50 hover:opacity-100 transition-opacity ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >×</button>
              </div>
            </div>
          </div>
        )}

        {pendingDeleteId && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
            <div className={`flex items-center gap-3 rounded-xl shadow-xl border px-4 py-2.5 ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <span className="text-sm">Mensagem excluída</span>
              <button
                onClick={handleUndoDelete}
                className="text-sm font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
              >Desfazer</button>
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
                >⚡</button>
              )}

              {!isLoading && messages.length > 0 && messages[messages.length - 1].sender === Sender.User && (
                <div className="absolute bottom-full left-0 mb-3 w-full flex justify-center animate-fade-in">
                  <div className={`flex items-center gap-3 px-4 py-2 rounded-full shadow-md border text-xs font-semibold ${
                    isDarkMode ? 'bg-slate-800 border-red-900/50 text-slate-200' : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    <span>⚠️ A resposta falhou ou foi perdida no reload.</span>
                    <button onClick={handleRetryNormal} className="px-3 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-sm transition-all flex items-center gap-1">
                      <span className="text-sm">🔄</span> Gerar Resposta
                    </button>
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLoading ? 'Gerando resposta...' : 'Investigar empresa, CNPJ ou colar ficha do Spotter...'}
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

        {showWarRoom && (
          <React.Suspense fallback={
            <div className={`fixed inset-0 z-50 flex items-center justify-center ${isDarkMode ? 'bg-slate-950/90' : 'bg-white/90'}`}>
              <div className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                Carregando War Room...
              </div>
            </div>
          }>
            <WarRoom
              isOpen={showWarRoom}
              onClose={() => setShowWarRoom(false)}
              isDarkMode={isDarkMode}
              defaultCompetitorTarget={null}
            />
          </React.Suspense>
        )}
      </main>
    </div>
  );
};

export default ChatInterface;