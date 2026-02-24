import React from 'react';
import { ChatSession, CRM_STAGE_LABELS } from '../types';

interface CRMDetailProps {
  card: any; // intencionalmente flexvel para permitir campos adicionais do CRM
  sessions: ChatSession[];
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onMoveStage: (stage: string) => void;
  isDarkMode: boolean;
}

export const CRMDetail: React.FC<CRMDetailProps> = ({
  card,
  sessions,
  onClose,
  onSelectSession,
  onMoveStage,
  isDarkMode,
}) => {
  if (!card) return null;

  const linkedSessions = Array.isArray(card.linkedSessionIds)
    ? sessions.filter(s => card.linkedSessionIds.includes(s.id))
    : [];

  const stages = ['prospeccao', 'primeira_reuniao', 'levantamento', 'defesa_tecnica', 'dossie_final'] as const;

  const porta: number | undefined = typeof card.latestScorePorta === 'number' ? card.latestScorePorta : undefined;
  const portaColor = porta !== undefined
    ? porta >= 71
      ? 'text-emerald-500'
      : porta >= 41
        ? 'text-amber-400'
        : 'text-red-500'
    : 'text-slate-400';

  const portaBadgeBg = porta !== undefined
    ? porta >= 71
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : porta >= 41
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : 'bg-red-500/15 text-red-700 dark:text-red-300'
    : 'bg-slate-500/10 text-slate-500';

  const healthLabel = card.health === 'green'
    ? 'Verde · Saudvel'
    : card.health === 'yellow'
      ? 'Amarela · Ateno'
      : 'Vermelha · Crtica';

  const cnpjs: string[] = Array.isArray(card.cnpjs)
    ? card.cnpjs
    : card.cnpj
      ? [card.cnpj]
      : [];

  const website: string = card.website || '';
  const exactLink: string = card.exactLink || '';
  const briefDescription: string = card.briefDescription || card.description || '';

  const createdAt = card.createdAt ? new Date(card.createdAt).toLocaleDateString('pt-BR') : '';
  const updatedAt = card.updatedAt ? new Date(card.updatedAt).toLocaleDateString('pt-BR') : '';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isDarkMode ? 'bg-black/70' : 'bg-black/50'}`}>
      <div
        className={`w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border shadow-2xl ${
          isDarkMode
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-start justify-between gap-4 p-5 border-b ${
            isDarkMode ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Empresa no Mini CRM
            </p>
            <h2 className="mt-1 text-lg font-semibold truncate flex items-center gap-2">
              {card.companyName || 'Empresa sem nome'}
              {porta !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${portaBadgeBg}`}>
                  PORTA {porta}/100
                </span>
              )}
            </h2>
            {cnpjs.length > 0 && (
              <p className={`mt-1 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {cnpjs.join(' · ')}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'hover:bg-slate-800 text-slate-400'
                : 'hover:bg-slate-100 text-slate-500'
            }`}
            aria-label="Fechar detalhes do CRM"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 pb-4 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Coluna esquerda: dados da empresa */}
            <div className="md:col-span-3 space-y-4">
              <div
                className={`rounded-xl border p-4 ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-3">
                  Dados da empresa
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Nome da empresa</label>
                    <input
                      type="text"
                      value={card.companyName || ''}
                      readOnly
                      className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm bg-transparent ${
                        isDarkMode
                          ? 'border-slate-700 text-slate-100'
                          : 'border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">CNPJs</label>
                    {cnpjs.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {cnpjs.map(cnpj => (
                          <span
                            key={cnpj}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-200"
                          >
                            {cnpj}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        Nenhum CNPJ identificado ainda.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Website</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={website}
                        readOnly
                        placeholder="https://exemplo.com"
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-sm bg-transparent ${
                          isDarkMode
                            ? 'border-slate-700 text-slate-100 placeholder-slate-600'
                            : 'border-slate-300 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                      {website && (
                        <button
                          type="button"
                          onClick={() => window.open(website, '_blank')}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500 text-white hover:bg-emerald-600"
                        >
                          Abrir
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Breve descrio</label>
                    <textarea
                      value={briefDescription}
                      readOnly
                      placeholder="Resumo breve da empresa com base no dossi..."
                      rows={3}
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm resize-none bg-transparent ${
                        isDarkMode
                          ? 'border-slate-700 text-slate-100 placeholder-slate-600'
                          : 'border-slate-300 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-3">
                  Pesquisa / ExactSpotter
                </h3>
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Link da pesquisa</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={exactLink}
                    readOnly
                    placeholder="https://app.exactspotter.com/public/..."
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-sm bg-transparent ${
                      isDarkMode
                        ? 'border-slate-700 text-slate-100 placeholder-slate-600'
                        : 'border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  {exactLink && (
                    <button
                      type="button"
                      onClick={() => window.open(exactLink, '_blank')}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      Abrir pesquisa
                    </button>
                  )}
                </div>
                {!exactLink && (
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                    Cole o link p_blico do ExactSpotter na investigao para vincul-lo automaticamente aqui.
                  </p>
                )}
              </div>
            </div>

            {/* Coluna direita: PORTA + etapa + sesses */}
            <div className="md:col-span-2 space-y-4">
              {porta !== undefined && (
                <div
                  className={`rounded-xl border p-4 ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Score PORTA
                    </span>
                    <span className={`text-lg font-bold ${portaColor}`}>{porta}/100</span>
                  </div>
                  <div className={`w-full h-2 rounded-full mt-2 ${
                    isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
                  }`}>
                    <div
                      className={`h-full rounded-full transition-all ${
                        porta >= 71
                          ? 'bg-emerald-500'
                          : porta >= 41
                            ? 'bg-amber-400'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(porta, 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                    Sabemos que com novos aprofundamentos o PORTA pode mudar. Atualize o CRM sempre que gerar um novo dossi.
                  </p>
                </div>
              )}

              <div
                className={`rounded-xl border p-4 ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">
                  Etapa do funil
                </label>
                <select
                  value={card.stage}
                  onChange={e => onMoveStage(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-slate-100'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  {stages.map(stage => (
                    <option key={stage} value={stage}>
                      {CRM_STAGE_LABELS[stage]}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                  Na etapa desde: {card.movedToStageAt?.[card.stage]
                    ? new Date(card.movedToStageAt[card.stage]!).toLocaleDateString('pt-BR')
                    : 'Data no registrada'}
                </p>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mb-3">
                  Sesses de investigao vinculadas
                </h3>
                {linkedSessions.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {linkedSessions.map(session => (
                      <button
                        key={session.id}
                        onClick={() => onSelectSession(session.id)}
                        className={`w-full text-left p-3 rounded-lg border text-xs flex flex-col gap-0.5 transition-colors ${
                          isDarkMode
                            ? 'bg-slate-900 border-slate-700 hover:border-emerald-500/60'
                            : 'bg-white border-slate-200 hover:border-emerald-500/70'
                        }`}
                      >
                        <span className="font-medium truncate">{session.title}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {new Date(session.updatedAt).toLocaleDateString('pt-BR')} · {session.messages.length} mensagens
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Nenhuma sesso vinculada encontrada localmente.
                  </p>
                )}
              </div>

              <div
                className={`rounded-xl border p-3 text-[11px] flex flex-col gap-0.5 ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <span>Criado em: {createdAt || '—'}</span>
                <span>Última atualizao: {updatedAt || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between p-5 border-t ${
            isDarkMode ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Excluir esta empresa do Mini CRM? Esta ao no remover os dossis de investigao.')) {
                alert('Remoo do card do CRM ser implementada na prxima etapa.');
              }
            }}
            className="order-2 md:order-1 inline-flex items-center justify-center px-3 py-2 rounded-lg border border-red-500/60 text-[12px] font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10"
          >
            🗑 Excluir empresa do CRM
          </button>

          <button
            type="button"
            onClick={onClose}
            className="order-1 md:order-2 inline-flex items-center justify-center flex-1 md:flex-none px-4 py-2.5 rounded-lg text-[13px] font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
