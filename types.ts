
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
  message: string;          // Technical message (for logs/details)
  friendlyMessage: string;  // UI message (default)
  httpStatus?: number;
  retryable: boolean;       // Can be manually retried by user?
  transient: boolean;       // Should auto-retry?
  source: ErrorSource;
  details?: any;
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
  feedback?: Feedback; // Global message feedback
  sectionFeedback?: Record<string, Feedback>; // Granular feedback: { "Incentivos Fiscais": "up" }
  suggestions?: string[];
  isRegeneratingSuggestions?: boolean; // Loading state for suggestions refresh
  isError?: boolean;
  errorDetails?: AppError; // Structured error details
  isSourcesOpen?: boolean; // New UI state to track if sources are expanded
}

export interface ChatSession {
  id: string;
  title: string; // Ex: "Grupo Amaggi - Cuiabá"
  empresaAlvo: string | null;
  cnpj: string | null;
  modoPrincipal: string | null; // "Overview", "Matador", "Padrão"
  scoreOportunidade: number | null; // 0-100
  resumoDossie: string | null;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  messages: Message[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface ChatInterfaceProps {
  // Session Props
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;

  // Messaging Props
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  onSendMessage: (text: string, displayText?: string) => void;
  
  // Feedback Props
  onFeedback: (messageId: string, feedback: Feedback) => void; // Legacy local state update
  onSendFeedback: (messageId: string, feedback: Feedback, comment: string, content: string) => void; // New Remote Feedback
  
  onSectionFeedback: (messageId: string, sectionTitle: string, feedback: Feedback) => void;
  onLoadMore: () => void;
  
  // Actions
  onExportConversation: (format: ExportFormat, reportType: ReportType) => void;
  onExportPDF: () => void; // New explicit PDF handler
  onExportMessage: (messageId: string) => void;
  onRetry: () => void;
  onClearChat: () => void; // Agora atua como "Salvar e Novo"
  onRegenerateSuggestions: (messageId: string) => void;
  onStop?: () => void; // Stop generation
  onReportError?: (messageId: string, error: AppError) => void;
  
  // Remote Save Actions
  onSaveRemote: () => void;
  isSavingRemote: boolean;
  remoteSaveStatus: 'idle' | 'success' | 'error';
  
  // Theme props
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onToggleMessageSources: (messageId: string) => void;
  
  // Export States
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
  exportError: string | null;
  pdfReportContent: string | null;
  onOpenEmailModal: () => void; 
  onOpenFollowUpModal: () => void; // New prop for FollowUp Modal

  // Auth Props
  userId: React.ReactNode;
  onLogout: () => void;

  // Context & Status Props
  lastUserQuery?: string;
  processing?: {
    stage?: string;
    stageIndex?: number;
    stageTotal?: number;
  };
}
