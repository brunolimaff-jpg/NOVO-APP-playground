import React from 'react';

export enum Sender {
  User = 'user',
  Bot = 'bot'
}

export type Feedback = 'up' | 'down';

export type ExportFormat = 'md' | 'pdf' | 'doc';

export type ReportType = 'executive' | 'full' | 'tech';

export type ErrorCode = 
  | 'NETWORK' 
  | 'TIMEOUT' 
  | 'RATE_LIMIT' 
  | 'MODEL_OVERLOADED' 
  | 'AUTH' 
  | 'BAD_REQUEST' 
  | 'SERVER' 
  | 'PARSER' 
  | 'UNKNOWN'
  | 'ABORTED'
  | 'BLOCKED_CONTENT';

export type ErrorSource = 'GEMINI' | 'BRASIL_API' | 'APPS_SCRIPT' | 'EXPORT' | 'PARSER' | 'UI' | 'UNKNOWN';

export interface AppError {
  code: ErrorCode;
  message: string;
  friendlyMessage: string;
  httpStatus?: number;
  retryable: boolean;
  transient: boolean;
  source: ErrorSource;
  details?: any;
}

// ===================================================================
// NOVO: Score PORTA
// ===================================================================
export interface ScorePortaData {
  score: number;
  p: number;
  o: number;
  r: number;
  t: number;
  a: number;
}

export interface ParsedContent {
  text: string;
  statuses: string[];
  scorePorta: ScorePortaData | null;
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  timestamp: Date;
  isThinking?: boolean;
  groundingSources?: Array<{
    title: string;
    url: string;
  }>;
  feedback?: Feedback;
  sectionFeedback?: Record<string, Feedback>;
  suggestions?: string[];
  isRegeneratingSuggestions?: boolean;
  isError?: boolean;
  errorDetails?: AppError;
  isSourcesOpen?: boolean;
  // NOVO: Score PORTA
  scorePorta?: ScorePortaData;
  // NOVO: Statuses extraídos
  statuses?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  empresaAlvo: string | null;
  cnpj: string | null;
  modoPrincipal: string | null;
  scoreOportunidade: number | null;
  resumoDossie: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  // NOVO: Contexto da empresa
  companyContext?: string;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface ChatInterfaceProps {
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  onSendMessage: (text: string, displayText?: string) => void;
  onFeedback: (messageId: string, feedback: Feedback) => void;
  onSendFeedback: (messageId: string, feedback: Feedback, comment: string, content: string) => void;
  onSectionFeedback: (messageId: string, sectionTitle: string, feedback: Feedback) => void;
  onLoadMore: () => void;
  onExportConversation: (format: ExportFormat, reportType: ReportType) => void;
  onExportPDF: () => void;
  onExportMessage: (messageId: string) => void;
  onRetry: () => void;
  onClearChat: () => void;
  onRegenerateSuggestions: (messageId: string) => void;
  onStop?: () => void;
  onReportError?: (messageId: string, error: AppError) => void;
  onSaveRemote: () => void;
  isSavingRemote: boolean;
  remoteSaveStatus: 'idle' | 'success' | 'error';
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onToggleMessageSources: (messageId: string) => void;
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  exportError: string | null;
  pdfReportContent: string | null;
  onOpenEmailModal: () => void;
  onOpenFollowUpModal: () => void;
  userId: React.ReactNode;
  onLogout: () => void;
  lastUserQuery?: string;
  processing?: {
    stage?: string;
    stageIndex?: number;
    stageTotal?: number;
  };
}