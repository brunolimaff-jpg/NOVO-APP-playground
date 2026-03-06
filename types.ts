export enum Sender {
  User = 'user',
  Bot = 'bot',
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

export type ErrorSource = 'GEMINI' | 'BRASIL_API' | 'APPS_SCRIPT' | 'EXPORT' | 'PARSER' | 'UI' | 'GUARD' | 'UNKNOWN';

export interface AppError {
  code: ErrorCode;
  message: string;
  friendlyMessage: string;
  httpStatus?: number;
  retryable: boolean;
  transient: boolean;
  source: ErrorSource;
  details?: Record<string, unknown>;
}

// ===================================================================
// SCORE PORTA v2
// ===================================================================
export type PortaSegmento = 'PRD' | 'AGI' | 'COP';

export type PortaFlag = 'TRAD' | 'LOCK' | 'NOFIT';

export interface ScorePortaData {
  score: number; // 0-100, score final com penalizacoes
  p: number; // 0-10
  o: number; // 0-10
  r: number; // 0-10
  t: number; // 0-10
  a: number; // 0-10
  segmento: PortaSegmento;
  flags: PortaFlag[];
  scoreBruto?: number; // 0-100, antes das penalizacoes
}

export const PORTA_WEIGHTS: Record<PortaSegmento, { p: number; o: number; r: number; t: number; a: number }> = {
  PRD: { p: 0.1, o: 0.25, r: 0.1, t: 0.3, a: 0.25 },
  AGI: { p: 0.15, o: 0.3, r: 0.2, t: 0.2, a: 0.15 },
  COP: { p: 0.15, o: 0.2, r: 0.25, t: 0.2, a: 0.2 },
};

export const PORTA_FLAG_PENALTIES: Record<PortaFlag, number> = {
  TRAD: 0.6,
  LOCK: 0.5,
  NOFIT: 0.3,
};

export type PortaDimension = 'P' | 'O' | 'R' | 'T' | 'A';

export interface PortaFeedAdjustment {
  source: string;
  dimension: PortaDimension;
  suggestedValue: number; // 0-10
  justification: string;
  subScores?: Record<string, number>;
  metadata?: Record<string, string>;
  timestamp: number;
}

export interface PortaFlagFeed {
  source: string;
  flag: PortaFlag;
  active: boolean;
  justification: string;
  timestamp: number;
}

export interface PortaSegmentFeed {
  source: string;
  segmento: PortaSegmento;
  justification: string;
  timestamp: number;
}

export interface PortaState {
  empresa: string;
  sessionId: string;
  baseScore: ScorePortaData | null;
  baseScoreTimestamp: number | null;
  feedAdjustments: PortaFeedAdjustment[];
  flagFeeds: PortaFlagFeed[];
  segmentFeeds: PortaSegmentFeed[];
  consolidatedScore: ScorePortaData | null;
  lastConsolidatedAt: number | null;
}

export const DEEP_DIVE_SOURCES = {
  RAIO_X: 'RAIO_X_OPERACIONAL',
  TECH: 'TECH_STACK',
  COMPLIANCE: 'RISCOS_COMPLIANCE',
  EXPANSAO: 'RADAR_EXPANSAO',
  RH: 'RH_SINDICATOS',
  DECISORES: 'MAPEAMENTO_DECISORES',
} as const;

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
  // NOVO: Detalhes técnicos do ghost message (stream timeout)
  ghostDetails?: string;
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
  canAccessMiniCRM?: boolean;
  canAccessDashboard?: boolean;
  canAccessIntegrityCheck?: boolean;
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

export type CRMStage = 'prospeccao' | 'primeira_reuniao' | 'levantamento' | 'defesa_tecnica' | 'dossie_final';

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
