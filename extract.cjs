const fs = require('fs');
const code = fs.readFileSync('old_appcore_utf8.tsx', 'utf8');

const startMarker = `const [sessions, setSessions] = useState<ChatSession[]>([]);`;
const endMarker = `const handleToggleMessageSources = (messageId: string) => {`;
const endMarkerBlockEnd = `    }));\n  };`; // end of handleToggleMessageSources

const startIndex = code.indexOf(startMarker);
console.log('startIndex:', startIndex);
const endIndex = code.indexOf(endMarker);
console.log('endIndex:', endIndex);

if (startIndex === -1 || endIndex === -1) {
    console.error("Markers not found");
    process.exit(1);
}

// Find the precise end of `handleToggleMessageSources`
const functionBlock = code.substring(endIndex);
const blockEndIndex = endIndex + functionBlock.indexOf(endMarkerBlockEnd) + endMarkerBlockEnd.length;

const hooksContent = code.substring(startIndex, blockEndIndex);

const template = `import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { useMode } from '../contexts/ModeContext';
import { Message, Sender, Feedback, ChatSession, AppError, ExportFormat, ReportType } from '../types';
import { sendMessageToGemini, generateNewSuggestions, generateConsolidatedDossier, resetChatSession } from '../services/geminiService';
import { listRemoteSessions, getRemoteSession, saveRemoteSession } from '../services/sessionRemoteStore';
import { sendFeedbackRemote } from '../services/feedbackRemoteStore';
import { extractAllLinksFromMarkdown, formatSourcesForExport, SourceRef, cleanTitle, cleanStatusMarkers } from '../utils/textCleaners';
import { normalizeAppError } from '../utils/errorHelpers';
import { downloadFile } from '../utils/downloadHelpers';
import { fixFakeLinksHTML, extractValidLinks } from '../utils/linkFixer';
import { APP_NAME, MODE_LABELS } from '../constants';
import { BACKEND_URL } from '../services/apiConfig';
import { useToast } from './useToast';

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
    /completa?\\s+d[oa]s?\\s+(.*)/i,
    /(?:empresa|grupo|companhia)\\s+(.*)/i,
    /(?:investigar?|analisar?|pesquisar?)\\s+(?:a\\s+|o\\s+)?(.*)/i,
    /(?:sobre\\s+(?:a|o)\\s+)(.*)/i,
    /(?:dossie?\\s+d[oa]s?\\s+)(.*)/i,
    /(?:capivara\\s+d[oa]s?\\s+)(.*)/i,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim().replace(/\\.{3}$/, '').trim();
      if (name.length > 2 && name.length < 60) return name;
    }
  }
  return title.replace(/\\.{3}$/, '').trim();
}

function convertMarkdownToHTML(md: string, includeSources: boolean = true): string {
  const allLinks = extractValidLinks(md);
  let html = md
    .replace(
      /\\[\\[PORTA:(\\d+):P(\\d+):O(\\d+):R(\\d+):T(\\d+):A(\\d+)\\]\\]/g,
      (_, score, p, o, r, t, a) => {
        const s = parseInt(score);
        const color = s >= 71 ? '#059669' : s >= 41 ? '#eab308' : '#ef4444';
        const bgColor = s >= 71 ? '#f0fdf4' : s >= 41 ? '#fefce8' : '#fef2f2';
        const borderColor = s >= 71 ? '#059669' : s >= 41 ? '#eab308' : '#ef4444';
        const label = s >= 71 ? 'Alta Compatibilidade' : s >= 41 ? 'Média Compatibilidade' : 'Baixa Compatibilidade';
        return \`<div class="porta-score" style="border:2px solid \${borderColor};background:\${bgColor};">
          <div class="header"><span class="label-porta">PORTA</span><span><span class="score-num" style="color:\${color};">\${score}</span><span class="score-max">/100</span></span></div>
          <div class="bar-bg" style="background:\${color}20;"><div class="bar-fill" style="width:\${Math.min(s, 100)}%;background:\${color};"></div></div>
          <div class="compat" style="color:\${color};">\${label}</div>
          <div class="pillars"><span class="pill"><b>P</b> \${p}</span><span class="pill"><b>O</b> \${o}</span><span class="pill"><b>R</b> \${r}</span><span class="pill"><b>T</b> \${t}</span><span class="pill"><b>A</b> \${a}</span></div>
        </div>\`;
      }
    )
    .replace(/^>\\s*(.*$)/gm, '<blockquote>$1</blockquote>')
    .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\\*\\*\\*(.*?)\\*\\*\\*/g, '<strong><em>$1</em></strong>')
    .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
    .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, (match, text, url) => {
      if (url.includes('ai.studio') || url.includes('google.com/search') || url.includes('vertexai')) {
        return \`<strong style="color:#059669;">\${text}</strong>\`;
      }
      return \`<a href="\${url}" target="_blank" style="color:#059669;text-decoration:underline;">\${text}</a>\`;
    })
    .replace(/\\^(\\d+)/g, '<sup style="background:#059669;color:#fff;padding:1px 5px;border-radius:8px;font-size:10px;margin:0 1px;">$1</sup>')
    .replace(/^[\\-\\*] (.*$)/gm, '<li>$1</li>')
    .replace(/^\\d+\\. (.*$)/gm, '<li>$1</li>')
    .replace(/\\n\\n/g, '</p><p>')
    .replace(/\\n/g, '<br>')
    .replace(/^-----+$/gm, '<hr>')
    .replace(/^---+$/gm, '<hr>');
  html = html.replace(/(<li>[\\s\\S]*?<\\/li>(?:\\s*<li>[\\s\\S]*?<\\/li>)*)/g, '<ul>$1</ul>');
  html = html.replace(/(<blockquote>[\\s\\S]*?<\\/blockquote>)(\\s*<blockquote>[\\s\\S]*?<\\/blockquote>)*/g, (match) => {
    const content = match.replace(/<\\/?blockquote>/g, '');
    return '<blockquote>' + content + '</blockquote>';
  });
  html = html.replace(/<p><hr><\\/p>/g, '<hr>');
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
      const sectionHeader = userQuestion ? \`\\n\\n---\\n\\n## APROFUNDAMENTO: \${userQuestion}\\n\\n\` : \`\\n\\n---\\n\\n## APROFUNDAMENTO #\${i}\\n\\n\`;
      sections.push(sectionHeader + botText);
      const sectionLinks = extractAllLinksFromMarkdown(botText);
      sectionLinks.forEach(link => { if (!allLinks.find(l => l.url === link.url)) allLinks.push(link); });
    }
  }
  return { text: sections.join('\\n\\n'), sections, allLinks };
}

function detectInconsistencies(sections: string[]): string {
  if (sections.length < 2) return '';
  const inconsistencies: string[] = [];
  const patterns = [
    { label: 'Faturamento', regex: /faturamento[^:]*?:?\\s*(?:R\\$\\s*)?(\\d[\\d.,]*\\s*(?:mi|bi|mil|trilh)[a-záãõüê]*)/gi },
    { label: 'Área/Hectares', regex: /(\\d[\\d.,]*)\\s*(?:mil\\s+)?(?:hectares|ha\\b)/gi },
    { label: 'Funcionários', regex: /(\\d[\\d.,]*)\\s*(?:mil\\s+)?(?:funcionários|colaboradores|empregados)/gi },
    { label: 'Receita', regex: /receita[^:]*?:?\\s*(?:R\\$\\s*)?(\\d[\\d.,]*\\s*(?:mi|bi|mil|trilh)[a-záãõüê]*)/gi },
    { label: 'Unidades', regex: /(\\d[\\d.,]*)\\s*(?:unidades|filiais|fábricas|plantas|usinas)/gi },
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
          inconsistencies.push(\`**\${label}:** Dossiê principal menciona *\${mainMatches[0]}*, mas aprofundamento menciona *\${drillMatches[0]}*. Verifique qual é o dado mais recente.\`);
        }
      }
    }
  }
  if (inconsistencies.length === 0) return '';
  return '\\n\\n---\\n\\n## INCONSISTÊNCIAS DETECTADAS\\n\\n' +
    '> Os dados abaixo apareceram com valores diferentes entre o dossiê principal e os aprofundamentos. Recomenda-se verificar a fonte mais confiável antes de usar em propostas.\\n\\n' +
    inconsistencies.map((inc, i) => \`\${i + 1}. \${inc}\`).join('\\n') + '\\n';
}

function simpleMarkdownToHtml(md: string, title: string): string {
  const htmlBody = fixFakeLinksHTML(convertMarkdownToHTML(md, true));
  return \`
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>\${title}</title>
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
      <h1 style="font-size: 24px; border-bottom: 2px solid #059669; padding-bottom: 10px;">\${title}</h1>
      \${htmlBody}
      <br>
      <p style="font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px;">Gerado por \${APP_NAME} - Inteligência Comercial</p>
    </body>
    </html>
  \`;
}

export const useChat = () => {
  const { userId, user, isAuthenticated } = useAuth();
  const { mode, systemInstruction } = useMode();
  const { toast, toasts, dismiss } = useToast();

  ${hooksContent}

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

fs.writeFileSync('hooks/useChat.ts', template, 'utf8');
console.log('Successfully wrote hooks/useChat.ts');
