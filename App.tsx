import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
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

// ... (rest of App.tsx unchanged here, with the following key CRM additions within the component):
// - useCRM now destructures createManualCard and updateCard
// - New state: showNewCrmForm, newCrmName, newCrmCnpj, newCrmWebsite, newCrmResumo, isCreatingCrmCard
// - New handlers: handleCreateManualCRMCard, handleCreateSessionFromCard, handleCreateSessionFromDetail
// - crmElement header includes "+ Nova empresa" button and optional inline form with basic fields
// - CRMDetail is rendered with an extra prop onCreateSessionFromCard={handleCreateSessionFromDetail}
