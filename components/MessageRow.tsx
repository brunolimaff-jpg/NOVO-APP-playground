import React, { memo, useRef, useEffect } from 'react';
import { Message, Sender, AppError, Feedback } from '../types';
import { ChatMode } from '../constants';
import GhostMessageBlock from './GhostMessageBlock';
import ErrorMessageCard from './ErrorMessageCard';
import SectionalBotMessage from './SectionalBotMessage';
import LoadingSmart from './LoadingSmart';
import ScorePorta from './ScorePorta';
import MessageActionsBar from './MessageActionsBar';
import { DeepDiveTopics } from './DeepDiveTopics';
import { extractSources } from '../utils/textCleaners';
import { isFakeUrl } from '../services/apiConfig';

export interface MessageRowData {
  messages: Message[];
  isLoading: boolean;
  isDarkMode: boolean;
  mode: ChatMode;
  onRetry?: () => void;
  onDeleteMessage?: (id: string) => void;
  onReportError?: (id: string, err: AppError) => void;
  onFeedback: (messageId: string, feedback: Feedback) => void;
  onSendFeedback: (messageId: string, feedback: Feedback, comment: string, content: string) => void;
  onToggleMessageSources: (messageId: string) => void;
  onDeepDive?: (display: string, hidden: string) => Promise<void>;
  onRegenerateSuggestions: (messageId: string) => void;
  handleDeleteWithUndo: (msgId: string) => void;
  pendingDeleteId: string | null;
  hideSuggestionsForMessageId: string | null;
  setInput: (text: string) => void;
  sessionId?: string;
  userId?: string;
  processing?: string[];
  lastUserQuery?: string;
  onStop?: () => void;
  onHeightChange?: (index: number, height: number) => void;
}

interface MessageRowProps {
  index: number;
  data: MessageRowData;
}

const MessageRow = memo(({ index, data }: MessageRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const {
    messages, isLoading, isDarkMode, mode, onRetry, onDeleteMessage, onReportError,
    onFeedback, onSendFeedback, onToggleMessageSources, onDeepDive, onRegenerateSuggestions,
    handleDeleteWithUndo, pendingDeleteId, hideSuggestionsForMessageId,
    setInput, sessionId, userId, processing, lastUserQuery, onStop,
  } = data;

  const msg = messages[index];
  if (!msg) return null;

  const isBot = msg.sender === Sender.Bot;
  const isLast = index === messages.length - 1;

  let content: React.ReactNode;

  if (msg.isThinking) {
    content = (
      <div className="flex justify-start animate-fade-in">
        <div className={`rounded-2xl p-4 shadow-sm w-full ${
          isDarkMode ? 'bg-slate-900 border border-gray-700/30' : 'bg-white border border-gray-200'
        } px-3 md:px-5 py-3 md:py-4`}>
          <div className="flex items-center justify-between mb-2 opacity-70 text-[10px] uppercase font-bold tracking-wider select-none">
            <span>{mode === 'operacao' ? '😺 Operação' : '✈️ Diretoria'}</span>
            <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <LoadingSmart isLoading={isLoading} mode={mode} isDarkMode={isDarkMode} onStop={isLoading ? onStop : undefined} processing={processing} searchQuery={lastUserQuery} />
          <div className={`mt-2 text-xs font-mono ${isDarkMode ? 'text-emerald-600' : 'text-emerald-400'} animate-pulse select-none`}>▋</div>
        </div>
      </div>
    );
  } else if (msg.isError && msg.errorDetails) {
    content = (
      <ErrorMessageCard
        error={msg.errorDetails} onRetry={onRetry || (() => {})} isLoadingRetry={isLoading}
        isDarkMode={isDarkMode} mode={mode}
        onReportError={onReportError ? () => onReportError(msg.id, msg.errorDetails!) : undefined}
      />
    );
  } else if (isBot && !msg.isThinking && !msg.isError && (!msg.text || msg.text.trim() === '')) {
    content = (
      <div className="flex justify-start animate-fade-in w-full max-w-3xl">
        <GhostMessageBlock msg={msg} onRetry={onRetry} isLoading={isLoading} isDarkMode={isDarkMode} />
      </div>
    );
  } else {
    const textSources = extractSources(msg.text || '');
    const rawSources = (msg.groundingSources && msg.groundingSources.length > 0) ? msg.groundingSources : textSources;
    const displaySources = rawSources.filter(s => s.url && !isFakeUrl(s.url));
    const sourcesCount = displaySources.length;

    content = (
      <div className={`flex ${
        isBot ? 'justify-start' : 'justify-end'
      } animate-fade-in group/msg items-start gap-1.5 transition-opacity duration-300 ${
        pendingDeleteId === msg.id ? 'opacity-30 pointer-events-none' : ''
      }`}>
        {!isBot && onDeleteMessage && (
          <button
            onClick={() => handleDeleteWithUndo(msg.id)}
            className={`self-start mt-[38px] flex-shrink-0 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 p-1.5 rounded-lg text-sm ${
              isDarkMode ? 'text-slate-600 hover:text-red-400 hover:bg-slate-800' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
            }`}
            title="Excluir esta mensagem"
          >🗑️</button>
        )}
        <div className={`rounded-2xl p-4 shadow-sm relative ${
          isBot
            ? `${isDarkMode ? 'bg-slate-900' : 'bg-white'} border ${isDarkMode ? 'border-gray-700/30' : 'border-gray-200'} px-3 md:px-5 py-3 md:py-4 w-full`
            : `${isDarkMode ? 'bg-emerald-900/20 border border-emerald-900/30 text-emerald-100' : 'bg-emerald-50 border border-emerald-100 text-slate-800'} max-w-[90%] md:max-w-[75%] lg:max-w-[60%]`
        }`}>
          <div className="flex items-center justify-between mb-2 opacity-70 text-[10px] uppercase font-bold tracking-wider select-none">
            <span>{isBot ? (mode === 'operacao' ? '😺 Operação' : '✈️ Diretoria') : '👤 Você'}</span>
            <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {isBot ? (
            <>
              {msg.scorePorta && (
                <ScorePorta score={msg.scorePorta.score} p={msg.scorePorta.p} o={msg.scorePorta.o} r={msg.scorePorta.r} t={msg.scorePorta.t} a={msg.scorePorta.a} isDarkMode={isDarkMode} />
              )}
              <SectionalBotMessage
                message={{ ...msg, groundingSources: displaySources }}
                sessionId={sessionId} userId={userId} isDarkMode={isDarkMode} mode={mode}
                onPreFillInput={setInput} onRegenerateSuggestions={onRegenerateSuggestions}
                hideSuggestions={msg.id === hideSuggestionsForMessageId}
              />
              {isLast && !isLoading && onDeepDive && <DeepDiveTopics onSelectTopic={onDeepDive} />}
              <MessageActionsBar
                content={msg.text} sourcesCount={sourcesCount} currentFeedback={msg.feedback}
                onFeedback={(fb) => onFeedback(msg.id, fb)}
                onSubmitFeedback={(fb, comment, content) => onSendFeedback(msg.id, fb, comment, content)}
                onToggleSources={() => onToggleMessageSources(msg.id)}
                isSourcesVisible={!!msg.isSourcesOpen} isDarkMode={isDarkMode}
              />
              {msg.isSourcesOpen && displaySources.length > 0 && (
                <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>📚 Fontes</p>
                  <ul className="space-y-1.5">
                    {displaySources.map((s, i) => (
                      <li key={i} className="text-xs">
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline break-all">{s.title || s.url}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{msg.text}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={rowRef} className="pb-6 px-2 md:px-6 lg:px-8">
      {content}
    </div>
  );
});

MessageRow.displayName = 'MessageRow';
export default MessageRow;
