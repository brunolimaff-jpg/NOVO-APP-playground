import React, { useEffect, useState, useCallback } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import RegulatoryRadar from './RegulatoryRadar';
import CompetitorIntel from './CompetitorIntel';
import { generateSectorAnalysis, type SectorAnalysisData } from '../services/sectorAnalysisService';

interface SectorAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  cnpj: string;
  companyName: string;
  state?: string;
  briefDescription?: string;
  isExporter?: boolean;
}

const SectorAnalysis: React.FC<SectorAnalysisProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  cnpj,
  companyName,
  state,
  briefDescription,
  isExporter,
}) => {
  const [data, setData] = useState<SectorAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const dk = isDarkMode;

  const loadAnalysis = useCallback((force: boolean = false) => {
    setLoading(true);
    setError(false);
    generateSectorAnalysis(cnpj, companyName, {
      state,
      briefDescription,
      isExporter,
      forceRefresh: force,
    })
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [cnpj, companyName, state, briefDescription, isExporter]);

  useEffect(() => {
    if (isOpen && !data && !loading) {
      loadAnalysis();
    }
  }, [isOpen, data, loading, loadAnalysis]);

  const handleCopy = async () => {
    if (!data) return;
    const text = [
      data.sectorMarkdown,
      data.techAdoptionMarkdown,
      data.regulatoryItems.map(r => `${r.level === 'urgent' ? '🔴' : r.level === 'attention' ? '🟡' : '🟢'} ${r.name}: ${r.description} → ${r.seniorModule}`).join('\n'),
      data.competitorItems.map(c => `🏢 ${c.name} (${c.relativeSize}): ${c.techStack} — ${c.insight}`).join('\n'),
      data.salesArgument ? `\n💡 ${data.salesArgument}` : '',
    ].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const handleExport = () => {
    if (!data) return;
    const content = [
      `# Raio-X Setorial — ${companyName}`,
      data.cnae ? `CNAE: ${data.cnae.code} — ${data.cnae.description}` : '',
      '',
      data.sectorMarkdown,
      '',
      data.techAdoptionMarkdown,
      '',
      '## Radar Regulatório',
      ...data.regulatoryItems.map(r => `- ${r.level === 'urgent' ? '🔴' : r.level === 'attention' ? '🟡' : '🟢'} **${r.name}**: ${r.description} → ${r.seniorModule}`),
      '',
      '## Competidores do Prospect',
      ...data.competitorItems.map(c => `- **${c.name}** (${c.relativeSize}): ${c.techStack} — ${c.insight}`),
      '',
      data.salesArgument ? `> 💡 ${data.salesArgument}` : '',
    ].filter(Boolean).join('\n');

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `raio_x_${companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
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
          w-full sm:w-[26rem] md:w-[32rem]
          ${dk ? 'bg-slate-900 border-l border-slate-700' : 'bg-white border-l border-slate-200'}
        `}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b flex-shrink-0 ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">🏭</span>
            <div className="min-w-0">
              <h2 className={`text-sm font-bold truncate ${dk ? 'text-white' : 'text-slate-900'}`}>
                Raio-X Setorial
              </h2>
              <p className={`text-[10px] truncate ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                {companyName} {data?.cnae ? `· CNAE ${data.cnae.code}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {data && (
              <button
                onClick={() => loadAnalysis(true)}
                className={`p-1.5 rounded-lg text-[10px] transition-colors ${
                  dk ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
                title="Regenerar análise"
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
                <span className="text-3xl block mb-3">🏭</span>
                <p className={`text-sm font-medium ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                  Analisando setor...
                </p>
                <p className={`text-[10px] mt-1 ${dk ? 'text-slate-600' : 'text-slate-400'}`}>
                  Buscando CNAE, tendências, regulações e concorrentes
                </p>
              </div>
              {[...Array(5)].map((_, i) => (
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
                Não foi possível gerar a análise setorial.
              </p>
              <button
                onClick={() => loadAnalysis(true)}
                className="mt-3 text-[11px] text-emerald-500 hover:text-emerald-400 font-medium"
              >
                Tentar novamente
              </button>
            </div>
          ) : data ? (
            <div className="space-y-5">
              {/* CNAE badge */}
              {data.cnae && (
                <div className={`rounded-xl border p-3 ${dk ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-xs font-bold ${dk ? 'text-white' : 'text-slate-900'}`}>
                    🏢 {companyName}
                  </p>
                  <p className={`text-[10px] mt-1 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                    CNAE {data.cnae.code} — {data.cnae.description}
                  </p>
                </div>
              )}

              {/* Sector Overview + Trends */}
              {data.sectorMarkdown && (
                <div className={`prose prose-sm max-w-none ${dk ? 'prose-invert' : ''}`}>
                  <MarkdownRenderer content={data.sectorMarkdown} isDarkMode={dk} allowRawHtml={false} />
                </div>
              )}

              {/* Tech Adoption + Senior Modules */}
              {data.techAdoptionMarkdown && (
                <div className={`prose prose-sm max-w-none ${dk ? 'prose-invert' : ''}`}>
                  <MarkdownRenderer content={data.techAdoptionMarkdown} isDarkMode={dk} allowRawHtml={false} />
                </div>
              )}

              {/* Regulatory Radar */}
              <div className={`pt-3 border-t ${dk ? 'border-slate-700/50' : 'border-slate-200'}`}>
                <RegulatoryRadar items={data.regulatoryItems} isDarkMode={dk} />
              </div>

              {/* Competitor Intelligence */}
              <div className={`pt-3 border-t ${dk ? 'border-slate-700/50' : 'border-slate-200'}`}>
                <CompetitorIntel
                  items={data.competitorItems}
                  salesArgument={data.salesArgument}
                  isDarkMode={dk}
                />
              </div>

              {/* Footer info */}
              {generatedAt && (
                <p className={`text-[9px] text-right mt-4 ${dk ? 'text-slate-600' : 'text-slate-400'}`}>
                  Gerado às {generatedAt} {data.cnae ? `· CNAE ${data.cnae.code}` : ''}
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
                onClick={handleExport}
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

export default SectorAnalysis;
