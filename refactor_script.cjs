const fs = require('fs');
const file = 'c:/Users/bruno.ferreira/Desktop/NOVO APP/NOVO-APP/AppCore.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const newCode = `  const {
    sessions, currentSessionId, currentSession, allMessages, isLoading, isLoadingSession,
    loadingStatus, completedLoadingStatuses, lastQuery, isSavingRemote, remoteSaveStatus,
    isInitialized, visibleCount, handleNewSession, handleSelectSession, handleDeleteSession,
    handleSaveRemote, handleClearChat, handleSendMessage, processMessage, handleDeepDive,
    handleDeleteMessage, handleStopGeneration, handleRetry, handleRegenerateSuggestions,
    handleReportError, handleFeedback, handleSendFeedback, handleSectionFeedback,
    handleToggleMessageSources, setVisibleCount, setSessions
  } = useChat();

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem(THEME_KEY) === 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const [pdfReportContent, setPdfReportContent] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'chat' | 'crm'>('chat');
  const [selectedCRMCardId, setSelectedCRMCardId] = useState<string | null>(null);
  const [showNewCrmForm, setShowNewCrmForm] = useState(false);
  const [newCrmName, setNewCrmName] = useState('');
  const [newCrmWebsite, setNewCrmWebsite] = useState('');
  const [newCrmResumo, setNewCrmResumo] = useState('');
  const [isCreatingCrmCard, setIsCreatingCrmCard] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailStatus, setEmailStatus] = useState<'sending' | 'sent' | 'error' | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDias, setFollowUpDias] = useState(7);
  const [followUpNotas, setFollowUpNotas] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const { toasts, toast, dismiss: dismissToast } = useToast();

  // Fechar modais com Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEmailModal) setShowEmailModal(false);
        if (showFollowUpModal) setShowFollowUpModal(false);
      }
    };
    if (showEmailModal || showFollowUpModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showEmailModal, showFollowUpModal]);

  const selectedCRMCard = selectedCRMCardId ? cards.find(c => c.id === selectedCRMCardId) || null : null;
`.split('\n');

const startIndex = lines.findIndex(l => l.includes('const [sessions, setSessions] = useState<ChatSession[]>([]);'));
const endIndex = lines.findIndex(l => l.includes('const handleSaveToCRM = async (sessionId: string) => {'));

if (startIndex !== -1 && endIndex !== -1) {
    lines.splice(startIndex, endIndex - startIndex, ...newCode);
    let text = lines.join('\n');
    text = text.replace(
        "import { sendMessageToGemini, generateNewSuggestions, generateConsolidatedDossier, resetChatSession } from './services/geminiService';",
        "import { generateConsolidatedDossier, resetChatSession } from './services/geminiService';\nimport { useChat } from './hooks/useChat';"
    );
    text = text.replace("import { listRemoteSessions, getRemoteSession, saveRemoteSession } from './services/sessionRemoteStore';\n", '');
    text = text.replace("import { sendFeedbackRemote } from './services/feedbackRemoteStore';\n", '');

    fs.writeFileSync(file, text);
    console.log('AppCore updated successfully! Range:', startIndex, 'to', endIndex);
} else {
    console.log('Could not find indices', startIndex, endIndex);
}
