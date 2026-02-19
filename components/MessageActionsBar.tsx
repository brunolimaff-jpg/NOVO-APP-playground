
import React, { useState } from 'react';
import { Feedback } from '../types';

interface MessageActionsBarProps {
  content: string; // O conteúdo completo da mensagem da IA
  sourcesCount: number;
  currentFeedback?: Feedback;
  // onFeedback agora é usado apenas para update otimista local se necessário, 
  // mas o principal é o onSubmitFeedback
  onFeedback: (type: Feedback) => void;
  onSubmitFeedback: (type: Feedback, comment: string, content: string) => void;
  onToggleSources: () => void;
  isSourcesVisible: boolean;
  isDarkMode: boolean;
}

// Basic markdown to HTML converter for PDF export fallback
function simpleMarkdownToHTML(md: string): string {
  return md
    .replace(/^### (.*$)/gm, '<h3 style="color:#059669;margin-top:20px;font-size:14px;font-weight:bold;">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 style="color:#059669;margin-top:25px;font-size:16px;font-weight:bold;border-bottom:1px solid #eee;padding-bottom:5px;">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 style="color:#059669;margin-top:30px;font-size:18px;font-weight:bold;">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li style="margin-left:20px;">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li style="margin-left:20px;">$2</li>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/\[\^(\d+)\]/g, '<sup style="color:#059669;font-size:0.7em;">[$1]</sup>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color:#059669;text-decoration:none;">$1</a>');
}

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
  const [comment, setComment] = useState("");
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
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          setCopyState('copied');
          setTimeout(() => setCopyState('idle'), 2000);
        }
      } catch (fallbackErr) {
        console.error('Fallback copy error', fallbackErr);
      }
    }
  };

  // FIX 2: Generate PDF with formatted content instead of raw markdown
  const handleDownload = () => {
    try {
        const element = document.createElement('div');
        // Use simple markdown to html conversion for better PDF formatting
        const htmlContent = simpleMarkdownToHTML(content);
        
        element.innerHTML = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #059669;">
               <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #059669;">Senior Scout 360</h1>
               <p style="font-size: 11px; color: #666; margin-top: 5px;">Relatório gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            <div style="font-size: 12px;">${htmlContent}</div>
            <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 15px; font-size: 10px; color: #999; text-align: center;">
               Gerado por Senior Scout 360 - Investigação Completa
            </div>
          </div>
        `;
        
        const opt = {
            margin: [10, 15, 10, 15],
            filename: `scout_report_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // @ts-ignore
        if (window.html2pdf) {
            // @ts-ignore
            window.html2pdf().set(opt).from(element).save();
        } else {
            console.error("html2pdf library not loaded");
            alert("Erro: Biblioteca de PDF não carregada.");
        }
    } catch (e) {
        console.error("Error generating PDF", e);
        alert("Erro ao gerar PDF.");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Senior Scout 360 - Dossiê',
          text: content,
        });
      } catch (err) {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  // Lógica de Feedback
  const handleLike = () => {
    onFeedback('up'); // Update local state immediately
    onSubmitFeedback('up', '', content); // Send remote
    setFeedbackSubmitted('up');
    setShowCommentBox(false);
  };

  const handleDislikeStart = () => {
    setShowCommentBox(true);
  };

  const submitDislike = () => {
    onFeedback('down'); // Update local
    onSubmitFeedback('down', comment, content); // Send remote
    setFeedbackSubmitted('down');
    setShowCommentBox(false);
    setComment("");
  };

  const cancelDislike = () => {
    setShowCommentBox(false);
    setComment("");
  };

  return (
    <div className={`mt-3 pt-2 border-t ${borderColor} flex flex-col gap-2 select-none`}>
      <div className="flex flex-wrap items-center justify-between text-xs gap-2">
        <div className={`flex items-center gap-1 ${textColor}`}>
          <button
            onClick={handleShare}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all ${hoverColor} hover:${activeBg}`}
            title="Compartilhar (ou Copiar link)"
          >
            <span>🔗</span>
            <span className="hidden sm:inline">Compartilhar</span>
          </button>

          {/* FIX 2: Icon and label update */}
          <button
            onClick={handleDownload}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all ${hoverColor} hover:${activeBg}`}
            title="Baixar arquivo PDF"
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
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all ${sourcesCount === 0 ? 'opacity-50 cursor-not-allowed' : `${hoverColor} hover:${activeBg}`} ${isSourcesVisible ? `${activeBg} text-emerald-500` : ''}`}
            title={sourcesCount > 0 ? "Ver fontes utilizadas" : "Nenhuma fonte citada"}
          >
            <span>📚</span>
            <span className="hidden sm:inline">Fontes {sourcesCount > 0 && `(${sourcesCount})`}</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {feedbackSubmitted === 'up' && <span className="text-[10px] text-emerald-500 mr-1 animate-fade-in">Obrigado!</span>}
          {feedbackSubmitted === 'down' && <span className="text-[10px] text-red-400 mr-1 animate-fade-in">Feedback enviado</span>}
          
          <button
            onClick={handleLike}
            className={`p-1.5 rounded-md transition-all ${feedbackSubmitted === 'up' ? 'text-emerald-500 bg-emerald-500/10' : `${textColor} ${hoverColor} hover:${activeBg}`}`}
            title="Resposta útil"
          >
            👍
          </button>
          <button
            onClick={handleDislikeStart}
            className={`p-1.5 rounded-md transition-all ${feedbackSubmitted === 'down' ? 'text-red-500 bg-red-500/10' : `${textColor} ${hoverColor} hover:${activeBg}`}`}
            title="Resposta não útil"
          >
            👎
          </button>
        </div>
      </div>

      {/* Caixa de Comentário para Dislike */}
      {showCommentBox && (
        <div className={`p-3 rounded-lg text-xs animate-slide-in ${isDarkMode ? 'bg-slate-800/80 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
          <p className={`mb-2 font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            O que não ficou bom nesta resposta?
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex: Informação desatualizada, alucinação, link quebrado..."
            className={`w-full p-2 rounded mb-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
              isDarkMode ? 'bg-slate-900 text-white placeholder-slate-500 border-slate-700' : 'bg-white text-slate-800 placeholder-slate-400 border-slate-300'
            }`}
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={cancelDislike}
              className={`px-3 py-1.5 rounded transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
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
