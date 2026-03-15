import React, { useEffect, useState, useCallback } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { generateMeetingBriefing, type MeetingPrepInput, type MeetingBriefingData } from '../services/meetingPrepService';

interface MeetingBriefingProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  prepInput: MeetingPrepInput;
}

const MeetingBriefing: React.FC<MeetingBriefingProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  prepInput,
}) => {
  const [data, setData] = useState<MeetingBriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const dk = isDarkMode;

  const loadBriefing = useCallback((force: boolean = false) => {
    setLoading(true);
    setError(false);
    generateMeetingBriefing(prepInput, force)
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [prepInput]);

  useEffect(() => {
    if (isOpen && !data && !loading) {
      loadBriefing();
    }
  }, [isOpen, data, loading, loadBriefing]);

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.briefingMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  const handleExportPDF = () => {
    if (!data) return;
    // Usa download de texto como fallback simples
    const blob = new Blob([data.briefingMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `briefing_${prepInput.companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl transition-transform duration-300
          w-full sm:w-96 md:w-[28rem]
          ${dk ? 'bg-slate-900 border-l border-slate-700' : 'bg-white border-l border-slate-200'}
        `}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b flex-shrink-0 ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">📋</span>
            <div className="min-w-0">
              <h2 className={`text-sm font-bold truncate ${dk ? 'text-white' : 'text-slate-900'}`}>
                Briefing de Reunião
              </h2>
              <p className={`text-[10px] truncate ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                {prepInput.companyName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {data && (
              <button
                onClick={() => loadBriefing(true)}
                className={`p-1.5 rounded-lg text-[10px] transition-colors ${
                  dk ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
                title="Regenerar briefing"
              >
                🔄
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                dk ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="text-center py-8">
                <span className="text-3xl block mb-3">📋</span>
                <p className={`text-sm font-medium ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                  Preparando briefing...
                </p>
                <p className={`text-[10px] mt-1 ${dk ? 'text-slate-600' : 'text-slate-400'}`}>
                  Buscando notícias, clima, COMEX e gerando briefing...
                </p>
              </div>
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <div className={`h-4 w-32 rounded mb-2 ${dk ? 'bg-slate-800' : 'bg-slate-100'}`} />
                  <div className={`h-3 w-full rounded mb-1 ${dk ? 'bg-slate-800' : 'bg-slate-100'}`} />
                  <div className={`h-3 w-3/4 rounded ${dk ? 'bg-slate-800' : 'bg-slate-100'}`} />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <span className="text-3xl block mb-3">⚠️</span>
              <p className={`text-sm ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                Não foi possível gerar o briefing.
              </p>
              <button
                onClick={() => loadBriefing(true)}
                className="mt-3 text-[11px] text-emerald-500 hover:text-emerald-400 font-medium"
              >
                Tentar novamente
              </button>
            </div>
          ) : data ? (
            <div>
              {/* Company summary header */}
              <div className={`rounded-xl border p-3 mb-4 ${dk ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs font-bold ${dk ? 'text-white' : 'text-slate-900'}`}>
                  🏢 {prepInput.companyName}
                </p>
                <div className={`flex flex-wrap gap-2 mt-1.5 text-[10px] ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                  {prepInput.cnpj && <span>CNPJ: {prepInput.cnpj}</span>}
                  {prepInput.city && <span>📍 {prepInput.city}{prepInput.state ? `, ${prepInput.state}` : ''}</span>}
                  {prepInput.scorePorta !== undefined && (
                    <span className="text-emerald-500 font-semibold">PORTA {prepInput.scorePorta}/100</span>
                  )}
                  {prepInput.comex?.result?.isExportador && (
                    <span className="text-indigo-500 font-semibold">🚢 Exportadora</span>
                  )}
                </div>
              </div>

              {/* Markdown content */}
              <div className={`prose prose-sm max-w-none ${dk ? 'prose-invert' : ''}`}>
                <MarkdownRenderer content={data.briefingMarkdown} isDarkMode={dk} allowRawHtml={false} />
              </div>

              {/* Footer info */}
              {generatedAt && (
                <p className={`text-[9px] text-right mt-4 ${dk ? 'text-slate-600' : 'text-slate-400'}`}>
                  Gerado às {generatedAt}
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Action buttons */}
        {data && !loading && (
          <div className={`flex-shrink-0 p-4 border-t ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="flex gap-2">
              <button
                onClick={handleExportPDF}
                className={`flex-1 px-3 py-2.5 rounded-lg text-[11px] font-medium border transition-colors ${
                  dk
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                📄 Exportar
              </button>
              <button
                onClick={handleCopy}
                className={`flex-1 px-3 py-2.5 rounded-lg text-[11px] font-medium transition-colors ${
                  copied
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : dk
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }`}
              >
                {copied ? '✓ Copiado' : '📋 Copiar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MeetingBriefing;
