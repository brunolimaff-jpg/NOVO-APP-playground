import os
import re

def main():
    with open('AppCore.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    os.makedirs('hooks', exist_ok=True)

    start_str = 'const [sessions, setSessions] = useState<ChatSession[]>([]);'
    start_idx = content.find(start_str)
    
    toggle_msg_pattern = r'const handleToggleMessageSources = \(.*?\) => \{.*?\n  \};\n'
    toggle_msg_match = re.search(toggle_msg_pattern, content[start_idx:], re.DOTALL)
    end_idx = start_idx + toggle_msg_match.end()
    
    extracted = content[start_idx:end_idx]
    
    # Exclude UI side-effects
    ui_funcs_ptn = r'(  async function handleExportPDF\(\) \{.*?\n  \}\n\n  const handleExportConversation = async \(.*?\n  \};\n\n  async function handleSendEmail\(\) \{.*?\n  \}\n\n  async function handleScheduleFollowUp\(\) \{.*?\n  \}\n\n)'
    ui_match = re.search(ui_funcs_ptn, extracted, re.DOTALL)
    
    if not ui_match:
        print("UI functions not found!")
        return
        
    ui_funcs_code = ui_match.group(1)
    extracted = extracted.replace(ui_funcs_code, '')
    
    # We also need to strip the UI state vars from extracted
    # Let's cleanly separate the hooks logic
    hook_body = extracted.replace('const [isDarkMode, setIsDarkMode] = useState(\n    () => localStorage.getItem(THEME_KEY) === "dark",\n  );\n  const [isSidebarOpen, setIsSidebarOpen] = useState(true);\n', '')
    
    ui_state_pattern = r'  const \[exportStatus.*?  const \[followUpStatus.*?\n  \);\n'
    ui_state_match = re.search(ui_state_pattern, hook_body, re.DOTALL)
    
    ui_state_code = ''
    if ui_state_match:
        ui_state_code = ui_state_match.group(0)
        hook_body = hook_body.replace(ui_state_code, '')
        
    hook_body = hook_body.replace('  const [activeView, setActiveView] = useState<"chat" | "crm">("chat");\n', '')
    
    # Remove modals escape effect
    modal_eff_ptn = r'  // Fechar modais com Escape\n  useEffect\(\(\) => \{.*?\n  \}, \[showEmailModal, showFollowUpModal\]\);\n\n'
    modal_eff_match = re.search(modal_eff_ptn, hook_body, re.DOTALL)
    modal_eff_code = ''
    if modal_eff_match:
        modal_eff_code = modal_eff_match.group(0)
        hook_body = hook_body.replace(modal_eff_code, '')
        
    use_chat_ts = f"""import {{ useState, useEffect, useCallback, useRef }} from 'react';
import {{ v4 as uuidv4 }} from 'uuid';
import {{ useAuth }} from '../contexts/AuthContext';
import {{ useMode }} from '../contexts/ModeContext';
import {{ Message, Sender, Feedback, ChatSession, AppError }} from '../types';
import {{ sendMessageToGemini, generateNewSuggestions, resetChatSession }} from '../services/geminiService';
import {{ listRemoteSessions, getRemoteSession, saveRemoteSession }} from '../services/sessionRemoteStore';
import {{ sendFeedbackRemote }} from '../services/feedbackRemoteStore';
import {{ extractCompanyName }} from '../AppCore';
import {{ cleanTitle, cleanStatusMarkers }} from '../utils/textCleaners';
import {{ normalizeAppError }} from '../utils/errorHelpers';
import {{ BACKEND_URL }} from '../services/apiConfig';
import {{ useToast }} from './useToast';

const SESSIONS_STORAGE_KEY = 'scout360_sessions_v1';
const THEME_KEY = 'scout360_theme';
const PAGE_SIZE = 20;

interface LastAction {{
  type: 'sendMessage' | 'regenerateSuggestions';
  payload: any;
}}

export const useChat = () => {{
  const {{ userId, user, isAuthenticated }} = useAuth();
  const {{ mode, systemInstruction }} = useMode();
  const {{ toast }} = useToast();

  {hook_body.strip()}

  return {{
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
  }};
}};
"""

    with open('hooks/useChat.ts', 'w', encoding='utf-8') as f:
        f.write(use_chat_ts)
        
    app_core_replacement = f"""  const {{
    sessions, currentSessionId, currentSession, allMessages, isLoading, isLoadingSession,
    loadingStatus, completedLoadingStatuses, lastQuery, isSavingRemote, remoteSaveStatus,
    isInitialized, visibleCount, handleNewSession, handleSelectSession, handleDeleteSession,
    handleSaveRemote, handleClearChat, handleSendMessage, processMessage, handleDeepDive,
    handleDeleteMessage, handleStopGeneration, handleRetry, handleRegenerateSuggestions,
    handleReportError, handleFeedback, handleSendFeedback, handleSectionFeedback,
    handleToggleMessageSources, setVisibleCount, setSessions, updateSessionById
  }} = useChat();

  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem(THEME_KEY) === "dark",
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<"chat" | "crm">("chat");
{ui_state_code}
{modal_eff_code}
{ui_funcs_code}"""

    new_content = content[:start_idx] + app_core_replacement + content[end_idx:]
    
    # Add import for useChat
    new_content = new_content.replace("import { useCRM } from \"./contexts/CRMContext\";", 
                                      "import { useCRM } from \"./contexts/CRMContext\";\nimport { useChat } from \"./hooks/useChat\";")
                                      
    # We must export extractCompanyName from AppCore
    new_content = new_content.replace("function extractCompanyName(", "export function extractCompanyName(")
    
    with open('AppCore.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print("Separation complete!")

main()
