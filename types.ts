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
  // Props anteriormente faltantes — adicionadas na Fase 1
  onSaveToCRM: (sessionId: string) => void;
  onDeepDive: (displayMessage: string, hiddenPrompt: string) => Promise<void>;
  onOpenKanban: () => void;
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
  // Renomeado de userId para deixar claro que é um nó React, não uma string
  userHeaderNode: React.ReactNode;
  onLogout: () => void;
  lastUserQuery?: string;
  processing?: {
    stage?: string;
    completedStages?: string[];
  };
  // Deletar mensagem do usuário
  onDeleteMessage?: (id: string) => void;
}

// ===================================================================
// MINI CRM - Kanban
// ===================================================================

export type CRMStage =
  | 'prospeccao'
  | 'primeira_reuniao'
  | 'levantamento'
  | 'defesa_tecnica'
  | 'dossie_final';

export const CRM_STAGE_LABELS: Record<CRMStage, string> = {
  prospeccao: 'Prospecção',
  primeira_reuniao: '1ª Reunião',
  levantamento: 'Levantamento',
  defesa_tecnica: 'Defesa Técnica',
  dossie_final: 'Dossiê Final',
};

export type DealHealth = 'green' | 'yellow' | 'red';

export interface CRMTranscriptionFile {
  id: string;
  name: string;
  content: string;
  uploadedAt: string;
  type: 'txt' | 'docx';
}

export interface CRMStageData {
  transcriptions: CRMTranscriptionFile[];
  executiveNotes: string;
  technicalNotes: string;
  aiReport?: string;
  crmNotes?: string;
  generatedAt?: string;
  objections?: string[];
  competitors?: string[];
}

export interface CRMCard {
  id: string;
  companyName: string;
  // Compat: cnpj unico legado
  cnpj?: string | null;
  // NOVO: lista de CNPJs
  cnpjs?: string[];
  // NOVO: campos basicos do cadastro
  website?: string;
  briefDescription?: string;
  // NOVO: ExactSpotter
  exactLink?: string;

  linkedSessionIds: string[];
  stage: CRMStage;
  createdAt: string;
  updatedAt: string;
  movedToStageAt: Partial<Record<CRMStage, string>>;
  stages: Partial<Record<CRMStage, CRMStageData>>;
  latestScorePorta?: number;
  health: DealHealth;
  newsRadarEnabled: boolean;
  lastNewsCheckAt?: string;
  unreadNewsCount?: number;
}

export interface CRMPipelineProps {
  cards: CRMCard[];
  onMoveCard: (cardId: string, toStage: CRMStage) => void;
  onSelectCard: (cardId: string) => void;
}
