import React, { useRef, useEffect, useLayoutEffect, useState, useMemo } from 'react';
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
import { cleanTitle, extractSources } from '../utils/textCleaners';
import { isFakeUrl } from '../services/apiConfig';

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  currentSession,
  sessions,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  isSidebarOpen,
  onToggleSidebar,
  messages,
  isLoading,
  hasMore,
  onSendMessage,
  onFeedback,
  onSendFeedback,
  onSectionFeedback,
  onLoadMore,
  onExportConversation,
  onExportPDF,
  onExportMessage,
  onRetry,
  onClearChat,
  onRegenerateSuggestions,
  onStop,
  onReportError,
  onSaveRemote,
  isSavingRemote,
  remoteSaveStatus,
  isDarkMode,
  onToggleTheme,
  onToggleMessageSources,
  exportStatus,
  exportError,
  pdfReportContent,
  onOpenEmailModal,
  onOpenFollowUpModal,
  userId,
  onLogout,
  lastUserQuery,
  processing
}) => {
  const { mode, setMode } = useMode();
  const { user, updateName } = useAuth();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [input, setInput] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMarkdown = () => {
    const text = messages
        .filter(m => !m.isError && !m.isThinking)
        .map(m => `**${m.sender === Sender.User ? 'Você' : 'Scout 360'}:**\n${m.text}`)
        .join('\n\n---\n\n')
        .replace(/\[\[PORTA:\d+:P\d+:O\d+:R\d+:T\d+:A\d+\]\]/g, ''); 
    
    navigator.clipboard.writeText(text)
        .then(() => alert("Conversa copiada para a área de transferência!"))
        .catch(() => alert("Erro ao copiar."));
  };

  const headerTitle = cleanTitle(currentSession?.title || 'Nova Investigação');
  const displayTitle = headerTitle.length > 35 ? headerTitle.substring(0, 32) + '...' : headerTitle;

  const hasReport = messages.some((m) => {
    const text = m.text || '';
    return m.sender === Sender.Bot && !m.isThinking && !m.isError && text.length > 100;
  });

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      
      <SessionsSidebar
        sessions={sessions}
        currentSessionId={currentSession?.id || null}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
        onDeleteSession={onDeleteSession}
        isOpen={isSidebarOpen}
        onCloseMobile={onToggleSidebar}
        isDarkMode={isDarkMode}
      />

      <main className="flex-1 flex flex-col h-full relative w-full transition-all duration-300">
        
        <header className={`h-14 flex items-center justify-between px-3 py-2 border-b backdrop-blur-md z-10 flex-shrink-0 ${isDarkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-200'}`}>
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            <button 
              onClick={onToggleSidebar}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
            >
              ☰
            </button>
            <h1 className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {displayTitle}
            </h1>
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

            <button
              onClick={() => { if (window.confirm("Limpar conversa atual?")) onClearChat(); }}
              className={`p-2 rounded-lg transition-all ${isDarkMode ? 'text-gray-500 hover:text-red-400 hover:bg-gray-800' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'}`}
              title="Limpar conversa"
            >
              🗑️
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 rounded-lg transition-all ${isDarkMode ? 'text-gray-500 hover:text-emerald-400 hover:bg-gray-800' : 'text-gray-400 hover:text-emerald-500 hover:bg-gray-100'}`}
              title="Configurações"
            >
              ⚙️
            </button>
          </div>
        </header>

        <SettingsDrawer 
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            userName={user?.displayName || ''}
            onUpdateName={updateName}
            mode={mode}
            onSetMode={setMode}
            isDarkMode={isDarkMode}
            onToggleTheme={onToggleTheme}
            onOpenDashboard={() => setShowDashboard(true)}
            onExportPDF={onExportPDF}
            onCopyMarkdown={handleCopyMarkdown}
            onSendEmail={onOpenEmailModal}
            onScheduleFollowUp={onOpenFollowUpModal}
            exportStatus={exportStatus}
        />

        {showDashboard && (
          <InvestigationDashboard 
            onClose={() => setShowDashboard(false)}
            onSelectEmpresa={(empresa) => {
              onSendMessage(`Investigar ${empresa}`);
              setShowDashboard(false);
            }}
          />
        )}

        {pdfReportContent && (
           <div id="report-pdf-container" className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none w-[800px] bg-white p-10 text-black">
               <MarkdownRenderer content={pdfReportContent} isDarkMode={false} />
           </div>
        )}

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth custom-scrollbar relative"
        >
          {messages.length === 0 ? (
            <EmptyStateHome 
              mode={mode} 
              onSendMessage={onSendMessage} 
              onPreFill={(text) => setInput(text)}
              isDarkMode={isDarkMode}
            />
          ) : (
            <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-6 pb-4 px-2 md:px-6 lg:px-8">
              {hasMore && (
                 <div className="flex justify-center">
                   <button onClick={onLoadMore} className="text-xs text-slate-500 hover:text-emerald-500">
                     Carregar mensagens anteriores
                   </button>
                 </div>
              )}

              {messages.map((msg, idx) => {
                if (msg.isThinking) return null;

                const isBot = msg.sender === Sender.Bot;
                const isLast = idx === messages.length - 1;
                
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

                const textSources = extractSources(msg.text);
                const rawSources = (msg.groundingSources && msg.groundingSources.length > 0) 
                    ? msg.groundingSources 
                    : textSources;
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
                           {/* AQUI ESTÁ A CHAVE: Passamos onRegenerateSuggestions para o SectionalBotMessage */}
                           <SectionalBotMessage 
                                message={{...msg, groundingSources: displaySources}}
                                sessionId={currentSession?.id}
                                userId={typeof userId === 'string' ? userId : undefined}
                                isDarkMode={isDarkMode}
                                mode={mode}
                                onSendMessage={onSendMessage}
                                onRegenerateSuggestions={onRegenerateSuggestions}
                           />
                           
                           {isLast && !isLoading && (
                             <DeepDiveTopics 
                               onDeepDive={(prompt, label) => onSendMessage(prompt, label)} 
                               isDarkMode={isDarkMode} 
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
                             <div className={`mt-3 p-3 rounded-lg border text-xs animate-slide-in ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                               <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-500/20">
                                 <span className="text-emerald-500">📚</span>
                                 <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Fontes e Referências</span>
                               </div>
                               <div className="space-y-2">
                                 {displaySources.map((s, i) => (
                                   <div key={i} className="flex items-start gap-2.5 group">
                                     <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold mt-0.5 shadow-sm">{i + 1}</span>
                                     <div className="flex-1 min-w-0">
                                     {s.url && !isFakeUrl(s.url) ? (
                                       <a href={s.url} target="_blank" rel="noopener noreferrer" className="block text-emerald-500 hover:text-emerald-400 hover:underline font-medium break-all leading-tight transition-colors">{s.title}</a>
                                     ) : (
                                       <span className="block text-emerald-500 font-medium break-all leading-tight">{s.title}</span>
                                     )}
                                     {s.url && !isFakeUrl(s.url) && (<span className={`text-[10px] block mt-0.5 truncate opacity-60 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{s.url}</span>)}
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
              
              <LoadingSmart 
                isLoading={isLoading} 
                mode={mode} 
                isDarkMode={isDarkMode}
                onStop={isLoading ? onStop : undefined}
                processing={processing}
                searchQuery={lastUserQuery}
              />
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className={`p-4 md:p-6 border-t ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'} z-20`}>
          <div className="w-full max-w-5xl xl:max-w-6xl mx-auto px-2 md:px-6 lg:px-8">
            <div className={`relative flex items-end w-full rounded-xl border px-3 py-2 ${isDarkMode ? 'border-gray-700/30 bg-gray-800/50' : 'border-gray-300 bg-white'}`}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLoading ? "Aguarde a resposta..." : "Digite sua mensagem..."}
                disabled={isLoading}
                rows={1}
                className={`flex-1 bg-transparent text-sm outline-none resize-none min-h-[36px] max-h-[100px] pr-10 custom-scrollbar ${isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
                style={{ overflow: 'hidden' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`absolute right-2 bottom-2 w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm ${!input.trim() || isLoading ? (isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-200 text-slate-400') : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-105 active:scale-95 shadow-emerald-500/20'}`}
              >
                {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="text-sm">➤</span>}
              </button>
            </div>
            <div className="text-center mt-2">
               <p className={`text-[10px] ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Senior Scout 360 pode cometer erros. Verifique dados críticos.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatInterface;