const fs = require('fs');
const path = require('path');

// Read and normalize CRLF to LF
const srcCode = fs.readFileSync('AppCore.tsx', 'utf8').replace(/\r\n/g, '\n');

const hookStartStr = "  const [sessions, setSessions] = useState<ChatSession[]>([]);";
const hookEndBoundary = "  const handleToggleMessageSources = (messageId: string) => {";
const handleSaveToCrmStr = "  const handleSaveToCRM = async (sessionId: string) => {";

const startIdx = srcCode.indexOf(hookStartStr);
let endIdx = srcCode.indexOf(handleSaveToCrmStr);

if (startIdx === -1 || endIdx === -1) {
  console.error("Boundaries not found. startIdx:", startIdx, "endIdx:", endIdx);
  process.exit(1);
}

// Ensure we include the newlines before handleSaveToCrm
const fullExtracted = srcCode.substring(startIdx, endIdx);

// The functions to EXCLUDE from useChat
const excludeFns = [
  "  async function handleExportPDF() {",
  "  const handleExportConversation = async (format: ExportFormat, reportType: ReportType) => {",
  "  async function handleSendEmail() {",
  "  async function handleScheduleFollowUp() {"
];

let useChatBody = fullExtracted;
let leftInAppCore = "";

// Find the start of handleExportPDF
const exportPdfIdx = useChatBody.indexOf(excludeFns[0]);
// Find the end of handleFeedback
const handleFeedbackIdx = useChatBody.indexOf("  const handleFeedback = (messageId: string, feedback: Feedback) => {");

if (exportPdfIdx !== -1 && handleFeedbackIdx !== -1) {
  // Cut the middle part out
  const part1 = useChatBody.substring(0, exportPdfIdx);
  const middlePart = useChatBody.substring(exportPdfIdx, handleFeedbackIdx);
  const part2 = useChatBody.substring(handleFeedbackIdx);

  useChatBody = part1 + part2;
  leftInAppCore = middlePart;
} else {
  console.error("Could not find the exclude functions bounded correctly.");
  process.exit(1);
}

const useChatContent = `import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { useMode } from '../contexts/ModeContext';
import { Message, Sender, Feedback, ChatSession, AppError } from '../types';
import { sendMessageToGemini, generateNewSuggestions, resetChatSession } from '../services/geminiService';
import { listRemoteSessions, getRemoteSession, saveRemoteSession } from '../services/sessionRemoteStore';
import { sendFeedbackRemote } from '../services/feedbackRemoteStore';
import { extractCompanyName } from '../AppCore';
import { cleanTitle, cleanStatusMarkers } from '../utils/textCleaners';
import { normalizeAppError } from '../utils/errorHelpers';
import { BACKEND_URL } from '../services/apiConfig';
import { useToast } from './useToast';

const SESSIONS_STORAGE_KEY = 'scout360_sessions_v1';
const THEME_KEY = 'scout360_theme';
const PAGE_SIZE = 20;

interface LastAction {
  type: 'sendMessage' | 'regenerateSuggestions';
  payload: any;
}

export const useChat = () => {
  const { userId, user, isAuthenticated } = useAuth();
  const { mode, systemInstruction } = useMode();
  const { toast } = useToast();

${useChatBody}

  return {
    sessions,
    currentSessionId,
    currentSession: sessions.find(s => s.id === currentSessionId) || null,
    allMessages: sessions.find(s => s.id === currentSessionId)?.messages || [],
    isLoading,
    isLoadingSession,
    loadingStatus,
    completedLoadingStatuses,
    lastQuery,
    isSavingRemote,
    remoteSaveStatus,
    isInitialized,
    visibleCount,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
    handleSaveRemote,
    handleClearChat,
    handleSendMessage,
    processMessage,
    handleDeepDive,
    handleDeleteMessage,
    handleStopGeneration,
    handleRetry,
    handleRegenerateSuggestions,
    handleReportError,
    handleFeedback,
    handleSendFeedback,
    handleSectionFeedback,
    handleToggleMessageSources,
    setVisibleCount,
    setSessions,
    updateSessionById
  };
};

`;

fs.mkdirSync('hooks', { recursive: true });
fs.writeFileSync('hooks/useChat.ts', useChatContent, 'utf8');

const appCoreNew = srcCode.substring(0, startIdx) +
  `  const {
    sessions, currentSessionId, currentSession, allMessages, isLoading, isLoadingSession,
    loadingStatus, completedLoadingStatuses, lastQuery, isSavingRemote, remoteSaveStatus,
    isInitialized, visibleCount, handleNewSession, handleSelectSession, handleDeleteSession,
    handleSaveRemote, handleClearChat, handleSendMessage, processMessage, handleDeepDive,
    handleDeleteMessage, handleStopGeneration, handleRetry, handleRegenerateSuggestions,
    handleReportError, handleFeedback, handleSendFeedback, handleSectionFeedback,
    handleToggleMessageSources, setVisibleCount, setSessions
  } = useChat();

` + leftInAppCore + srcCode.substring(endIdx);

// Also need to add import for useChat in AppCore.tsx
let lines = appCoreNew.split('\n');
const importIndex = lines.findIndex(l => l.includes("import { useCRM }"));
if (importIndex !== -1) {
  lines.splice(importIndex + 1, 0, "import { useChat } from './hooks/useChat';");
}

lines = lines.map(line => {
  if (line.startsWith('function extractCompanyName')) return 'export ' + line;
  return line;
});

fs.writeFileSync('AppCore.tsx', lines.join('\n'), 'utf8');

console.log("Successfully refactored!");
