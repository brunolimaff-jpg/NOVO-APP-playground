import React from 'react';
import { CRMPipelineProps, CRM_STAGE_LABELS, CRMStage } from '../types';

export const CRMPipeline: React.FC<CRMPipelineProps> = ({ cards, onMoveCard, onSelectCard }) => {
  const stages: CRMStage[] = ['prospeccao', 'primeira_reuniao', 'levantamento', 'defesa_tecnica', 'dossie_final'];

  return (
    <div className="w-full h-full overflow-x-auto">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-w-[900px]">
        {stages.map(stage => (
          <div key={stage} className="bg-slate-950/40 border border-slate-800 rounded-2xl p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">
                {CRM_STAGE_LABELS[stage]}
              </h3>
              <span className="text-[10px] text-slate-500">{cards.filter(c => c.stage === stage).length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto min-h-[120px]">
              {cards.filter(c => c.stage === stage).map(card => (
                <button
                  key={card.id}
                  onClick={() => onSelectCard(card.id)}
                  className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 transition-colors p-3 shadow-sm"
                >
                  <div className="text-xs font-semibold text-slate-100 truncate mb-1">
                    {card.companyName}
                  </div>
                  {typeof card.latestScorePorta === 'number' && (
                    <div className="text-[10px] text-emerald-400 mb-1">
                      PORTA: {card.latestScorePorta}/100
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Saúde: {card.health === 'green' ? 'Verde' : card.health === 'yellow' ? 'Amarela' : 'Vermelha'}</span>
                    <select
                      value={stage}
                      onChange={e => onMoveCard(card.id, e.target.value as CRMStage)}
                      className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-slate-300"
                    >
                      {stages.map(s => (
                        <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                </button>
              ))}
              {cards.filter(c => c.stage === stage).length === 0 && (
                <div className="text-[11px] text-slate-600 text-center py-6 border border-dashed border-slate-700 rounded-xl">
                  Nenhuma empresa nesta etapa.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
