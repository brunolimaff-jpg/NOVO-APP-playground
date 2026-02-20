import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatInterface from './components/ChatInterface';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './contexts/AuthContext';
import { useMode } from './contexts/ModeContext';
import { Message, Sender, Feedback, ChatSession, ExportFormat, ReportType, AppError } from './types';
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

// ============================================
// UTILITY FUNCTIONS
// ============================================

function extractCompanyName(title: string | null | undefined): string {
  if (!title) return 'Empresa';
  
  const patterns = [
    /completa?\s+d[oa]s?\s+(.*)/i,
    /(?:empresa|grupo|companhia)\s+(.*)/i,
    /(?:investigar?|analisar?|pesquisar?)\s+(?:a\s+|o\s+)?(.*)/i,
    /(?:sobre\s+(?:a|o)\s+)(.*)/i,
    /(?:dossiê?\s+d[oa]s?\s+)(.*)/i,
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

// ============================================
// MARKDOWN → HTML CONVERTER (COM FONTES)
// ============================================

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
          <div class="header">
            <span class="label-porta">🎯 PORTA</span>
            <span><span class="score-num" style="color:${color};">${score}</span><span class="score-max">/100</span></span>
          </div>
          <div class="bar-bg" style="background:${color}20;">
            <div class="bar-fill" style="width:${Math.min(s, 100)}%;background:${color};"></div>
          </div>
          <div class="compat" style="color:${color};">${label}</div>
          <div class="pillars">
            <span class="pill"><b>P</b> ${p}</span>
            <span class="pill"><b>O</b> ${o}</span>
            <span class="pill"><b>R</b> ${r}</span>
            <span class="pill"><b>T</b> ${t}</span>
            <span class="pill"><b>A</b> ${a}</span>
          </div>
        </div>`;
      }
    )
    .replace(/^-----+$/gm, '<hr>')
    .replace(/^---+$/gm, '<hr>')
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
    .replace(/\n/g, '<br>');

  html = html.replace(/(<li>[\s\S]*?<\/li>(?:\s*<li>[\s\S]*?<\/li>)*)/g, '<ul>$1</ul>');
  
  html = html.replace(/(<blockquote>[\s\S]*?<\/blockquote>)(\s*<blockquote>[\s\S]*?<\/blockquote>)*/g, (match) => {
    const content = match.replace(/<\/?blockquote>/g, '');
    return '<blockquote>' + content + '</blockquote>';
  });

  if (includeSources && allLinks.length > 0) {
    html += formatSourcesForExport(allLinks);
  }

  return '<p>' + html + '</p>';
}

// ============================================
// REPORT COLLECTION (COM LINKS)
// ============================================

function collectFullReport(messages: any[]): { text: string; sections: string[]; allLinks: SourceRef[] } {
  const botMessages = messages.filter((m: any) => {
    const sender = m.sender || m.role || m.type || '';
    const text = m.text || m.content || m.message || '';
    return (sender === 'bot' || sender === 'assistant' || sender === 'model') 
      && typeof text === 'string' 
      && text.length > 50;
  });

  if (botMessages.length === 0) return { text: '', sections: [], allLinks: [] };

  const sections: string[] = [];
  const allLinks: SourceRef[] = [];

  const dossieText = botMessages[0].text || botMessages[0].content || '';
  sections.push(dossieText);
  
  const dossieLinks = extractAllLinksFromMarkdown(dossieText);
  dossieLinks.forEach(link => {
    if (!allLinks.find(l => l.url === link.url)) {
      allLinks.push(link);
    }
  });

  for (let i = 1; i < botMessages.length; i++) {
    const botText = botMessages[i].text || botMessages[i].content || '';
    
    const botIndex = messages.indexOf(botMessages[i]);
    let userQuestion = '';
    for (let j = botIndex - 1; j >= 0; j--) {
      const s = messages[j].sender || messages[j].role || '';
      if (s === 'user' || s === 'human') {
        userQuestion = messages[j].text || messages[j].content || '';
        break;
      }
    }

    if (botText.length > 50) {
      const sectionHeader = userQuestion 
        ? `\n\n---\n\n## 🔍 APROFUNDAMENTO: ${userQuestion}\n\n`
        : `\n\n---\n\n## 🔍 APROFUNDAMENTO #${i}\n\n`;
      sections.push(sectionHeader + botText);
      
      const sectionLinks = extractAllLinksFromMarkdown(botText);
      sectionLinks.forEach(link => {
        if (!allLinks.find(l => l.url === link.url)) {
          allLinks.push(link);
        }
      });
    }
  }

  const fullText = sections.join('\n\n');
  return { text: fullText, sections, allLinks };
}

// ============================================
// INCONSISTENCY DETECTION
// ============================================

function detectInconsistencies(sections: string[]): string {
  if (sections.length < 2) return '';

  const inconsistencies: string[] = [];

  const patterns = [
    { label: 'Faturamento', regex: /faturamento[^:]*?:?\s*(?:R\$\s*)?(\d[\d.,]*\s*(?:mi|bi|mil|trilh)[a-zõã]*)/gi },
    { label: 'Área/Hectares', regex: /(\d[\d.,]*)\s*(?:mil\s+)?(?:hectares|ha\b)/gi },
    { label: 'Funcionários', regex: /(\d[\d.,]*)\s*(?:mil\s+)?(?:funcionários|colaboradores|empregados)/gi },
    { label: 'Receita', regex: /receita[^:]*?:?\s*(?:R\$\s*)?(\d[\d.,]*\s*(?:mi|bi|mil|trilh)[a-zõã]*)/gi },
    { label: 'Unidades', regex: /(\d[\d.,]*)\s*(?:unidades|filiais|fábricas|plantas|usinas)/gi },
  ];

  const mainSection = sections[0];

  for (let i = 1; i < sections.length; i++) {
    const drilldown = sections[i];

    for (const { label, regex } of patterns) {
      regex.lastIndex = 0;
      const mainMatches: string[] = [];
      let match;
      while ((match = regex.exec(mainSection)) !== null) {
        mainMatches.push(match[0].trim());
      }

      regex.lastIndex = 0;
      const drillMatches: string[] = [];
      while ((match = regex.exec(drilldown)) !== null) {
        drillMatches.push(match[0].trim());
      }

      if (mainMatches.length > 0 && drillMatches.length > 0) {
        const mainVal = mainMatches[0].toLowerCase();
        const drillVal = drillMatches[0].toLowerCase();
        if (mainVal !== drillVal) {
          inconsistencies.push(
            `**${label}:** Dossiê principal menciona *${mainMatches[0]}*, mas aprofundamento menciona *${drillMatches[0]}*. Verifique qual é o dado mais recente.`
          );
        }
      }
    }
  }

  if (inconsistencies.length === 0) return '';

  return '\n\n---\n\n## ⚠️ INCONSISTÊNCIAS DETECTADAS\n\n' +
    '> Os dados abaixo apareceram com valores diferentes entre o dossiê principal e os aprofundamentos. ' +
    'Recomenda-se verificar a fonte mais confiável antes de usar em propostas.\n\n' +
    inconsistencies.map((inc, i) => `${i + 1}. ${inc}`).join('\n') +
    '\n';
}

// ============================================
// SIMPLE HTML FOR DOC EXPORT
// ============================================

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
        ul { padding-left: 20px; }
        li { margin-bottom: 5px; }
        blockquote { border-left: 4px solid #f59e0b; background: #fffbeb; padding: 10px; margin: 10px 0; color: #92400e; }
        .sources-section { margin-top: 20px; padding-top: 10px; border-top: 1px solid #059669; }
        .sources-section h2 { color: #064e3b; font-size: 14px; }
      </style>
    </head>
    <body>
      <h1 style="font-size: 24px; border-bottom: 2px solid #059669; padding-bottom: 10px;">${title}</h1>
      ${htmlBody}
      <br>
      <p style="font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px;">
        Gerado por ${APP_NAME} - Inteligência Comercial
      </p>
    </body>
    </html>
  `;
}

// ============================================
// PDF EXPORT STYLES
// ============================================

const PDF_STYLES = `
  @page { margin: 1.5cm 1.8cm; size: A4; }
  @media print { .no-print { display: none !important; } body { padding-top: 0; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', -apple-system, Arial, sans-serif;
    color: #1e293b; max-width: 760px; margin: 0 auto;
    padding: 24px 32px; line-height: 1.55; font-size: 12px; background: #fff;
    padding-top: 60px; text-align: justify;
  }

  .doc-header {
    background: linear-gradient(135deg, #064e3b 0%, #059669 60%, #10b981 100%);
    color: white; padding: 22px 26px; border-radius: 8px; margin-bottom: 20px;
    position: relative; overflow: hidden;
  }
  .doc-header::after {
    content: ''; position: absolute; top: -30px; right: -30px;
    width: 120px; height: 120px; border-radius: 50%;
    background: rgba(255,255,255,0.06);
  }
  .doc-header .badge {
    display: inline-block; background: rgba(255,255,255,0.18);
    padding: 2px 10px; border-radius: 20px; font-size: 9px;
    font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 8px;
  }
  .doc-header h1 { margin: 0; font-size: 20px; font-weight: 700; text-align: left; line-height: 1.3; }
  .doc-header .subtitle { margin: 3px 0 0; font-size: 11.5px; opacity: 0.85; }
  .doc-header .meta {
    margin: 10px 0 0; font-size: 10.5px; opacity: 0.7;
    border-top: 1px solid rgba(255,255,255,0.15); padding-top: 8px;
  }

  .toc {
    background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);
    border: 1px solid #d1fae5; border-left: 4px solid #059669;
    border-radius: 6px; padding: 12px 16px; margin-bottom: 18px;
  }
  .toc h3 { margin: 0 0 6px; color: #064e3b; font-size: 12px; font-weight: 700; }
  .toc ul { list-style: none; padding: 0; margin: 0; }
  .toc li { padding: 2px 0; font-size: 11.5px; color: #334155; }
  .toc li::before { content: '→ '; color: #059669; font-weight: 600; }

  h1 { color: #064e3b; font-size: 16px; font-weight: 700; margin: 22px 0 6px; padding: 6px 0 4px; border-bottom: 2px solid #059669; text-align: left; }
  h2 { color: #064e3b; font-size: 14px; font-weight: 700; margin: 18px 0 5px; padding-bottom: 3px; border-bottom: 1px solid #d1fae5; text-align: left; }
  h3 { color: #065f46; font-size: 13px; font-weight: 700; margin: 14px 0 4px; text-align: left; }
  h4 { color: #065f46; font-size: 12px; font-weight: 700; margin: 10px 0 3px; text-align: left; }

  p { margin: 0 0 6px; }
  strong, b { color: #064e3b; }
  a { color: #059669; text-decoration: underline; }
  em { color: #475569; }

  ul, ol { margin: 4px 0 8px; padding-left: 20px; text-align: left; }
  li { margin: 2px 0; line-height: 1.5; }

  hr { border: none; margin: 18px 0; border-top: 1px solid #e2e8f0; position: relative; }

  table {
    width: 100%; border-collapse: separate; border-spacing: 0;
    margin: 10px 0 14px; font-size: 11px;
    border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;
  }
  thead { background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); }
  th { color: white; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #059669; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; text-align: left; color: #334155; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr:hover td { background: #f0fdf4; }
  td:first-child { font-weight: 600; color: #064e3b; }

  blockquote {
    border-left: 3px solid #f59e0b; background: #fffbeb;
    padding: 8px 12px; margin: 8px 0; border-radius: 0 6px 6px 0;
    font-size: 11.5px; color: #92400e;
  }

  .inconsistency-box {
    border: 1.5px solid #f59e0b; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border-radius: 6px; padding: 12px 16px; margin: 16px 0;
  }
  .inconsistency-box h2 { color: #b45309; border-bottom-color: #f59e0b; font-size: 13px; margin: 0 0 6px; }

  code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 11px; color: #065f46; }

  .porta-score { border-radius: 8px; padding: 14px 18px; margin: 12px 0; page-break-inside: avoid; }
  .porta-score .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .porta-score .label-porta { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #666; }
  .porta-score .score-num { font-size: 22px; font-weight: 800; line-height: 1; }
  .porta-score .score-max { font-size: 12px; color: #999; }
  .porta-score .bar-bg { width: 100%; height: 5px; border-radius: 3px; margin-bottom: 6px; }
  .porta-score .bar-fill { height: 100%; border-radius: 3px; }
  .porta-score .compat { font-size: 11px; font-weight: 600; margin-bottom: 8px; }
  .porta-score .pillars { font-size: 10.5px; color: #555; }
  .porta-score .pill { display: inline-block; background: #f1f5f9; padding: 2px 8px; border-radius: 12px; margin-right: 4px; }
  .porta-score .pill b { color: #059669; }

  .sources-section { margin-top: 24px; padding-top: 16px; border-top: 2px solid #059669; page-break-inside: avoid; }
  .sources-section h2 { color: #064e3b; font-size: 14px; font-weight: 700; margin-bottom: 10px; border: none; padding: 0; }
  .sources-section ul { list-style: decimal; padding-left: 20px; }
  .sources-section li { margin: 4px 0; font-size: 11px; color: #475569; }
  .sources-section a { color: #059669; text-decoration: underline; }

  .doc-footer {
    margin-top: 24px; padding-top: 12px; border-top: 1.5px solid #064e3b;
    display: flex; justify-content: space-between; align-items: center;
    page-break-inside: avoid;
  }
  .doc-footer .left { font-size: 10px; color: #6b7280; }
  .doc-footer .right { font-size: 9px; color: #9ca3af; text-align: right; }

  .print-bar {
    position: fixed; top: 0; left: 0; right: 0;
    background: linear-gradient(135deg, #064e3b 0%, #059669 100%);
    color: white; padding: 10px 24px;
    display: flex; align-items: center; justify-content: space-between;
    z-index: 100; box-shadow: 0 2px 12px rgba(0,0,0,0.2);
  }
  .print-bar button {
    background: #10b981; color: white; border: none; padding: 8px 24px;
    border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: background 0.2s;
  }
  .print-bar button:hover { background: #059669; }
  .print-bar .tip { font-size: 11px; opacity: 0.8; margin-left: 12px; }

  .section-divider { margin: 20px 0; border: none; border-top: 2px solid #059669; position: relative; }
  .section-divider::after { content: '◆'; position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: white; padding: 0 8px; color: #059669; font-size: 10px; }
  sup { background: #059669; color: #fff; padding: 1px 4px; border-radius: 6px; font-size: 9px; margin: 0 1px; font-weight: 600; }
`;

// ============================================
// MAIN APP COMPONENT
// ============================================

const App: React.FC = () => {
  const { userId, user, logout, isAuthenticated } = useAuth(); 
  const { mode, systemInstruction } = useMode();

  // State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('Iniciando análise');
  const [completedLoadingStatuses, setCompletedLoadingStatuses] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    return savedTheme === 'dark';
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [lastQuery, setLastQuery] = useState<string>(""); 
  const [isSavingRemote, setIsSavingRemote] = useState(false);
  const [remoteSaveStatus, setRemoteSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const [pdfReportContent, setPdfReportContent] = useState<string | null>(null);
  const [investigationLogged, setInvestigationLogged] = useState(false);

  // Modal States
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailStatus, setEmailStatus] = useState<'sending' | 'sent' | 'error' | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDias, setFollowUpDias] = useState(7);
  const [followUpNotas, setFollowUpNotas] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Refs
  const lastActionRef = useRef<LastAction | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;
  const allMessages = currentSession ? currentSession.messages : [];

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    const initApp = async () => {
      const savedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
      const savedTheme = localStorage.getItem(THEME_KEY);
      
      let localSessions: ChatSession[] = [];
      if (savedSessions) {
        try {
          const parsed = JSON.parse(savedSessions);
          localSessions = parsed.map((s: any) => ({
            ...s,
            messages: s.messages.map((m: any) => ({ 
              ...m, 
              text: cleanStatusMarkers(m.text || '').cleanText,
              timestamp: new Date(m.timestamp) 
            }))
          }));
        } catch (e) { console.error("Load error", e); }
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
        const mergedSessions = Array.from(sessionMap.values()).sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setSessions(mergedSessions);
        if (mergedSessions.length > 0) setCurrentSessionId(mergedSessions[0].id);
        else handleNewSession();
      } catch (e) {
        setSessions(localSessions);
        if (localSessions.length > 0) setCurrentSessionId(localSessions[0].id);
        else handleNewSession();
      }

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

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  const handleNewSession = useCallback(() => {
    if (isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'Nova Investigação',
      empresaAlvo: null, cnpj: null, modoPrincipal: null, scoreOportunidade: null, resumoDossie: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      messages: []
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
    setLastQuery("");
    setLoadingStatus('Iniciando análise');
  }, [isLoading]);

  const handleSelectSession = async (sessionId: string) => {
    if (isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
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
        if (fullSession) {
          setSessions(prev => prev.map(s => s.id === sessionId ? fullSession : s));
        }
      } catch (e) { console.error("Lazy load error", e); } 
      finally { setIsLoading(false); }
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);
    if (currentSessionId === sessionId) {
      resetChatSession();
      if (newSessions.length > 0) {
        const nextSession = newSessions[0];
        setCurrentSessionId(nextSession.id);
        if (nextSession.messages.length === 0) {
          setIsLoading(true);
          getRemoteSession(nextSession.id).then(fullSession => {
            if (fullSession) setSessions(prev => prev.map(s => s.id === nextSession.id ? fullSession : s));
            setIsLoading(false);
          }).catch(() => setIsLoading(false));
        }
      } else {
        handleNewSession();
      }
    }
  };

  const updateCurrentSession = (updater: (session: ChatSession) => ChatSession) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) return { ...updater(s), updatedAt: new Date().toISOString() };
      return s;
    }));
  };

  const handleSaveRemote = async () => {
    if (!currentSession || !isAuthenticated) return;
    setIsSavingRemote(true);
    setRemoteSaveStatus('idle');

    const now = new Date().toISOString();
    const finalized: ChatSession = { ...currentSession, updatedAt: now };
    updateCurrentSession(() => finalized);

    try {
      await saveRemoteSession(finalized, userId, user?.displayName);
      setRemoteSaveStatus('success');
      setTimeout(() => setRemoteSaveStatus('idle'), 3000);
    } catch (err) {
      setRemoteSaveStatus('error');
    } finally {
      setIsSavingRemote(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm("Isso apagará todas as mensagens desta investigação. Continuar?")) {
      resetChatSession();
      updateCurrentSession(session => ({
        ...session,
        messages: [],
        title: 'Nova Investigação',
        empresaAlvo: null,
        updatedAt: new Date().toISOString()
      }));
      setInvestigationLogged(false);
      setLoadingStatus('Realizando pesquisa...');
      lastActionRef.current = null;
      setLastQuery("");
      setVisibleCount(PAGE_SIZE);
    }
  };

  // ============================================
  // MESSAGING LOGIC
  // ============================================

  const processMessage = async (text: string, explicitSessionId?: string, explicitHistory?: Message[]) => {
    const sessionId = explicitSessionId || currentSessionId;
    if (!sessionId) {
      console.warn("No session ID found, aborting generation.");
      return;
    }

    setIsLoading(true);
    setLoadingStatus("Realizando pesquisa...");
    setCompletedLoadingStatuses([]);
    setLastQuery(text);
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    lastActionRef.current = { type: 'sendMessage', payload: { text } };

    let historyToPass: Message[] = [];
    if (explicitHistory) {
      historyToPass = explicitHistory;
    } else {
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        const msgs = session.messages;
        if (msgs.length > 0 && msgs[msgs.length - 1].text === text && msgs[msgs.length - 1].sender === Sender.User) {
          historyToPass = msgs.slice(0, -1);
        } else {
          historyToPass = msgs;
        }
      }
    }

    const botMessageId = uuidv4();
    const botMessagePlaceholder: Message = {
      id: botMessageId,
      sender: Sender.Bot,
      text: "",
      timestamp: new Date(),
      isThinking: true,
      isSourcesOpen: false
    };

    setSessions(prev => prev.map(s => s.id === sessionId ? {
      ...s,
      messages: [...s.messages.filter(m => !m.isError), botMessagePlaceholder],
      updatedAt: new Date().toISOString()
    } : s));
    
    setVisibleCount(prev => prev + 1);

    try {
      const { text: responseText, sources, suggestions, scorePorta } = await sendMessageToGemini(
        text, 
        historyToPass,
        systemInstruction, 
        { 
          signal,
          onText: () => {},
          onStatus: (newStatus) => {
            setLoadingStatus(prev => {
              if (prev && prev !== newStatus) {
                setCompletedLoadingStatuses(completed =>
                  completed.includes(prev) ? completed : [...completed, prev]
                );
              }
              return newStatus;
            });
          }
        }
      );

      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        title: (s.messages.length <= 2 || s.title === 'Nova Investigação') 
               ? cleanTitle(extractCompanyName(responseText || text)) 
               : s.title,
        empresaAlvo: (s.messages.length <= 2) 
                     ? extractCompanyName(responseText || text) 
                     : s.empresaAlvo,
        updatedAt: new Date().toISOString(),
        messages: s.messages.map(msg => 
          msg.id === botMessageId ? { 
            ...msg, 
            text: responseText,
            groundingSources: sources,
            suggestions: suggestions,
            scorePorta: scorePorta || undefined,
            isThinking: false
          } : msg
        )
      } : s));

      if (!investigationLogged && responseText.length > 500) {
        setInvestigationLogged(true);
        const titleToLog = extractCompanyName(text);
        
        fetch(BACKEND_URL, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'logInvestigation',
            vendedor: user?.displayName || 'Anônimo',
            empresa: cleanTitle(titleToLog),
            modo: mode || '',
            resumo: responseText.substring(0, 200),
          }),
        }).catch(err => console.log('Log falhou:', err));
      }

    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: s.messages.filter(msg => msg.id !== botMessageId || msg.text.trim().length > 0)
        } : s));
        return;
      }

      const appError = normalizeAppError(error);
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        messages: [...s.messages.filter(m => m.id !== botMessageId), {
          id: uuidv4(),
          sender: Sender.Bot,
          text: "Erro no processamento",
          timestamp: new Date(),
          isError: true,
          errorDetails: appError
        }]
      } : s));
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
        id: sessionId,
        title: immediateTitle || 'Nova Investigação',
        empresaAlvo: immediateTitle || null, cnpj: null, modoPrincipal: null, scoreOportunidade: null, resumoDossie: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        messages: []
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(sessionId);
      currentHistory = [];
    } else {
      const session = sessions.find(s => s.id === sessionId);
      currentHistory = session ? [...session.messages] : [];
    }
    
    const userMessage: Message = {
      id: uuidv4(), 
      sender: Sender.User, 
      text: displayText || text, 
      timestamp: new Date()
    };
    
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, messages: [...s.messages, userMessage], updatedAt: new Date().toISOString() } 
        : s
    ));
    setVisibleCount(prev => prev + 1); 

    await processMessage(text, sessionId, currentHistory); 
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
    lastActionRef.current = { type: 'regenerateSuggestions', payload: { messageId } };

    const currentSession = sessions.find(s => s.id === currentSessionId);
    if (!currentSession) return;

    const targetMessage = currentSession.messages.find(m => m.id === messageId);
    if (!targetMessage) return;

    const companyName =
      currentSession.empresaAlvo ||
      extractCompanyName(currentSession.title || "") ||
      "Empresa não identificada";

    let lastUserQuestion = "";
    const msgs = currentSession.messages;
    const idx = msgs.findIndex(m => m.id === messageId);
    for (let i = idx - 1; i >= 0; i--) {
      if (msgs[i].sender === Sender.User) {
        lastUserQuestion = msgs[i].text;
        break;
      }
    }

    const snippet = (targetMessage.text || "").slice(0, 3000);

    const contextText = [
      `EMPRESA: ${companyName}`,
      lastUserQuestion ? `PERGUNTA_ANTERIOR: ${lastUserQuestion}` : "",
      "TRECHO_DOSSIE:",
      snippet
    ].filter(Boolean).join("\n\n");

    const oldSuggestions = targetMessage.suggestions || [];

    updateCurrentSession(session => ({
      ...session,
      messages: session.messages.map(msg => 
        msg.id === messageId ? { ...msg, isRegeneratingSuggestions: true } : msg
      )
    }));

    try {
      const newSuggestions = await generateNewSuggestions(contextText, oldSuggestions);
      
      updateCurrentSession(session => ({
        ...session,
        messages: session.messages.map(msg => 
          msg.id === messageId ? { ...msg, suggestions: newSuggestions, isRegeneratingSuggestions: false } : msg
        )
      }));
    } catch (e: any) {
      console.warn("Suggestion regeneration failed...", e);
      alert(e.message || "Falha na conexão com a IA. As perguntas anteriores foram mantidas.");
      
      updateCurrentSession(session => ({
        ...session,
        messages: session.messages.map(msg => 
          msg.id === messageId ? { ...msg, isRegeneratingSuggestions: false } : msg
        )
      }));
    }
  };

  const handleReportError = async (messageId: string, error: AppError) => {
    if (!currentSession) return;
    
    const errorPayload = JSON.stringify({
      code: error.code,
      source: error.source,
      message: error.message,
      details: error.details
    }, null, 2);

    try {
      await sendFeedbackRemote({
        feedbackId: uuidv4(),
        sessionId: currentSession.id,
        messageId: messageId,
        sectionKey: 'ERROR_REPORT',
        sectionTitle: 'System Error',
        type: 'dislike',
        comment: `Automated Error Report: ${error.code}`,
        aiContent: errorPayload, 
        userId: userId,
        userName: user?.displayName,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Failed to report error", e);
    }
  };

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================

  function handleExportPDF() {
    const { text: fullText, sections, allLinks } = collectFullReport(allMessages);

    if (!fullText || fullText.length < 100) {
      alert('Nenhum dossiê para exportar. Faça uma investigação primeiro.');
      return;
    }

    const inconsistenciesSection = detectInconsistencies(sections);
    const finalText = fullText + inconsistenciesSection;

    const empresa = cleanTitle(extractCompanyName(currentSession?.title));
    const dataStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const horaStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const totalSections = sections.length;
    
    const htmlContent = fixFakeLinksHTML(convertMarkdownToHTML(finalText, true));
    
    let sourcesHTML = '';
    if (allLinks.length > 0) {
      sourcesHTML = formatSourcesForExport(allLinks);
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup bloqueado. Permita popups e tente novamente.');
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${empresa} — Senior Scout 360</title>
  <style>${PDF_STYLES}</style>
</head>
<body>
  <div class="print-bar no-print">
    <div>
      <strong>Senior Scout 360</strong>
      <span class="tip">Selecione "Salvar como PDF" no destino da impressão</span>
    </div>
    <button onclick="window.print()">📄 Salvar como PDF</button>
  </div>

  <div class="doc-header">
    <div class="badge">🔒 Inteligência Comercial</div>
    <h1>📋 ${empresa}</h1>
    <p class="subtitle">Dossiê de Inteligência Comercial — Senior Scout 360</p>
    <div class="meta">
      📅 ${dataStr} às ${horaStr} &nbsp;·&nbsp;
      📊 ${totalSections} seç${totalSections === 1 ? 'ão' : 'ões'} (dossiê${totalSections > 1 ? ' + ' + (totalSections - 1) + ' aprofundamento' + (totalSections > 2 ? 's' : '') : ''})
      ${allLinks.length > 0 ? ` &nbsp;·&nbsp; 🔗 ${allLinks.length} fontes` : ''}
    </div>
  </div>

  ${totalSections > 1 ? `
  <div class="toc">
    <h3>📑 Índice do Relatório</h3>
    <ul>
      <li>Dossiê Principal — Investigação Completa</li>
      ${sections.slice(1).map((_, i) => `<li>Aprofundamento #${i + 1}</li>`).join('')}
      ${inconsistenciesSection ? '<li>⚠️ Inconsistências Detectadas</li>' : ''}
      ${allLinks.length > 0 ? '<li>📚 Fontes e Referências</li>' : ''}
    </ul>
  </div>` : ''}

  ${htmlContent}

  ${sourcesHTML}

  <div class="doc-footer">
    <div class="left">
      <strong>Senior Scout 360</strong> · Inteligência Comercial para Agronegócio<br>
      © ${new Date().getFullYear()} Senior Sistemas S.A.
    </div>
    <div class="right">Documento gerado automaticamente<br>Verifique os dados antes de usar em propostas</div>
  </div>
</body>
</html>`);
    printWindow.document.close();
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
        setExportStatus('success');
        setTimeout(() => setExportStatus('idle'), 3000);

      } else if (format === 'doc') {
        const htmlContent = simpleMarkdownToHtml(contentMarkdown, currentSession.title);
        downloadFile(`${filename}.doc`, htmlContent, 'application/msword');
        setExportStatus('success');
        setTimeout(() => setExportStatus('idle'), 3000);
      }
      
    } catch (error: any) {
      console.error("Export Error:", error);
      setExportError(error.message || "Falha ao gerar o arquivo. Tente novamente.");
      setExportStatus('error');
    }
  };

  // ============================================
  // EMAIL & FOLLOW-UP
  // ============================================

  async function handleSendEmail() {
    if (!emailTo.includes('@')) return;
    setEmailStatus('sending');

    try {
      const { text: fullText, sections, allLinks } = collectFullReport(allMessages);

      if (!fullText || fullText.length < 100) {
        setEmailStatus('error');
        return;
      }

      const inconsistenciesSection = detectInconsistencies(sections);
      const finalText = fullText + inconsistenciesSection;
      const htmlBody = fixFakeLinksHTML(convertMarkdownToHTML(finalText, true));

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'sendEmail',
          email: emailTo,
          subject: emailSubject,
          body: htmlBody,
          empresa: cleanTitle(extractCompanyName(currentSession?.title)),
          vendedor: user?.displayName || 'Vendedor',
        }),
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        result = response.ok || response.type === 'opaque'
          ? { success: true }
          : { success: false };
      }

      if (result.success) {
        setEmailStatus('sent');
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailStatus(null);
          setEmailTo('');
        }, 3000);
      } else {
        console.error('Erro backend:', result.error);
        setEmailStatus('error');
        alert(`Falha no envio: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error('Erro ao enviar email:', err);
      setEmailStatus('error');
    }
  }

  async function handleScheduleFollowUp() {
    setFollowUpStatus('sending');

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'scheduleFollowUp',
          empresa: cleanTitle(extractCompanyName(currentSession?.title)),
          vendedor: user?.displayName || 'Vendedor',
          dias: followUpDias,
          emailVendedor: emailTo || user?.displayName?.includes('@') ? user.displayName : '',
          notas: followUpNotas,
          score: currentSession?.scoreOportunidade || '',
          produtos: '',
        }),
      });

      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch { result = { success: true }; }

      if (result.success || result.ok) {
        setFollowUpStatus('sent');
        setTimeout(() => {
          setShowFollowUpModal(false);
          setFollowUpStatus('idle');
          setFollowUpNotas('');
        }, 3000);
      } else {
        setFollowUpStatus('error');
      }
    } catch (err) {
      console.error('Erro follow-up:', err);
      setFollowUpStatus('error');
    }
  }

  // ============================================
  // FEEDBACK HANDLERS
  // ============================================

  const handleFeedback = (messageId: string, feedback: Feedback) => {
    if (!currentSession) return;
    updateCurrentSession(session => ({
      ...session, messages: session.messages.map(m => m.id === messageId ? { ...m, feedback: m.feedback === feedback ? undefined : feedback } : m)
    }));
  };

  const handleSendFeedback = async (messageId: string, feedback: Feedback, comment: string, content: string) => {
    if (!currentSession) return;
    updateCurrentSession(session => ({
      ...session, messages: session.messages.map(m => m.id === messageId ? { ...m, feedback: feedback } : m)
    }));
    try {
      await sendFeedbackRemote({
        feedbackId: uuidv4(),
        sessionId: currentSession.id,
        messageId, sectionKey: null, sectionTitle: null,
        type: feedback === 'up' ? 'like' : 'dislike', comment, aiContent: content, userId, userName: user?.displayName, timestamp: new Date().toISOString()
      });
    } catch (e) { console.error("Feedback error", e); }
  };

  const handleSectionFeedback = (messageId: string, sectionTitle: string, feedback: Feedback) => {
    updateCurrentSession(session => ({
      ...session, messages: session.messages.map(msg => {
        if (msg.id === messageId) {
          const currentSections = msg.sectionFeedback || {};
          const newVal = currentSections[sectionTitle] === feedback ? undefined : feedback;
          const newSections = { ...currentSections };
          if (newVal === undefined) delete newSections[sectionTitle]; else newSections[sectionTitle] = newVal;
          return { ...msg, sectionFeedback: newSections };
        } return msg;
      })
    }));
  };

  const handleToggleMessageSources = (messageId: string) => {
    updateCurrentSession(session => ({
      ...session, messages: session.messages.map(msg => msg.id === messageId ? { ...msg, isSourcesOpen: !msg.isSourcesOpen } : msg)
    }));
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderUserHeader = () => {
    if (!user) return null;
    const displayName = typeof user.displayName === 'string' 
      ? user.displayName 
      : (user.displayName as any)?.perfil_cliente || 'Usuário';

    return (
      <div className="hidden lg:flex items-center gap-2 mr-2 border-r border-slate-300 dark:border-slate-700 pr-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
          {user.isGuest ? '🙋' : '👤'} {displayName}
        </span>
        <button onClick={logout} className="text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 font-medium hover:underline">
          Sair
        </button>
      </div>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  if (!isInitialized) {
    return (
      <div className={`flex h-screen w-full items-center justify-center ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className={`text-sm font-medium tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} animate-pulse`}>
            Preparando ambiente...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AuthModal />
      <ChatInterface 
        currentSession={currentSession}
        sessions={sessions}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        messages={allMessages.slice(-visibleCount)}
        isLoading={isLoading}
        hasMore={allMessages.length > visibleCount}
        onSendMessage={handleSendMessage}
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
        userId={renderUserHeader() as any}
        onLogout={logout}
        lastUserQuery={lastQuery}
        processing={{ stage: loadingStatus, completedStages: completedLoadingStatuses }}
      />

      {/* Email Modal */}
      {showEmailModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowEmailModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 pointer-events-none">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-xl pointer-events-auto">
              <h3 className="text-lg font-bold text-white mb-1">📧 Enviar Dossiê por Email</h3>
              <p className="text-sm text-gray-400 mb-4">O dossiê será enviado formatado diretamente para o email informado.</p>
              
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Email do destinatário</label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="vendedor@senior.com.br"
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700/50 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Assunto</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700/50 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
              
              {emailStatus && (
                <div className="text-sm mb-4 p-2 rounded-lg text-emerald-400 bg-emerald-500/10">
                  {emailStatus === 'sending' && '⏳ Enviando...'}
                  {emailStatus === 'sent' && '✅ Email enviado com sucesso!'}
                  {emailStatus === 'error' && '❌ Erro ao enviar. Verifique o email e tente novamente.'}
                </div>
              )}
              
              <div className="flex gap-3">
                <button onClick={() => { setShowEmailModal(false); setEmailStatus(null); }} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium">Cancelar</button>
                <button onClick={handleSendEmail} disabled={emailStatus === 'sending' || !emailTo.includes('@')} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors text-sm font-medium">{emailStatus === 'sending' ? 'Enviando...' : 'Enviar'}</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Follow-up Modal */}
      {showFollowUpModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowFollowUpModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 pointer-events-none">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-xl pointer-events-auto">
              <h3 className="text-lg font-bold text-white mb-1">📅 Agendar Follow-up</h3>
              <p className="text-sm text-gray-400 mb-4">
                {currentSession?.title 
                  ? `Lembrete para retomar contato com ${cleanTitle(extractCompanyName(currentSession.title))}`
                  : 'Selecione o prazo para o lembrete'}
              </p>
              
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[3, 7, 15, 30].map(d => (
                  <button
                    key={d}
                    onClick={() => setFollowUpDias(d)}
                    className={`p-3 rounded-xl border text-center transition-all ${followUpDias === d ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-gray-700/30 bg-gray-800/50 text-gray-400 hover:border-gray-600'}`}
                  >
                    <p className="text-lg font-bold">{d}</p>
                    <p className="text-xs">dias</p>
                  </button>
                ))}
              </div>
              
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1 block">Seu email (receber lembrete)</label>
                <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="vendedor@senior.com.br" className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700/50 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>
              
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1 block">Notas (opcional)</label>
                <input type="text" value={followUpNotas} onChange={(e) => setFollowUpNotas(e.target.value)} placeholder="Ex: Retomar conversa sobre SimpleFarm" className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700/50 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>
              
              {followUpStatus === 'sent' && (<div className="text-sm mb-4 p-2 rounded-lg text-emerald-400 bg-emerald-500/10">✅ Follow-up agendado! Você receberá um lembrete.</div>)}
              {followUpStatus === 'error' && (<div className="text-sm mb-4 p-2 rounded-lg text-red-400 bg-red-500/10">❌ Erro ao agendar. Tente novamente.</div>)}
              
              <div className="flex gap-3">
                <button onClick={() => setShowFollowUpModal(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium">Cancelar</button>
                <button onClick={handleScheduleFollowUp} disabled={followUpStatus === 'sending'} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors text-sm font-medium">{followUpStatus === 'sending' ? 'Agendando...' : `Agendar (${followUpDias} dias)`}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default App;
