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
import WarRoom from './WarRoom'; // <-- WAR ROOM IMPORTADA AQUI
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

type ExtendedChatInterfaceProps = ChatInterfaceProps & {
  onDeepDive?: (displayMessage: string, hiddenPrompt: string) => void;
};

const ChatInterface: React.FC<ExtendedChatInterfaceProps> = ({
  currentSession, sessions, onNewSession, onSelectSession, onDeleteSession,
  isSidebarOpen, onToggleSidebar, messages, isLoading, hasMore,
  onSendMessage, onFeedback, onSendFeedback, onSectionFeedback, onLoadMore, 
  onExportConversation, onExportPDF, onExportMessage, onRetry, onClearChat,
  onRegenerateSuggestions, onStop, onReportError, onSaveRemote, isSavingRemote, 
  remoteSaveStatus, isDarkMode, onToggleTheme, onToggleMessageSources, 
  exportStatus, exportError, pdfReportContent, onOpenEmailModal,
  onOpenFollowUpModal, userId, onLogout, lastUserQuery, processing,
  onDeepDive
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
  const [showWarRoom, setShowWarRoom] = useState(false); // <-- ESTADO DA WAR ROOM
  
  const [displayedSuggestions, setDisplayedSuggestions] = useState<string[]>([]);

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
    <div className={`flex h-[100dvh] w-full overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <SessionsSidebar
        sessions={sessions} currentSessionId={currentSession?.id || null}
        onSelectSession={onSelectSession} onNewSession={onNewSession} onDeleteSession={onDeleteSession}
        isOpen={isSidebarOpen} onCloseMobile={onToggleSidebar} isDarkMode={isDarkMode}
      />

      <main className="flex-1 flex flex-col h-full min-h-0 relative w-full transition-all duration-300">
        
        {/* Cabeçalho fixo no topo */}
        <header className={`h-14 flex-shrink-0 flex items-center justify-between px-3 py-2 border-b backdrop-blur-md z-10 ${isDarkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-200'}`}>
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            <button onClick={onToggleSidebar} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
              ☰
            </button>
            <h1 className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{displayTitle}</h1>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasReport && !isLoading && (
              <>
                <button onClick={onExportPDF} className={`p-1.5 text-sm transition-colors ${isDarkMode ? 'text-gray-400 hover:text-emerald-400' : 'text-gray-500 hover:text-emerald-500'}`} title="Exportar PDF">📄</button>
                <button onClick={onOpenEmailModal} className={`p-1.5 text-sm transition-colors ${isDarkMode ? 'text-gray-400 hover:text-emerald-400' : 'text-gray-500 hover:text-emerald-500'}`} title="Enviar por email">📧</button>
                <button onClick={onOpenFollowUpModal} className={`p-1.5 text-sm transition-colors ${isDarkMode ? 'text-gray-400 hover:text-emerald-400' : 'text-gray-500 hover:text-emerald-500'}`} title="Agendar follow-up">📅</button>
                <div className={`w-px h-4 mx-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
              </>
            )}
            
            {/* BOTÃO DA WAR ROOM ⚔️ */}
            <button 
              onClick={() => setShowWarRoom(true)} 
              className={`p-2 rounded-lg transition-all ${isDarkMode ? 'text-gray-500 hover:text-red-500 hover:bg-red-900/30' : 'text-gray-500 hover:text-red-600 hover:bg-red-50'}`} 
              title="War Room: Inteligência Competitiva"
            >
              ⚔️
            </button>

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

        {/* 3. Área de Rolagem Central */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 scroll-smooth custom-scrollbar relative">
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
                const isBot = msg.sender === Sender.Bot;
                const isLast = idx === messages.length - 1;

                if (msg.isThinking) {
                  return (
                    <div key={msg.id} className={`flex justify-start animate-fade-in`}>
                      <div className={`rounded-2xl p-4 shadow-sm ${isDarkMode ? 'bg-slate-900' : 'bg-white'} border border-gray-700/30 px-3 md:px-5 py-3 md:py-4 w-full`}>
                        <div className="flex items-center justify-between mb-2 opacity-70 text-[10px] uppercase font-bold tracking-wider select-none">
                          <span>{mode === 'operacao' ? '🚺 Operação' : '✈️ Diretoria'}</span>
                          <span>{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <LoadingSmart isLoading={isLoading} mode={mode} isDarkMode={isDarkMode} onStop={isLoading ? onStop : undefined} processing={processing} searchQuery={lastUserQuery} />
                      </div>
                    </div>
                  );
                }

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
                        <span>{isBot ? (mode === 'operacao' ? '🚺 Operação' : '✈️ Diretoria') : '👤 Você'}</span>
                        <span>{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>

                      {isBot ? (
                        <>
                           {msg.scorePorta && (
                             <ScorePorta
                               score={msg.scorePorta.score} p={msg.scorePorta.p} o={msg.scorePorta.o} r={msg.scorePorta.r} t={msg.scorePorta.t} a={msg.scorePorta.a} isDarkMode={isDarkMode}
                             />
                           )}

                           <SectionalBotMessage
                                message={{...msg, groundingSources: displaySources}}
                                sessionId={currentSession?.id} userId={typeof userId === 'string' ? userId : undefined}
                                isDarkMode={isDarkMode} mode={mode} onPreFillInput={setInput} onRegenerateSuggestions={onRegenerateSuggestions}
                           />

                           {isLast && !isLoading && onDeepDive && (
                             <DeepDiveTopics onSelectTopic={onDeepDive} />
                           )}

                           <MessageActionsBar
                               content={msg.text} sourcesCount={0} currentFeedback={msg.feedback}
                               onFeedback={(fb) => onFeedback(msg.id, fb)}
                               onSubmitFeedback={(fb, comment, content) => onSendFeedback(msg.id, fb, comment, content)}
                               onToggleSources={() => onToggleMessageSources(msg.id)} isSourcesVisible={!!msg.isSourcesOpen} isDarkMode={isDarkMode}
                           />
                        </>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{msg.text}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 4. Rodapé fixo */}
        <div className={`flex-shrink-0 p-3 pb-4 md:p-6 border-t ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'} z-20`}>
          <div className="w-full max-w-5xl xl:max-w-6xl mx-auto px-1 md:px-6 lg:px-8 relative">
            
            {showActionsMenu && (
              <div ref={actionsMenuRef} className={`absolute bottom-full left-2 md:left-8 mb-2 w-72 rounded-xl shadow-xl border overflow-hidden animate-fade-in z-50 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`px-4 py-3 border-b text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'border-slate-700 text-emerald-400' : 'border-slate-100 text-emerald-600'}`}>
                  <span>⚡</span> Ações Rápidas
                </div>
                <div className="flex flex-col py-1 max-h-[40vh] overflow-y-auto">
                  {QUICK_ACTIONS.map((qa) => (
                     <button key={qa.label} onClick={() => handleActionClick(qa.prompt)} className={`flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-emerald-50 text-slate-700'}`}>
                       <span className="text-lg">{qa.icon}</span><span className="font-medium">{qa.label}</span>
                     </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`relative flex items-end w-full rounded-2xl border pl-2 pr-12 py-2 shadow-sm ${isDarkMode ? 'border-gray-700/50 bg-gray-800/80' : 'border-gray-300 bg-white'}`}>
              
              {!isLoading && messages.length > 0 && (
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className={`p-2 rounded-xl transition-colors flex-shrink-0 mr-1 mb-0.5 ${isDarkMode ? 'text-emerald-400 hover:bg-slate-700' : 'text-emerald-600 hover:bg-emerald-50'}`}
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
                className={`flex-1 bg-transparent text-sm outline-none resize-none min-h-[36px] max-h-[100px] mb-1 px-2 custom-scrollbar ${isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
                style={{ overflow: 'hidden' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`absolute right-2 bottom-2 w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-md ${
                  !input.trim() || isLoading 
                    ? (isDarkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400') 
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white hover:scale-105 active:scale-95 shadow-emerald-500/30'
                }`}
              >
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="text-lg ml-0.5">➤</span>}
              </button>
            </div>
          </div>
        </div>

                                {/* ==========================================
            RENDERIZAÇÃO DA WAR ROOM (TRAVADA NO DEEP RESEARCH)
            ========================================== */}
        <WarRoom 
          isOpen={showWarRoom} 
          onClose={() => setShowWarRoom(false)} 
          isDarkMode={isDarkMode} 
          onExecuteOSINT={async (prompt) => {
            try {
              // A Constante do Deep Research cravada aqui
              const DEEP_RESEARCH_MODEL_ID = 'deep-research-pro-preview-12-2025';
              
              // Chama o serviço passando a constante travada
              const result = await executeWarRoomOSINT(prompt, DEEP_RESEARCH_MODEL_ID);
              return result;
            } catch (error: any) {
              return `**⚠️ Falha na Conexão OSINT.**\n\nO motor rejeitou a chamada ou o site do alvo bloqueou a varredura.\n\nDetalhe técnico: \`${error.message}\``;
            }
          }}
        />

      </main>
    </div>
  );
};

export default ChatInterface;
