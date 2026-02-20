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
import DeepDiveTopics from './DeepDiveTopics';
import InvestigationDashboard from './InvestigationDashboard';
import SettingsDrawer from './SettingsDrawer';
import ScorePorta from './ScorePorta';
import { cleanTitle, extractSources } from '../utils/textCleaners';
import { isFakeUrl } from '../services/apiConfig';

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

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  currentSession, sessions, onNewSession, onSelectSession, onDeleteSession,
  isSidebarOpen, onToggleSidebar, messages, isLoading, hasMore,
  onSendMessage, onFeedback, onSendFeedback, onSectionFeedback, onLoadMore, 
  onExportConversation, onExportPDF, onExportMessage, onRetry, onClearChat,
  onRegenerateSuggestions, onStop, onReportError, onSaveRemote, isSavingRemote, 
  remoteSaveStatus, isDarkMode, onToggleTheme, onToggleMessageSources, 
  exportStatus, exportError, pdfReportContent, onOpenEmailModal,
  onOpenFollowUpModal, userId, onLogout, lastUserQuery, processing
}) => {
  const { mode, setMode } = useMode();
  const { user, updateName } = useAuth();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  
  const [input, setInput] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  
  const [displayedSuggestions, setDisplayedSuggestions] = useState<string[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [completedStatuses, setCompletedStatuses] = useState<string[]>([]);

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
        if (lastMessage.statuses && lastMessage.statuses.length > 0) {
          setCompletedStatuses(lastMessage.statuses);
          setCurrentStatus(lastMessage.statuses[lastMessage.statuses.length - 1]);
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    setCompletedStatuses([]);
    setCurrentStatus(null);
    setDisplayedSuggestions([]);
  }, [currentSession?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    navigator.clipboard.writeText(text).then(() => alert("Copiado!")).catch(() => alert("Erro ao copiar."));
  };

  const headerTitle = cleanTitle(currentSession?.title || 'Nova Investigação');
  const displayTitle = headerTitle.length > 35 ? headerTitle.substring(0, 32) + '...' : headerTitle;
  const hasReport = messages.some((m) => m.sender === Sender.Bot && !m.isThinking && !m.isError && (m.text?.length || 0) > 100);

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <SessionsSidebar
        sessions={sessions} currentSessionId={currentSession?.id || null}
        onSelectSession={onSelectSession} onNewSession={onNewSession} onDeleteSession={onDeleteSession}
        isOpen={isSidebarOpen} onCloseMobile={onToggleSidebar} isDarkMode={isDarkMode}
      />

      <main className="flex-1 flex flex-col h-full relative w-full transition-all duration-300">
        <header className={`h-14 flex items-center justify-between px-3 py-2 border-b backdrop-blur-md z-10 flex-shrink-0 ${isDarkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-200'}`}>
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            <button onClick={onToggleSidebar} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
              ☰
            </button>
            <h1 className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{displayTitle}</h1>
          </div>
          <div className="flex items-center gap-1">
            {hasReport && !isLoading && (
              <>
                <button onClick={onExportPDF} className={`p-1.5 text-sm transition-colors ${isDarkMode ? 'text-gray-400 hover:text-emerald-400' : 'text-gray-500 hover:text-emerald-500'}`} title="Exportar PDF">📄</button>
                <button onClick={onOpenEmailModal} className={`p-1.5 text-sm transition-colors ${isDarkMode ? 'text-gray-400 hover:text-emerald-400' : 'text-gray-500 hover:text-emerald-500'}`} title="Enviar por email">📧</button>
                <button onClick={onOpenFollowUpModal} className={`p-1.5 text-sm transition-colors ${isDarkMode ? 'text-gray-400 hover:text-emerald-400' : 'text-gray-500 hover:text-emerald-500'}`} title="Agendar follow-up">📅</button>
                <div className={`w-px h-4 mx-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
              </>
            )}
            <button onClick={() => { if (window.confirm("Limpar conversa?")) onClearChat(); }} className={`p-2 rounded-lg transition-all ${isDarkMode ? 'text-gray-500 hover:text-red-400 hover:bg-gray-800' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'}`} title="Limpar conversa">🗑️</button>
            <button onClick={() => setShowSettings(true)} className={`p-2 rounded-lg transition-all ${isDarkMode ? 'text-gray-500 hover:text-emerald-400 hover:bg-gray-800' : 'text-gray-400 hover:text-emerald-500 hover:bg-gray-100'}`} title="Configurações">⚙️</button>
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
          <InvestigationDashboard onClose={() => setShowDashboard(false)} onSelectEmpresa={(empresa) => { onSendMessage(`Investigar ${empresa}`); setShowDashboard(false); }} />
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth custom-scrollbar relative">
          {messages.length === 0 ? (
            <EmptyStateHome mode={mode} onSendMessage={onSendMessage} onPreFill={(text) => setInput(text)} isDarkMode={isDarkMode} />
          ) : (
            <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-6 pb-4 px-2 md:px-6 lg:px-8">
              {hasMore && (
                 <div className="flex justify-center">
                   <button onClick={onLoadMore} className="text-xs text-slate-500 hover:text-emerald-500">Carregar anteriores</button>
                 </div>
              )}

              {messages.map((msg, idx) => {
                if (msg.isThinking) return null;
                const isBot = msg.sender === Sender.Bot;
                const isLast = idx === messages.length - 1;
                
                if (msg.isError && msg.errorDetails) {
                    return <ErrorMessageCard key={msg.id} error={msg.errorDetails} onRetry={onRetry} isLoadingRetry={isLoading} isDarkMode={isDarkMode} mode={mode} onReportError={onReportError ? () => onReportError(msg.id, msg.errorDetails!) : undefined} />;
                }

                const textSources = extractSources(msg.text || "");
                const rawSources = (msg.groundingSources && msg.groundingSources.length > 0) ? msg.groundingSources : textSources;
                const displaySources = rawSources.filter(s => s.url && !isFakeUrl(s.url));

                return (
                  <div key={msg.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'} animate-fade-in`}>
                    <div className={`rounded-2xl p-4 shadow-sm relative group ${isBot ? `${isDarkMode ? 'bg-slate-900' : 'bg-white'} border border-gray-700/30 px-3 md:px-5 py-3 md:py-4 w-full` : `${isDarkMode ? 'bg-emerald-900/20 border border-emerald-900/30 text-emerald-100' : 'bg-emerald-50 border border-emerald-100 text-slate-800'} max-w-[90%] md:max-w-[75%] lg:max-w-[60%]`}`}>
                      <div className="flex items-center justify-between mb-2 opacity-70 text-[10px] uppercase font-bold tracking-wider select-none">
                        <span>{isBot ? (mode === 'operacao' ? '🛻 Operação' : '✈️ Diretoria') : '👤 Você'}</span>
                        <span>{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
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
                             />
                           )}
                           
                           <SectionalBotMessage 
                                message={{...msg, groundingSources: displaySources}}
                                sessionId={currentSession?.id}
                                userId={typeof userId === 'string' ? userId : undefined}
                                isDarkMode={isDarkMode}
                                mode={mode}
                                onPreFillInput={setInput}
                                onRegenerateSuggestions={onRegenerateSuggestions}
                           />

                           {isLast && !isLoading && (
                             <DeepDiveTopics 
                               onDeepDive={handleActionClick}
                               isDarkMode={isDarkMode}
                               empresaContext={currentSession?.empresaAlvo || currentSession?.title}
                             />
                           )}

                           <MessageActionsBar 
                               content={msg.text}
                               sourcesCount={displaySources.length}
                               currentFeedback={msg.feedback}
                               onFeedback={(fb) => onFeedback(msg.id, fb)}
                               onSubmitFeedback={(fb, comment, content) => onSendFeedback(msg.id, fb, comment, content)}
                               onToggleSources={() => onToggleMessageSources(msg.id)}
                               isSourcesVisible={!!msg.isSourcesOpen}
                               isDarkMode={isDarkMode}
                           />

                           {msg.isSourcesOpen && displaySources.length > 0 && (
                             <div className={`mt-3 p-4 rounded-xl border animate-slide-in ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'}`}>
                               <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-500/20">
                                 <div className="flex items-center gap-2">
                                   <span className="text-lg">📚</span>
                                   <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                     Fontes e Referências
                                   </span>
                                 </div>
                                 <span className={`text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                                   {displaySources.length} {displaySources.length === 1 ? 'fonte' : 'fontes'}
                                 </span>
                               </div>
                               <div className="space-y-2">
                                 {displaySources.map((s, i) => (
                                   <div key={i} className="flex items-start gap-3 group">
                                     <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center text-xs font-bold mt-0.5 shadow-sm">
                                       {i + 1}
                                     </span>
                                     <div className="flex-1 min-w-0">
                                       {s.url && !isFakeUrl(s.url) ? (
                                         <a 
                                           href={s.url} 
                                           target="_blank" 
                                           rel="noopener noreferrer" 
                                           className="block text-emerald-600 hover:text-emerald-500 hover:underline font-medium break-all leading-tight transition-colors"
                                         >
                                           {s.title}
                                         </a>
                                       ) : (
                                         <span className="block text-emerald-600 font-medium break-all leading-tight">{s.title}</span>
                                       )}
                                       {s.url && !isFakeUrl(s.url) && (
                                         <span className={`text-[10px] block mt-1 truncate opacity-60 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                           {s.url}
                                         </span>
                                       )}
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                        </>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{msg.text}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              <LoadingSmart isLoading={isLoading} mode={mode} isDarkMode={isDarkMode} onStop={isLoading ? onStop : undefined} processing={processing} searchQuery={lastUserQuery} currentStatus={currentStatus} completedStatuses={completedStatuses} />
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* SUGESTÕES IMEDIATAS COLADAS NO INPUT - COM CORES ORIGINAIS */}
        {displayedSuggestions.length > 0 && !isLoading && (
          <div className="w-full max-w-5xl xl:max-w-6xl mx-auto px-4 md:px-8 mb-2 flex flex-wrap gap-2 z-10 animate-slide-in">
            {displayedSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleActionClick(suggestion)}
                className={`text-[11px] md:text-xs px-3 py-1.5 rounded-full transition-all text-left shadow-sm border active:scale-95 ${
                  isDarkMode 
                    ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800 hover:border-emerald-500 hover:bg-emerald-900/50' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* ÁREA DE INPUT COM MENU ⚡ */}
        <div className={`p-4 md:p-6 border-t ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'} z-20`}>
          <div className="w-full max-w-5xl xl:max-w-6xl mx-auto px-2 md:px-6 lg:px-8 relative">
            
            {/* MENU FLUTUANTE DE AÇÕES RÁPIDAS */}
            {showActionsMenu && (
              <div ref={actionsMenuRef} className={`absolute bottom-full left-4 md:left-8 mb-2 w-72 rounded-xl shadow-xl border overflow-hidden animate-fade-in z-50 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`px-4 py-3 border-b text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'border-slate-700 text-emerald-400' : 'border-slate-100 text-emerald-600'}`}>
                  <span>⚡</span> Ações Rápidas
                </div>
                <div className="flex flex-col py-1">
                  {QUICK_ACTIONS.map((qa) => (
                     <button
                       key={qa.label}
                       onClick={() => handleActionClick(qa.prompt)}
                       className={`flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-emerald-50 text-slate-700'}`}
                     >
                       <span className="text-lg">{qa.icon}</span>
                       <span className="font-medium">{qa.label}</span>
                     </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`relative flex items-end w-full rounded-xl border pl-2 pr-12 py-2 ${isDarkMode ? 'border-gray-700/30 bg-gray-800/50' : 'border-gray-300 bg-white'}`}>
              
              {/* BOTÃO DO MENU DE AÇÕES RÁPIDAS ⚡ */}
              {!isLoading && messages.length > 0 && (
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 mr-1 mb-0.5 ${isDarkMode ? 'text-emerald-400 hover:bg-slate-700' : 'text-emerald-600 hover:bg-emerald-50'}`}
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
                placeholder={isLoading ? "Aguarde a resposta..." : "Digite sua mensagem..."}
                disabled={isLoading}
                rows={1}
                className={`flex-1 bg-transparent text-sm outline-none resize-none min-h-[36px] max-h-[100px] mb-1 custom-scrollbar ${isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
                style={{ overflow: 'hidden' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`absolute right-2 bottom-2 w-9 h-9 flex items-center justify-center rounded-xl transition-all shadow-md ${
                  !input.trim() || isLoading 
                    ? (isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-200 text-slate-400') 
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white hover:scale-110 active:scale-95 shadow-emerald-500/30'
                }`}
              >
                {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="text-lg">➤</span>}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatInterface;
