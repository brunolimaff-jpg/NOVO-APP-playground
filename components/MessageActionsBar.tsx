
import React, { useState } from 'react';
import { Feedback } from '../types';

interface MessageActionsBarProps {
  content: string;
  sourcesCount: number;
  currentFeedback?: Feedback;
  onFeedback: (type: Feedback) => void;
  onSubmitFeedback: (type: Feedback, comment: string, content: string) => void;
  onToggleSources: () => void;
  isSourcesVisible: boolean;
  isDarkMode: boolean;
}

// ============================================================
// CONVERSOR MARKDOWN → HTML (para renderização no PDF)
// ============================================================
function simpleMarkdownToHTML(md: string): string {
  return md
    // Headings
    .replace(/^### (.*)$/gm, '<h3 style="color:#065f46;margin:18px 0 6px;font-size:13px;font-weight:700;letter-spacing:0.3px;">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 style="color:#047857;margin:24px 0 8px;font-size:15px;font-weight:700;border-bottom:2px solid #d1fae5;padding-bottom:6px;">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 style="color:#065f46;margin:28px 0 10px;font-size:18px;font-weight:800;">$1</h1>')
    // Bold / Italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#065f46;">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #d1fae5;margin:16px 0;">')
    // Blockquote
    .replace(/^> (.*)$/gm, '<blockquote style="border-left:3px solid #059669;margin:10px 0;padding:6px 12px;background:#f0fdf4;color:#374151;font-style:italic;font-size:11px;">$1</blockquote>')
    // Code inline
    .replace(/`([^`]+)`/g, '<code style="background:#f0fdf4;color:#065f46;padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace;">$1</code>')
    // Lists
    .replace(/^(\s*)[-•] (.*)$/gm, '<li style="margin:4px 0 4px 20px;padding-left:4px;">$2</li>')
    .replace(/^(\s*)(\d+)\. (.*)$/gm, '<li style="margin:4px 0 4px 24px;list-style-type:decimal;padding-left:4px;">$3</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul style="margin:6px 0;padding:0;">${match}</ul>`)
    // Links
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color:#059669;text-decoration:underline;word-break:break-all;">$1</a>')
    // Footnotes
    .replace(/\[\^(\d+)\]/g, '<sup style="color:#059669;font-size:0.7em;font-weight:600;">[$1]</sup>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p style="margin:0 0 10px;">')
    .replace(/\n/g, '<br>');
}

// ============================================================
// GERADOR DE HTML COMPLETO DO PDF
// ============================================================
function buildPdfHTML(content: string): string {
  const now = new Date();
  const dataFormatada = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const horaFormatada = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const body = simpleMarkdownToHTML(content);

  return `
    <div style="
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1f2937;
      line-height: 1.7;
      max-width: 780px;
      margin: 0 auto;
      padding: 0;
      background: #ffffff;
    ">
      <!-- CABEÇALHO -->
      <div style="
        background: #ffffff;
        padding: 32px 36px 24px;
        margin-bottom: 28px;
        border-bottom: 3px solid #059669;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:24px;font-weight:800;color:#065f46;letter-spacing:-0.5px;">
              🌿 Senior Scout 360
            </div>
            <div style="font-size:11px;color:#6b7280;margin-top:5px;letter-spacing:0.5px;text-transform:uppercase;">
              Inteligência Comercial · Agronegócio
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;">Emitido em</div>
            <div style="font-size:13px;font-weight:700;color:#065f46;margin-top:2px;">${dataFormatada}</div>
            <div style="font-size:10px;color:#9ca3af;margin-top:1px;">${horaFormatada}</div>
          </div>
        </div>
        <!-- Barra de aviso -->
        <div style="
          margin-top:18px;
          background:#f0fdf4;
          border-left:4px solid #059669;
          border-radius:4px;
          padding:10px 14px;
          font-size:10px;
          color:#065f46;
          letter-spacing:0.2px;
        ">
          ⚠️ <strong>Uso interno</strong> — Documento de apoio à prospecção. Não distribuir externamente.
        </div>
      </div>

      <!-- CORPO DO CONTEÚDO -->
      <div style="padding: 0 36px 12px; font-size: 12px; color: #1f2937;">
        <p style="margin:0 0 10px;">${body}</p>
      </div>

      <!-- RODAPÉ -->
      <div style="
        margin: 28px 36px 0;
        border-top: 2px solid #e5e7eb;
        padding-top: 14px;
        display: flex;
        justify-content: space-between;
        font-size: 9px;
        color: #9ca3af;
      ">
        <span>Senior Scout 360 — Plataforma de Inteligência Comercial</span>
        <span>Gerado automaticamente via IA · ${dataFormatada}</span>
      </div>

      <!-- ESPAÇO FINAL -->
      <div style="height: 24px;"></div>
    </div>
  `;
}

// ============================================================
// COMPONENTE
// ============================================================
const MessageActionsBar: React.FC<MessageActionsBarProps> = ({
  content,
  sourcesCount,
  currentFeedback,
  onFeedback,
  onSubmitFeedback,
  onToggleSources,
  isSourcesVisible,
  isDarkMode
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Feedback | null>(currentFeedback || null);

  const textColor = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const hoverColor = isDarkMode ? 'hover:text-slate-200' : 'hover:text-slate-800';
  const activeBg = isDarkMode ? 'bg-slate-700/50' : 'bg-slate-200';
  const borderColor = isDarkMode ? 'border-slate-700/50' : 'border-slate-200';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback...', err);
      try {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (ok) {
          setCopyState('copied');
          setTimeout(() => setCopyState('idle'), 2000);
        }
      } catch (fallbackErr) {
        console.error('Fallback copy error', fallbackErr);
      }
    }
  };

  // ============================================================
  // EXPORTAR PDF — Layout premium
  // ============================================================
  const handleDownload = () => {
    try {
      // @ts-ignore
      if (!window.html2pdf) {
        alert('Erro: biblioteca de PDF não carregada. Recarregue a página.');
        return;
      }

      const container = document.createElement('div');
      container.innerHTML = buildPdfHTML(content);

      const filename = `scout360_${new Date().toISOString().slice(0, 10)}_${Date.now()}.pdf`;

      const opt = {
        margin: [0, 0, 0, 0],
        filename,
        image: { type: 'jpeg', quality: 0.97 },
        html2canvas: {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      // @ts-ignore
      window.html2pdf().set(opt).from(container).save();
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Senior Scout 360 — Dossiê', text: content });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handleLike = () => {
    onFeedback('up');
    onSubmitFeedback('up', '', content);
    setFeedbackSubmitted('up');
    setShowCommentBox(false);
  };

  const handleDislikeStart = () => setShowCommentBox(true);

  const submitDislike = () => {
    onFeedback('down');
    onSubmitFeedback('down', comment, content);
    setFeedbackSubmitted('down');
    setShowCommentBox(false);
    setComment('');
  };

  const cancelDislike = () => {
    setShowCommentBox(false);
    setComment('');
  };

  return (
    <div className={`mt-3 pt-2 border-t ${borderColor} flex flex-col gap-2 select-none`}>
      <div className="flex flex-wrap items-center justify-between text-xs gap-2">
        <div className={`flex items-center gap-1 ${textColor}`}>
          <button
            onClick={handleShare}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all ${hoverColor} hover:${activeBg}`}
            title="Compartilhar (ou Copiar)"
          >
            <span>🔗</span>
            <span className="hidden sm:inline">Compartilhar</span>
          </button>

          <button
            onClick={handleDownload}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all ${hoverColor} hover:${activeBg}`}
            title="Baixar PDF premium"
          >
            <span>📕</span>
            <span className="hidden sm:inline">PDF</span>
          </button>

          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all ${hoverColor} hover:${activeBg}`}
            title="Copiar texto"
          >
            <span>{copyState === 'copied' ? '✅' : '📋'}</span>
            <span className="hidden sm:inline">{copyState === 'copied' ? 'Copiado' : 'Copiar'}</span>
          </button>

          <button
            onClick={onToggleSources}
            disabled={sourcesCount === 0}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all ${
              sourcesCount === 0
                ? 'opacity-50 cursor-not-allowed'
                : `${hoverColor} hover:${activeBg}`
            } ${isSourcesVisible ? `${activeBg} text-emerald-500` : ''}`}
            title={sourcesCount > 0 ? 'Ver fontes utilizadas' : 'Nenhuma fonte citada'}
          >
            <span>📚</span>
            <span className="hidden sm:inline">
              Fontes {sourcesCount > 0 && `(${sourcesCount})`}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {feedbackSubmitted === 'up' && (
            <span className="text-[10px] text-emerald-500 mr-1 animate-fade-in">Obrigado!</span>
          )}
          {feedbackSubmitted === 'down' && (
            <span className="text-[10px] text-red-400 mr-1 animate-fade-in">Feedback enviado</span>
          )}
          <button
            onClick={handleLike}
            className={`p-1.5 rounded-md transition-all ${
              feedbackSubmitted === 'up'
                ? 'text-emerald-500 bg-emerald-500/10'
                : `${textColor} ${hoverColor} hover:${activeBg}`
            }`}
            title="Resposta útil"
          >
            👍
          </button>
          <button
            onClick={handleDislikeStart}
            className={`p-1.5 rounded-md transition-all ${
              feedbackSubmitted === 'down'
                ? 'text-red-500 bg-red-500/10'
                : `${textColor} ${hoverColor} hover:${activeBg}`
            }`}
            title="Resposta não útil"
          >
            👎
          </button>
        </div>
      </div>

      {showCommentBox && (
        <div
          className={`p-3 rounded-lg text-xs animate-slide-in ${
            isDarkMode
              ? 'bg-slate-800/80 border border-slate-700'
              : 'bg-slate-50 border border-slate-200'
          }`}
        >
          <p className={`mb-2 font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            O que não ficou bom nesta resposta?
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex: Informação desatualizada, alucinação, link quebrado..."
            className={`w-full p-2 rounded mb-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
              isDarkMode
                ? 'bg-slate-900 text-white placeholder-slate-500 border-slate-700'
                : 'bg-white text-slate-800 placeholder-slate-400 border-slate-300'
            }`}
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={cancelDislike}
              className={`px-3 py-1.5 rounded transition-colors ${
                isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
              }`}
            >
              Cancelar
            </button>
            <button
              onClick={submitDislike}
              className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-sm"
            >
              Enviar Feedback
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageActionsBar;
