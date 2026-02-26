import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useOffline } from './hooks/useOffline';
import { useToast } from './hooks/useToast';
import ToastContainer from './components/ToastContainer';
import { PDFGenerator } from './utils/PDFGenerator';
import ChatInterface from './components/ChatInterface';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './contexts/AuthContext';
import { useMode } from './contexts/ModeContext';
import { useCRM } from './contexts/CRMContext';
import { CRMPipeline } from './components/CRMPipeline';
import { CRMDetail } from './components/CRMDetail';
import { Message, Sender, Feedback, ChatSession, ExportFormat, ReportType, AppError, CRMStage } from './types';
import { sendMessageToGemini, generateNewSuggestions, generateConsolidatedDossier, resetChatSession } from './services/geminiService';
import { listRemoteSessions, getRemoteSession, saveRemoteSession } from './services/sessionRemoteStore';
import { sendFeedbackRemote } from './services/feedbackRemoteStore';
import { APP_NAME, MODE_LABELS } from './constants';
import { normalizeAppError } from './utils/errorHelpers';
import { downloadFile } from './utils/downloadHelpers';
import { cleanStatusMarkers, cleanTitle, extractAllLinksFromMarkdown, formatSourcesForExport, SourceRef } from './utils/textCleaners';
import { fixFakeLinksHTML, extractValidLinks } from './utils/linkFixer';
import { BACKEND_URL } from './services/apiConfig';

const SESSIONS_STORAGE_KEY = 'scout360_sessions_v1';
const THEME_KEY = 'scout360_theme';
const PAGE_SIZE = 20;

interface LastAction {
  type: 'sendMessage' | 'regenerateSuggestions';
  payload: any;
}

function extractCompanyName(title: string | null | undefined): string {
  if (!title) return 'Empresa';
  const patterns = [
    /completa?\s+d[oa]s?\s+(.*)/i,
    /(?:empresa|grupo|companhia)\s+(.*)/i,
    /(?:investigar?|analisar?|pesquisar?)\s+(?:a\s+|o\s+)?(.*)/i,
    /(?:sobre\s+(?:a|o)\s+)(.*)/i,
    /(?:dossie?\s+d[oa]s?\s+)(.*)/i,
    /(?:capivara\s+d[oa]s?\s+)(.*)/i,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim().replace(/\.{3}$/, '').trim();
      if (name.length > 2 && name.length < 60) return name;
    }
  }
  return title.replace(/\.{3}$/, '').trim();
}

function convertMarkdownToHTML(md: string, includeSources: boolean = true): string {
  const allLinks = extractValidLinks(md);
  let html = md
    .replace(
      /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+)\]\]/g,
      (_, score, p, o, r, t, a) => {
        const s = parseInt(score);
        const color = s >= 71 ? '#059669' : s >= 41 ? '#eab308' : '#ef4444';
        const bgColor = s >= 71 ? '#f0fdf4' : s >= 41 ? '#fefce8' : '#fef2f2';
        const borderColor = s >= 71 ? '#059669' : s >= 41 ? '#eab308' : '#ef4444';
        const label = s >= 71 ? '🟢 Alta Compatibilidade' : s >= 41 ? '🟡 Média Compatibilidade' : '🔴 Baixa Compatibilidade';
        return `<div class="porta-score" style="border:2px solid ${borderColor};background:${bgColor};">
          <div class="header"><span class="label-porta">🎯 PORTA</span><span><span class="score-num" style="color:${color};">${score}</span><span class="score-max">/100</span></span></div>
          <div class="bar-bg" style="background:${color}20;"><div class="bar-fill" style="width:${Math.min(s, 100)}%;background:${color};"></div></div>
          <div class="compat" style="color:${color};">${label}</div>
          <div class="pillars"><span class="pill"><b>P</b> ${p}</span><span class="pill"><b>O</b> ${o}</span><span class="pill"><b>R</b> ${r}</span><span class="pill"><b>T</b> ${t}</span><span class="pill"><b>A</b> ${a}</span></div>
        </div>`;
      }
    )
    .replace(/^>\s*(.*$)/gm, '<blockquote>$1</blockquote>')
    .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      if (url.includes('ai.studio') || url.includes('google.com/search') || url.includes('vertexai')) {
        return `<strong style="color:#059669;">${text}</strong>`;
      }
      return `<a href="${url}" target="_blank" style="color:#059669;text-decoration:underline;">${text}</a>`;
    })
    .replace(/\^(\d+)/g, '<sup style="background:#059669;color:#fff;padding:1px 5px;border-radius:8px;font-size:10px;margin:0 1px;">$1</sup>')
    .replace(/^[\-\*] (.*$)/gm, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^-----+$/gm, '<hr>')
    .replace(/^---+$/gm, '<hr>');
  html = html.replace(/(<li>[\s\S]*?<\/li>(?:\s*<li>[\s\S]*?<\/li>)*)/g, '<ul>$1</ul>');
  html = html.replace(/(<blockquote>[\s\S]*?<\/blockquote>)(\s*<blockquote>[\s\S]*?<\/blockquote>)*/g, (match) => {
    const content = match.replace(/<\/?blockquote>/g, '');
    return '<blockquote>' + content + '</blockquote>';
  });
  html = html.replace(/<p><hr><\/p>/g, '<hr>');
  if (includeSources && allLinks.length > 0) html += formatSourcesForExport(allLinks);
  return '<p>' + html + '</p>';
}

function collectFullReport(messages: Message[]): { text: string; sections: string[]; allLinks: SourceRef[] } {
  const botMessages = messages.filter((m: any) => {
    const sender = m.sender || (m as any).role || (m as any).type || '';
    const text = m.text || (m as any).content || (m as any).message || '';
    return (sender === 'bot' || sender === 'assistant' || sender === 'model') && typeof text === 'string' && text.length > 50;
  });
  if (botMessages.length === 0) return { text: '', sections: [], allLinks: [] };
  const sections: string[] = [];
  const allLinks: SourceRef[] = [];
  const dossieText = (botMessages[0] as any).text || (botMessages[0] as any).content || '';
  sections.push(dossieText);
  const dossieLinks = extractAllLinksFromMarkdown(dossieText);
  dossieLinks.forEach(link => { if (!allLinks.find(l => l.url === link.url)) allLinks.push(link); });
  for (let i = 1; i < botMessages.length; i++) {
    const botText = (botMessages[i] as any).text || (botMessages[i] as any).content || '';
    const botIndex = messages.indexOf(botMessages[i] as Message);
    let userQuestion = '';
    for (let j = botIndex - 1; j >= 0; j--) {
      const s = (messages[j] as any).sender || (messages[j] as any).role || '';
      if (s === 'user' || s === 'human') { userQuestion = (messages[j] as any).text || (messages[j] as any).content || ''; break; }
    }
    if (botText.length > 50) {
      const sectionHeader = userQuestion ? `\n\n---\n\n## 🔍 APROFUNDAMENTO: ${userQuestion}\n\n` : `\n\n---\n\n## 🔍 APROFUNDAMENTO #${i}\n\n`;
      sections.push(sectionHeader + botText);
      const sectionLinks = extractAllLinksFromMarkdown(botText);
      sectionLinks.forEach(link => { if (!allLinks.find(l => l.url === link.url)) allLinks.push(link); });
    }
  }
  return { text: sections.join('\n\n'), sections, allLinks };
}

function detectInconsistencies(sections: string[]): string {
  if (sections.length < 2) return '';
  const inconsistencies: string[] = [];
  const patterns = [
    { label: 'Faturamento', regex: /faturamento[^:]*?:?\s*(?:R\$\s*)?(\d[\d.,]*\s*(?:mi|bi|mil|trilh)[a-záãõüê]*)/gi },
    { label: 'Área/Hectares', regex: /(\d[\d.,]*)\s*(?:mil\s+)?(?:hectares|ha\b)/gi },
    { label: 'Funcionários', regex: /(\d[\d.,]*)\s*(?:mil\s+)?(?:funcionários|colaboradores|empregados)/gi },
    { label: 'Receita', regex: /receita[^:]*?:?\s*(?:R\$\s*)?(\d[\d.,]*\s*(?:mi|bi|mil|trilh)[a-záãõüê]*)/gi },
    { label: 'Unidades', regex: /(\d[\d.,]*)\s*(?:unidades|filiais|fábricas|plantas|usinas)/gi },
  ];
  const mainSection = sections[0];
  for (let i = 1; i < sections.length; i++) {
    const drilldown = sections[i];
    for (const { label, regex } of patterns) {
      regex.lastIndex = 0;
      const mainMatches: string[] = [];
      let match;
      while ((match = regex.exec(mainSection)) !== null) mainMatches.push(match[0].trim());
      regex.lastIndex = 0;
      const drillMatches: string[] = [];
      while ((match = regex.exec(drilldown)) !== null) drillMatches.push(match[0].trim());
      if (mainMatches.length > 0 && drillMatches.length > 0) {
        const mainVal = mainMatches[0].toLowerCase();
        const drillVal = drillMatches[0].toLowerCase();
        if (mainVal !== drillVal) {
          inconsistencies.push(`**${label}:** Dossiê principal menciona *${mainMatches[0]}*, mas aprofundamento menciona *${drillMatches[0]}*. Verifique qual é o dado mais recente.`);
        }
      }
    }
  }
  if (inconsistencies.length === 0) return '';
  return '\n\n---\n\n## ⚠️ INCONSISTÊNCIAS DETECTADAS\n\n' +
    '> Os dados abaixo apareceram com valores diferentes entre o dossiê principal e os aprofundamentos. Recomenda-se verificar a fonte mais confiável antes de usar em propostas.\n\n' +
    inconsistencies.map((inc, i) => `${i + 1}. ${inc}`).join('\n') + '\n';
}

function simpleMarkdownToHtml(md: string, title: string): string {
  const htmlBody = fixFakeLinksHTML(convertMarkdownToHTML(md, true));
  return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #333; }
        h1, h2, h3, h4 { color: #059669; font-family: Arial, sans-serif; }
        a { color: #059669; text-decoration: underline; }
        ul { padding-left: 20px; } li { margin-bottom: 5px; }
        blockquote { border-left: 4px solid #f59e0b; background: #fffbeb; padding: 10px; margin: 10px 0; color: #92400e; }
        .sources-section { margin-top: 20px; padding-top: 10px; border-top: 1px solid #059669; }
        .sources-section h2 { color: #064e3b; font-size: 14px; }
      </style>
    </head>
    <body>
      <h1 style="font-size: 24px; border-bottom: 2px solid #059669; padding-bottom: 10px;">${title}</h1>
      ${htmlBody}
      <br>
      <p style="font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px;">Gerado por ${APP_NAME} - Inteligência Comercial</p>
    </body>
    </html>
  `;
}


const AppCore: React.FC = () => {
  const { userId, user, logout, isAuthenticated } = useAuth();
  const { mode, systemInstruction } = useMode();
  const { cards, createCardFromSession, createManualCard, moveCardToStage } = useCRM();
  const { isOnline, wasOffline, clearWasOffline } = useOffline();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('Iniciando análise');
  const [completedLoadingStatuses, setCompletedLoadingStatuses] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem(THEME_KEY) === 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [isSavingRemote, setIsSavingRemote] = useState(false);
  const [remoteSaveStatus, setRemoteSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const [pdfReportContent, setPdfReportContent] = useState<string | null>(null);
  const [investigationLogged, setInvestigationLogged] = useState(false);
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
  const lastActionRef = useRef<LastAction | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const activeGenerationRef = useRef<Record<string, string>>({});

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;
  const allMessages = currentSession ? currentSession.messages : [];
  const selectedCRMCard = selectedCRMCardId ? cards.find(c => c.id === selectedCRMCardId) || null : null;

  const updateSessionById = useCallback(
    (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId ? { ...updater(s), updatedAt: new Date().toISOString() } : s
        )
      );
    },
    []
  );

  const updateCurrentSession = useCallback(
    (updater: (session: ChatSession) => ChatSession) => {
      setSessions(prev => {
        const target = prev.find(s => s.id === currentSessionId);
        if (!target) return prev;
        return prev.map(s =>
          s.id === currentSessionId
            ? { ...updater(s), updatedAt: new Date().toISOString() }
            : s
        );
      });
    },
    [currentSessionId]
  );

  useEffect(() => {
    const initApp = async () => {
      const savedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
      let localSessions: ChatSession[] = [];
      if (savedSessions) {
        try {
          const parsed = JSON.parse(savedSessions);
          localSessions = parsed.map((s: any) => ({
            ...s,
            messages: s.messages.map((m: any) => ({
              ...m,
              text: cleanStatusMarkers(m.text || '').cleanText,
              timestamp: new Date(m.timestamp),
            })),
          }));
        } catch (e) { console.error('Load error', e); }
      }
      try {
        const remoteList = await listRemoteSessions();
        const sessionMap = new Map<string, ChatSession>();
        localSessions.forEach(s => sessionMap.set(s.id, s));
        remoteList.forEach(r => {
          const existing = sessionMap.get(r.id);
          if (existing) {
            sessionMap.set(r.id, { ...existing, ...r, messages: existing.messages.length > 0 ? existing.messages : [] });
          } else {
            sessionMap.set(r.id, r);
          }
        });
        const mergedSessions = Array.from(sessionMap.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setSessions(mergedSessions);
        if (mergedSessions.length > 0) setCurrentSessionId(mergedSessions[0].id);
        else handleNewSession();
      } catch (e) {
        setSessions(localSessions);
        if (localSessions.length > 0) setCurrentSessionId(localSessions[0].id);
        else handleNewSession();
      }
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme) setIsDarkMode(savedTheme === 'dark');
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      setIsInitialized(true);
    };
    initApp();
  }, []);

  useEffect(() => {
    if (isInitialized) localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions, isInitialized]);

  useEffect(() => {
    document.body.className = isDarkMode ? 'dark' : 'light';
    document.body.style.backgroundColor = isDarkMode ? '#020617' : '#f8fafc';
    document.body.style.color = isDarkMode ? '#e2e8f0' : '#0f172a';
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    resetChatSession();
    document.title = `${APP_NAME} ${MODE_LABELS[mode].icon}`;
  }, [mode]);

  const handleNewSession = useCallback(() => {
    if (isLoading && abortControllerRef.current) abortControllerRef.current.abort();
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'Nova Investigação',
      empresaAlvo: null, cnpj: null, modoPrincipal: null, scoreOportunidade: null, resumoDossie: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      messages: [],
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setVisibleCount(PAGE_SIZE);
    resetChatSession();
    setRemoteSaveStatus('idle');
    setExportStatus('idle');
    setPdfReportContent(null);
    setInvestigationLogged(false);
    lastActionRef.current = null;
    setLastQuery('');
    setLoadingStatus('Iniciando análise');
  }, [isLoading]);

  const handleSelectSession = async (sessionId: string) => {
    if (isLoading && abortControllerRef.current) abortControllerRef.current.abort();
    setCurrentSessionId(sessionId);
    setVisibleCount(PAGE_SIZE);
    resetChatSession();
    setRemoteSaveStatus('idle');
    setExportStatus('idle');
    setPdfReportContent(null);
    setInvestigationLogged(false);
    lastActionRef.current = null;
    setLoadingStatus('Iniciando análise');
    const targetSession = sessions.find(s => s.id === sessionId);
    if (targetSession && targetSession.messages.length === 0) {
      setIsLoading(true);
      try {
        const fullSession = await getRemoteSession(sessionId);
        if (fullSession) updateSessionById(sessionId, () => fullSession);
      } catch (e) { console.error('Lazy load error', e); }
      finally { setIsLoading(false); }
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    if (sessionId === currentSessionId && isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
    delete activeGenerationRef.current[sessionId];
    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);
    if (currentSessionId === sessionId) {
      resetChatSession();
      if (newSessions.length > 0) {
        const nextSession = newSessions[0];
        setCurrentSessionId(nextSession.id);
        if (nextSession.messages.length === 0) {
          setIsLoading(true);
          getRemoteSession(nextSession.id)
            .then(fullSession => {
              if (fullSession) updateSessionById(nextSession.id, () => fullSession);
              setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
        }
      } else {
        handleNewSession();
      }
    }
  };

  const handleSaveRemote = async () => {
    if (!currentSession || !isAuthenticated) return;
    setIsSavingRemote(true);
    setRemoteSaveStatus('idle');
    const snapshotSessionId = currentSession.id;
    const finalized: ChatSession = { ...currentSession, updatedAt: new Date().toISOString() };
    updateSessionById(snapshotSessionId, () => finalized);
    try {
      await saveRemoteSession(finalized, userId, user?.displayName);
      setRemoteSaveStatus('success');
      setTimeout(() => setRemoteSaveStatus('idle'), 3000);
    } catch { setRemoteSaveStatus('error'); }
    finally { setIsSavingRemote(false); }
  };

  const handleClearChat = () => {
    if (!window.confirm('Isso apagará todas as mensagens desta investigação. Continuar?')) return;
    resetChatSession();
    updateCurrentSession(session => ({
      ...session, messages: [], title: 'Nova Investigação', empresaAlvo: null, updatedAt: new Date().toISOString(),
    }));
    setInvestigationLogged(false);
    setLoadingStatus('Realizando pesquisa...');
    lastActionRef.current = null;
    setLastQuery('');
    setVisibleCount(PAGE_SIZE);
  };

  const processMessage = async (text: string, explicitSessionId?: string, explicitHistory?: Message[]) => {
    const sessionId = explicitSessionId || currentSessionId;
    if (!sessionId) return;

    setIsLoading(true);
    setLoadingStatus('Realizando pesquisa...');
    setCompletedLoadingStatuses([]);
    setLastQuery(text);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    lastActionRef.current = { type: 'sendMessage', payload: { text } };

    let historyToPass: Message[] = [];
    if (explicitHistory) {
      historyToPass = explicitHistory;
    } else {
      setSessions(prev => {
        const session = prev.find(s => s.id === sessionId);
        if (session) {
          const msgs = session.messages;
          historyToPass = (msgs.length > 0 && msgs[msgs.length - 1].text === text && msgs[msgs.length - 1].sender === Sender.User)
            ? msgs.slice(0, -1)
            : msgs;
        }
        return prev;
      });
    }

    const botMessageId = uuidv4();
    activeGenerationRef.current[sessionId] = botMessageId;

    const botMessagePlaceholder: Message = {
      id: botMessageId, sender: Sender.Bot, text: '', timestamp: new Date(), isThinking: true, isSourcesOpen: false,
    };

    setSessions(prev => prev.map(s => s.id === sessionId ? {
      ...s,
      messages: [...s.messages.filter(m => !m.isError), botMessagePlaceholder],
      updatedAt: new Date().toISOString(),
    } : s));
    setVisibleCount(prev => prev + 1);

    try {
      const { text: responseText, sources, suggestions, scorePorta } = await sendMessageToGemini(
        text, historyToPass, systemInstruction,
        {
          signal,
          onText: () => {},
          onStatus: (newStatus) => {
            setLoadingStatus(prev => {
              if (prev && prev !== newStatus) lastStatusRef.current = prev;
              return newStatus;
            });
            if (lastStatusRef.current && lastStatusRef.current !== newStatus) {
              const statusToAdd = lastStatusRef.current;
              setCompletedLoadingStatuses(completed =>
                statusToAdd && !completed.includes(statusToAdd) ? [...completed, statusToAdd] : completed
              );
            }
          },
          nomeVendedor: typeof user?.displayName === 'string' ? user.displayName : 'Vendedor',
        }
      );

      if (activeGenerationRef.current[sessionId] !== botMessageId) return;

      updateSessionById(sessionId, s => ({
        ...s,
        title: (s.messages.length <= 2 || s.title === 'Nova Investigação') ? cleanTitle(extractCompanyName(text)) : s.title,
        empresaAlvo: s.messages.length <= 2 ? extractCompanyName(text) : s.empresaAlvo,
        messages: s.messages.map(msg =>
          msg.id === botMessageId ? {
            ...msg, text: responseText, groundingSources: sources, suggestions, scorePorta: scorePorta || undefined, isThinking: false,
          } : msg
        ),
      }));

      if (!investigationLogged && responseText.length > 500) {
        setInvestigationLogged(true);
        fetch(BACKEND_URL, {
          method: 'POST', redirect: 'follow',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'logInvestigation',
            vendedor: user?.displayName || 'Anônimo',
            empresa: cleanTitle(extractCompanyName(text)),
            modo: mode || '',
            resumo: responseText.substring(0, 200),
          }),
        }).catch(err => console.log('Log falhou:', err));
      }

    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: s.messages.filter(msg => msg.id !== botMessageId || msg.text.trim().length > 0),
        } : s));
        return;
      }
      if (activeGenerationRef.current[sessionId] !== botMessageId) return;
      const appError = normalizeAppError(error);
      updateSessionById(sessionId, s => ({
        ...s,
        messages: [...s.messages.filter(m => m.id !== botMessageId), {
          id: uuidv4(), sender: Sender.Bot, text: 'Erro no processamento',
          timestamp: new Date(), isError: true, errorDetails: appError,
        }],
      }));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (text: string, displayText?: string) => {
    let sessionId = currentSessionId;
    let currentHistory: Message[] = [];
    if (!sessionId) {
      sessionId = uuidv4();
      const immediateTitle = cleanTitle(extractCompanyName(displayText || text));
      const newSession: ChatSession = {
        id: sessionId, title: immediateTitle || 'Nova Investigação',
        empresaAlvo: immediateTitle || null, cnpj: null, modoPrincipal: null, scoreOportunidade: null, resumoDossie: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [],
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(sessionId);
      currentHistory = [];
    } else {
      const session = sessions.find(s => s.id === sessionId);
      currentHistory = session ? [...session.messages] : [];
    }
    const userMessage: Message = { id: uuidv4(), sender: Sender.User, text: displayText || text, timestamp: new Date() };
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, messages: [...s.messages, userMessage], updatedAt: new Date().toISOString() } : s
    ));
    setVisibleCount(prev => prev + 1);
    await processMessage(text, sessionId, currentHistory);
  };

  const handleDeepDive = async (displayMessage: string, hiddenPrompt: string) => {
    const empresaContext = currentSession?.empresaAlvo || currentSession?.title || 'a empresa desta conversa';
    await handleSendMessage(
      `Com base em [${empresaContext}], execute o seguinte protocolo de ataque e investigação forense:\n\n${hiddenPrompt}`,
      displayMessage
    );
  };

  const handleDeleteMessage = (id: string) => {
    if (!currentSessionId) return;
    updateSessionById(currentSessionId, session => ({
      ...session, messages: session.messages.filter(m => m.id !== id),
    }));
  };

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const handleRetry = () => {
    if (!lastActionRef.current) return;
    if (lastActionRef.current.type === 'sendMessage') {
      processMessage(lastActionRef.current.payload.text, currentSessionId || undefined);
    } else if (lastActionRef.current.type === 'regenerateSuggestions') {
      handleRegenerateSuggestions(lastActionRef.current.payload.messageId);
    }
  };

  const handleRegenerateSuggestions = async (messageId: string) => {
    const sessionId = currentSessionId;
    if (!sessionId) return;
    lastActionRef.current = { type: 'regenerateSuggestions', payload: { messageId } };
    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession) return;
    const targetMessage = targetSession.messages.find(m => m.id === messageId);
    if (!targetMessage) return;
    const companyName = targetSession.empresaAlvo || extractCompanyName(targetSession.title || '') || 'Empresa não identificada';
    let lastUserQuestion = '';
    const msgs = targetSession.messages;
    const idx = msgs.findIndex(m => m.id === messageId);
    for (let i = idx - 1; i >= 0; i--) {
      if (msgs[i].sender === Sender.User) { lastUserQuestion = msgs[i].text; break; }
    }
    const snippet = (targetMessage.text || '').slice(0, 3000);
    const contextText = [`EMPRESA: ${companyName}`, lastUserQuestion ? `PERGUNTA_ANTERIOR: ${lastUserQuestion}` : '', 'TRECHO_DOSSIE:', snippet].filter(Boolean).join('\n\n');
    const oldSuggestions = targetMessage.suggestions || [];
    updateSessionById(sessionId, session => ({
      ...session, messages: session.messages.map(msg => msg.id === messageId ? { ...msg, isRegeneratingSuggestions: true } : msg),
    }));
    try {
      const newSuggestions = await generateNewSuggestions(contextText, oldSuggestions);
      updateSessionById(sessionId, session => ({
        ...session, messages: session.messages.map(msg => msg.id === messageId ? { ...msg, suggestions: newSuggestions, isRegeneratingSuggestions: false } : msg),
      }));
    } catch (e: any) {
      console.warn('Suggestion regeneration failed', e);
      alert(e.message || 'Falha na conexão com a IA.');
      updateSessionById(sessionId, session => ({
        ...session, messages: session.messages.map(msg => msg.id === messageId ? { ...msg, isRegeneratingSuggestions: false } : msg),
      }));
    }
  };

  const handleReportError = async (messageId: string, error: AppError) => {
    if (!currentSession) return;
    const errorPayload = JSON.stringify({ code: error.code, source: error.source, message: error.message, details: error.details }, null, 2);
    try {
      await sendFeedbackRemote({
        feedbackId: uuidv4(), sessionId: currentSession.id, messageId,
        sectionKey: 'ERROR_REPORT', sectionTitle: 'System Error',
        type: 'dislike', comment: `Automated Error Report: ${error.code}`,
        aiContent: errorPayload, userId, userName: user?.displayName,
        timestamp: new Date().toISOString(),
      });
    } catch (e) { console.error('Failed to report error', e); }
  };

  function handleExportPDF() {
    try {
      const { text: fullText, sections, allLinks } = collectFullReport(allMessages);
      if (!fullText || fullText.length < 100) { alert('Nenhum dossiê para exportar.'); return; }

      const inconsistenciesSection = detectInconsistencies(sections);
      const finalText = fullText + inconsistenciesSection;
      const empresa = cleanTitle(extractCompanyName(currentSession?.title));
      const now = new Date();
      const dataStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      const horaStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const metaLine = `${dataStr} às ${horaStr} · ${sections.length} seção${sections.length !== 1 ? 'ões' : ''}`;

      const pdf = new PDFGenerator();
      pdf.addHeader(empresa, metaLine);
      pdf.renderMarkdown(finalText);
      pdf.addSources(allLinks.map(l => ({ text: l.text || l.url, url: l.url })));

      const safeTitle = empresa.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
      pdf.save(`SeniorScout_${safeTitle}_${now.toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    }
  }

  const handleExportConversation = async (format: ExportFormat, reportType: ReportType) => {
    if (!currentSession) return;
    setExportStatus('loading');
    setExportError(null);
    try {
      const contentMarkdown = await generateConsolidatedDossier(currentSession.messages, systemInstruction, mode, reportType);
      const safeTitle = cleanTitle(currentSession.title).replace(/[^a-z0-9]/gi, '_').substring(0, 50);
      const dateStr = new Date().toISOString().slice(0, 10);
      const reportSuffix = reportType === 'executive' ? 'EXEC' : reportType === 'tech' ? 'FICHA' : 'DOSSIE';
      const filename = `SeniorScout_${safeTitle}_${reportSuffix}_${dateStr}`;
      if (format === 'md') {
        downloadFile(`${filename}.md`, contentMarkdown, 'text/markdown;charset=utf-8');
      } else if (format === 'doc') {
        const htmlContent = simpleMarkdownToHtml(contentMarkdown, currentSession.title);
        downloadFile(`${filename}.doc`, htmlContent, 'application/msword');
      }
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 3000);
    } catch (error: any) {
      setExportError(error.message || 'Falha ao gerar o arquivo.');
      setExportStatus('error');
    }
  };

  async function handleSendEmail() {
    if (!emailTo.includes('@')) return;
    setEmailStatus('sending');
    try {
      const { text: fullText, sections } = collectFullReport(allMessages);
      if (!fullText || fullText.length < 100) { setEmailStatus('error'); return; }
      const inconsistenciesSection = detectInconsistencies(sections);
      const htmlBody = fixFakeLinksHTML(convertMarkdownToHTML(fullText + inconsistenciesSection, true));
      const response = await fetch(BACKEND_URL, {
        method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'sendEmail', email: emailTo, subject: emailSubject, body: htmlBody,
          empresa: cleanTitle(extractCompanyName(currentSession?.title)), vendedor: user?.displayName || 'Vendedor',
        }),
      });
      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch { result = response.ok ? { success: true } : { success: false }; }
      if (result.success) {
        setEmailStatus('sent');
        setTimeout(() => { setShowEmailModal(false); setEmailStatus(null); setEmailTo(''); }, 3000);
      } else {
        setEmailStatus('error');
      }
    } catch (err) { setEmailStatus('error'); toast.error('Falha ao enviar email. Verifique sua conexão.'); }
  }

  async function handleScheduleFollowUp() {
    setFollowUpStatus('sending');
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'scheduleFollowUp',
          empresa: cleanTitle(extractCompanyName(currentSession?.title)),
          vendedor: user?.displayName || 'Vendedor', dias: followUpDias,
          emailVendedor: emailTo, notas: followUpNotas,
        }),
      });
      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch { result = { success: true }; }
      if (result.success || result.ok) {
        setFollowUpStatus('sent');
        setTimeout(() => { setShowFollowUpModal(false); setFollowUpStatus('idle'); setFollowUpNotas(''); }, 3000);
      } else { setFollowUpStatus('error'); }
    } catch { setFollowUpStatus('error'); }
  }

  const handleFeedback = (messageId: string, feedback: Feedback) => {
    if (!currentSession) return;
    updateCurrentSession(session => ({
      ...session, messages: session.messages.map(m => m.id === messageId ? { ...m, feedback: m.feedback === feedback ? undefined : feedback } : m),
    }));
  };

  const handleSendFeedback = async (messageId: string, feedback: Feedback, comment: string, content: string) => {
    if (!currentSession) return;
    const snapshotSessionId = currentSession.id;
    updateSessionById(snapshotSessionId, session => ({
      ...session, messages: session.messages.map(m => m.id === messageId ? { ...m, feedback } : m),
    }));
    try {
      await sendFeedbackRemote({
        feedbackId: uuidv4(), sessionId: snapshotSessionId, messageId,
        sectionKey: null, sectionTitle: null,
        type: feedback === 'up' ? 'like' : 'dislike', comment, aiContent: content,
        userId, userName: user?.displayName, timestamp: new Date().toISOString(),
      });
    } catch (e) { console.error('Feedback error', e); }
  };

  const handleSectionFeedback = (messageId: string, sectionTitle: string, feedback: Feedback) => {
    updateCurrentSession(session => ({
      ...session, messages: session.messages.map(msg => {
        if (msg.id !== messageId) return msg;
        const currentSections = msg.sectionFeedback || {};
        const newVal = currentSections[sectionTitle] === feedback ? undefined : feedback;
        const newSections = { ...currentSections };
        if (newVal === undefined) delete newSections[sectionTitle]; else newSections[sectionTitle] = newVal;
        return { ...msg, sectionFeedback: newSections };
      }),
    }));
  };

  const handleToggleMessageSources = (messageId: string) => {
    updateCurrentSession(session => ({
      ...session, messages: session.messages.map(msg => msg.id === messageId ? { ...msg, isSourcesOpen: !msg.isSourcesOpen } : msg),
    }));
  };

  const handleSaveToCRM = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const existingCard = cards.find(c => c.id === `crm_${sessionId}`);
    if (existingCard) { setSelectedCRMCardId(existingCard.id); setActiveView('crm'); return; }
    const card = await createCardFromSession(session);
    setSelectedCRMCardId(card.id);
    setActiveView('crm');
  };

  const handleCreateManualCRMCard = async () => {
    if (!newCrmName.trim()) return;
    setIsCreatingCrmCard(true);
    try {
      const card = await createManualCard({
        companyName: newCrmName.trim(), website: newCrmWebsite.trim() || undefined,
        briefDescription: newCrmResumo.trim() || undefined, stage: 'prospeccao',
      });
      setNewCrmName(''); setNewCrmWebsite(''); setNewCrmResumo('');
      setShowNewCrmForm(false);
      setSelectedCRMCardId(card.id);
    } catch (err) { console.error('Erro ao criar card:', err); }
    finally { setIsCreatingCrmCard(false); }
  };

  const handleMoveCRMCard = async (cardId: string, toStage: CRMStage) => { await moveCardToStage(cardId, toStage); };
  const handleSelectCRMCard = (cardId: string) => { setSelectedCRMCardId(cardId); };
  const handleCloseCRMDetail = () => { setSelectedCRMCardId(null); };
  const handleMoveStageFromDetail = async (stage: string) => { if (selectedCRMCardId) await moveCardToStage(selectedCRMCardId, stage as CRMStage); };

  const handleSelectSessionFromDetail = async (sessionId: string) => {
    await handleSelectSession(sessionId);
    setActiveView('chat');
    setSelectedCRMCardId(null);
  };

  const handleCreateSessionFromDetail = () => {
    if (!selectedCRMCard) return;
    const companyName = selectedCRMCard.companyName || 'Empresa';
    setSelectedCRMCardId(null);
    setActiveView('chat');
    setTimeout(() => {
      handleNewSession();
      window.dispatchEvent(new CustomEvent('scout:prefill', { detail: { text: companyName } }));
    }, 80);
  };

  const handleOpenKanban = () => { setActiveView('crm'); setSelectedCRMCardId(null); };

  const renderUserHeader = () => {
    if (!user) return null;
    const displayName = typeof user.displayName === 'string' ? user.displayName : 'Usuário';
    return (
      <div className="hidden lg:flex items-center gap-2 mr-2 border-r border-slate-300 dark:border-slate-700 pr-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
          👤 {displayName}
        </span>
        <button onClick={logout} className="text-[10px] text-red-500 hover:text-red-600 font-medium hover:underline">Sair</button>
      </div>
    );
  };

  if (!isInitialized) {
    return (
      <div className={`flex h-screen w-full items-center justify-center ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} animate-pulse`}>Preparando ambiente...</p>
        </div>
      </div>
    );
  }

  const chatElement = (
    <ChatInterface
      currentSession={currentSession}
      sessions={sessions}
      onNewSession={handleNewSession}
      onSelectSession={handleSelectSession}
      onDeleteSession={handleDeleteSession}
      onSaveToCRM={handleSaveToCRM}
      onOpenKanban={handleOpenKanban}
      isSidebarOpen={isSidebarOpen}
      onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      messages={allMessages.slice(-visibleCount)}
      isLoading={isLoading}
      hasMore={allMessages.length > visibleCount}
      onSendMessage={handleSendMessage}
      onDeepDive={handleDeepDive}
      onFeedback={handleFeedback}
      onSendFeedback={handleSendFeedback}
      onSectionFeedback={handleSectionFeedback}
      onLoadMore={() => setVisibleCount(prev => prev + PAGE_SIZE)}
      onExportConversation={handleExportConversation}
      onExportPDF={handleExportPDF}
      onExportMessage={() => {}}
      onRetry={handleRetry}
      onStop={handleStopGeneration}
      onReportError={handleReportError}
      onClearChat={handleClearChat}
      onRegenerateSuggestions={handleRegenerateSuggestions}
      isDarkMode={isDarkMode}
      onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      onToggleMessageSources={handleToggleMessageSources}
      exportStatus={exportStatus}
      exportError={exportError}
      pdfReportContent={pdfReportContent}
      onOpenEmailModal={() => {
        setEmailSubject('Dossiê de Inteligência — ' + cleanTitle(extractCompanyName(currentSession?.title)) + ' — Senior Scout 360');
        setShowEmailModal(true);
        setEmailStatus(null);
      }}
      onOpenFollowUpModal={() => { setShowFollowUpModal(true); setFollowUpStatus('idle'); }}
      onSaveRemote={handleSaveRemote}
      isSavingRemote={isSavingRemote}
      remoteSaveStatus={remoteSaveStatus}
      userHeaderNode={renderUserHeader()}
      onLogout={logout}
      lastUserQuery={lastQuery}
      processing={{ stage: loadingStatus, completedStages: completedLoadingStatuses }}
      onDeleteMessage={handleDeleteMessage}
    />
  );

  const crmElement = (
    <div className={`flex h-full w-full ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pipeline · Kanban</p>
            <h1 className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-100">Mini CRM</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewCrmForm(prev => !prev)}
              className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 font-medium transition-colors">
              {showNewCrmForm ? '✕ Cancelar' : '+ Nova empresa'}
            </button>
            <button onClick={() => setActiveView('chat')}
              className="text-[11px] px-3 py-1.5 rounded-full border border-slate-300/70 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              ← Voltar
            </button>
          </div>
        </div>
        {showNewCrmForm && (
          <div className={`mb-5 rounded-xl border p-4 space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" value={newCrmName} onChange={e => setNewCrmName(e.target.value)} placeholder="Nome da empresa *" autoFocus
                className={`rounded-lg border px-3 py-2 text-sm bg-transparent ${isDarkMode ? 'border-slate-700 text-slate-100' : 'border-slate-300 text-slate-900'}`} />
              <input type="text" value={newCrmWebsite} onChange={e => setNewCrmWebsite(e.target.value)} placeholder="Website (opcional)"
                className={`rounded-lg border px-3 py-2 text-sm bg-transparent ${isDarkMode ? 'border-slate-700 text-slate-100' : 'border-slate-300 text-slate-900'}`} />
              <input type="text" value={newCrmResumo} onChange={e => setNewCrmResumo(e.target.value)} placeholder="Resumo breve (opcional)"
                className={`rounded-lg border px-3 py-2 text-sm bg-transparent ${isDarkMode ? 'border-slate-700 text-slate-100' : 'border-slate-300 text-slate-900'}`} />
            </div>
            <div className="flex justify-end">
              <button onClick={handleCreateManualCRMCard} disabled={!newCrmName.trim() || isCreatingCrmCard}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-400 disabled:cursor-not-allowed">
                {isCreatingCrmCard ? 'Criando...' : 'Criar empresa'}
              </button>
            </div>
          </div>
        )}
        <CRMPipeline cards={cards} onMoveCard={handleMoveCRMCard} onSelectCard={handleSelectCRMCard} />
      </div>
    </div>
  );

  return (
    <>
      <AuthModal />

      {/* Banner offline */}
      {!isOnline && (
        <div className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 text-amber-950 text-xs font-semibold py-1.5 px-4 shadow-lg">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M8.464 8.464a5 5 0 000 7.072M5.636 5.636a9 9 0 000 12.728M12 12v.01" />
          </svg>
          Sem conexão — algumas funções ficam indisponíveis offline
        </div>
      )}

      {/* Banner "voltou online" */}
      {isOnline && wasOffline && (
        <div
          className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-emerald-600 text-white text-xs font-semibold py-1.5 px-4 shadow-lg cursor-pointer"
          onClick={clearWasOffline}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Conexão restabelecida ✕
        </div>
      )}

      <div className={`flex flex-col h-screen w-full ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <header className={`h-12 px-3 md:px-4 flex items-center justify-between border-b backdrop-blur-sm ${
          isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Senior Scout 360</span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {MODE_LABELS[mode].icon} {MODE_LABELS[mode].label}
              </span>
            </div>
            <div className="ml-2 flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px]">
              <button onClick={() => setActiveView('chat')} className={`px-3 py-1 rounded-full flex items-center gap-1 ${
                activeView === 'chat' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}>💬 Investigação</button>
              <button onClick={() => setActiveView('crm')} className={`px-3 py-1 rounded-full flex items-center gap-1 ${
                activeView === 'crm' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}>📋 CRM</button>
            </div>
          </div>
          <div className="flex items-center gap-2">{renderUserHeader()}</div>
        </header>
        <div className="flex-1 min-h-0">{activeView === 'chat' ? chatElement : crmElement}</div>
      </div>
      <CRMDetail
        card={selectedCRMCard} sessions={sessions} onClose={handleCloseCRMDetail}
        onSelectSession={handleSelectSessionFromDetail} onMoveStage={handleMoveStageFromDetail}
        onCreateSessionFromCard={handleCreateSessionFromDetail} isDarkMode={isDarkMode}
      />
      {showEmailModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowEmailModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 pointer-events-none">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-xl pointer-events-auto">
              <h3 className="text-lg font-bold text-white mb-4">📧 Enviar Dossiê por Email</h3>
              <div className="space-y-3 mb-4">
                <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="Email do destinatário"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700/50 text-white text-sm focus:outline-none focus:border-emerald-500" autoFocus />
                <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Assunto"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700/50 text-white text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              {emailStatus && (
                <div className="text-sm mb-4 p-2 rounded-lg text-emerald-400 bg-emerald-500/10">
                  {emailStatus === 'sending' && '⏳ Enviando...'}{emailStatus === 'sent' && '✅ Enviado!'}{emailStatus === 'error' && '❌ Erro ao enviar.'}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowEmailModal(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm">Cancelar</button>
                <button onClick={handleSendEmail} disabled={emailStatus === 'sending' || !emailTo.includes('@')} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white text-sm">{emailStatus === 'sending' ? 'Enviando...' : 'Enviar'}</button>
              </div>
            </div>
          </div>
        </>
      )}
      {showFollowUpModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowFollowUpModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 pointer-events-none">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-xl pointer-events-auto">
              <h3 className="text-lg font-bold text-white mb-4">📅 Agendar Follow-up</h3>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[3, 7, 15, 30].map(d => (
                  <button key={d} onClick={() => setFollowUpDias(d)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      followUpDias === d ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-gray-700/30 bg-gray-800/50 text-gray-400'
                    }`}>
                    <p className="text-lg font-bold">{d}</p><p className="text-xs">dias</p>
                  </button>
                ))}
              </div>
              <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="Seu email para lembrete"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700/50 text-white text-sm mb-3 focus:outline-none focus:border-emerald-500" />
              <input type="text" value={followUpNotas} onChange={(e) => setFollowUpNotas(e.target.value)} placeholder="Notas (opcional)"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700/50 text-white text-sm mb-4 focus:outline-none focus:border-emerald-500" />
              {followUpStatus === 'sent' && <div className="text-sm mb-4 p-2 rounded-lg text-emerald-400 bg-emerald-500/10">✅ Follow-up agendado!</div>}
              {followUpStatus === 'error' && <div className="text-sm mb-4 p-2 rounded-lg text-red-400 bg-red-500/10">❌ Erro ao agendar.</div>}
              <div className="flex gap-3">
                <button onClick={() => setShowFollowUpModal(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm">Cancelar</button>
                <button onClick={handleScheduleFollowUp} disabled={followUpStatus === 'sending'} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white text-sm">{followUpStatus === 'sending' ? 'Agendando...' : `Agendar (${followUpDias}d)`}</button>
              </div>
            </div>
          </div>
        </>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
};

export default AppCore;
