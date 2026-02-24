import React from 'react';
import { CRMPipelineProps, CRM_STAGE_LABELS, CRMStage } from '../types';

export const CRMPipeline: React.FC<CRMPipelineProps> = ({ cards, onMoveCard, onSelectCard }) => {
  const stages: CRMStage[] = ['prospeccao', 'primeira_reuniao', 'levantamento', 'defesa_tecnica', 'dossie_final'];

  return (
    <div className="w-full h-full overflow-x-auto">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-w-[980px]">
        {stages.map(stage => {
          const stageCards = cards.filter(c => c.stage === stage);
          const total = stageCards.length;

          return (
            <div
              key={stage}
              className="rounded-2xl border bg-slate-50/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 p-3 flex flex-col shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {CRM_STAGE_LABELS[stage]}
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {total} {total === 1 ? 'empresa' : 'empresas'}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto min-h-[140px] pb-1">
                {stageCards.map(raw => {
                  const card: any = raw;

                  const porta = card.latestScorePorta as number | undefined;
                  const portaColor = porta >= 71 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                    porta >= 41 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                    'bg-red-500/15 text-red-700 dark:text-red-300';

                  const healthLabel = card.health === 'green'
                    ? 'Saudável'
                    : card.health === 'yellow'
                      ? 'Atenção'
                      : 'Crítica';

                  const investigationsCount = Array.isArray(card.linkedSessionIds)
                    ? card.linkedSessionIds.length
                    : undefined;

                  const updatedAt = card.updatedAt
                    ? new Date(card.updatedAt).toLocaleDateString('pt-BR')
                    : null;

                  return (
                    <button
                      key={card.id}
                      onClick={() => onSelectCard(card.id)}
                      className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 hover:border-emerald-500/70 hover:shadow-md transition-all p-3 flex flex-col gap-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-50 truncate">
                          {card.companyName || 'Empresa sem nome'}
                        </p>
                        {porta !== undefined && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${portaColor}`}>
                            PORTA {porta}/100
                          </span>
                        )}
                      </div>

                      {card.briefDescription && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {card.briefDescription}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              card.health === 'green'
                                ? 'bg-emerald-500'
                                : card.health === 'yellow'
                                  ? 'bg-amber-400'
                                  : 'bg-red-500'
                            }`}
                          />
                          {healthLabel}
                        </span>

                        <div className="flex items-center gap-2">
                          {investigationsCount !== undefined && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {investigationsCount} inv.
                            </span>
                          )}
                          <select
                            value={stage}
                            onChange={e => onMoveCard(card.id, e.target.value as CRMStage)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            {stages.map(s => (
                              <option key={s} value={s}>
                                {CRM_STAGE_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {updatedAt && (
                        <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                          Atualizado em {updatedAt}
                        </p>
                      )}
                    </button>
                  );
                })}

                {stageCards.length === 0 && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-500 text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    Nenhuma empresa nesta etapa.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
