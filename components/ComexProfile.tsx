import React, { useEffect, useState } from 'react';
import { fetchComexProfile, formatExportBand, formatNCMs, type ComexProfileData } from '../services/comexService';

interface ComexProfileProps {
  cnpj: string;
  isDarkMode: boolean;
  compact?: boolean; // versão compacta para CRM Detail
}

const ComexProfile: React.FC<ComexProfileProps> = ({ cnpj, isDarkMode, compact = false }) => {
  const [data, setData] = useState<ComexProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchComexProfile(cnpj)
      .then(result => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [cnpj]);

  // Loading skeleton
  if (loading) {
    return (
      <div className={`rounded-xl border p-3 ${compact ? '' : 'mt-3'} animate-pulse ${
        isDarkMode ? 'bg-indigo-950/20 border-indigo-800/30' : 'bg-indigo-50/30 border-indigo-200/40'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">🚢</span>
          <div className={`h-3 w-24 rounded ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
        </div>
      </div>
    );
  }

  // Sem dados (API indisponível em dev local)
  if (!data) return null;

  const { result } = data;
  const isExporter = result.isExportador;

  // Versão compacta para CRM Detail
  if (compact) {
    return (
      <div className={`rounded-xl border p-3 ${
        isDarkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🚢</span>
            <span className={`text-xs font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              COMEX
            </span>
          </div>
          {isExporter && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold">
              Exportadora
            </span>
          )}
        </div>
        {isExporter ? (
          <div className="mt-2 space-y-0.5">
            <p className={`text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              {formatExportBand(result.faixaValorEstimado)} · Ref {result.anoReferencia}
            </p>
            <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {formatNCMs(result.principaisNCMs)}
            </p>
          </div>
        ) : (
          <p className={`mt-1.5 text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Não listada como exportadora · MDIC {result.anoReferencia || new Date().getFullYear()}
          </p>
        )}
      </div>
    );
  }

  // Versão inline para chat (dentro do bubble do bot)
  if (!isExporter) {
    return (
      <div className={`rounded-xl border mt-3 p-3 ${
        isDarkMode ? 'bg-slate-800/30 border-slate-700/30' : 'bg-slate-50/50 border-slate-200/50'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">🚢</span>
          <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            COMEX — Não listada como exportadora (MDIC {result.anoReferencia || new Date().getFullYear()})
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border mt-3 overflow-hidden transition-all duration-200 ${
      isDarkMode ? 'bg-indigo-950/20 border-indigo-800/30' : 'bg-indigo-50/30 border-indigo-200/40'
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🚢</span>
          <span className={`text-xs font-semibold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
            Perfil COMEX — Exportadora
          </span>
        </div>
        <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {expanded ? '▴' : '▾'}
        </span>
      </button>

      {/* Content */}
      <div className="px-3 pb-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <div>
            <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Faixa</span>
            <p className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              {formatExportBand(result.faixaValorEstimado)}
            </p>
          </div>
          <div>
            <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ref</span>
            <p className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              {result.anoReferencia}
            </p>
          </div>
        </div>

        <p className={`mt-1.5 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Produtos: {formatNCMs(result.principaisNCMs)}
        </p>

        {/* Expanded details */}
        {expanded && (
          <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-indigo-800/20' : 'border-indigo-200/30'}`}>
            <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-amber-400/80' : 'text-amber-600'}`}>
              💡 Exportador ativo com operação de comércio exterior. Avaliar necessidade de módulos de câmbio,
              Commerce Log e gestão aduaneira na proposta comercial.
            </p>
            <p className={`text-[9px] text-right mt-2 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Fonte: MDIC/Comex Stat · CNPJ {cnpj}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComexProfile;
