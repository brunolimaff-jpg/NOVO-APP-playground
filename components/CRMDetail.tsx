import React from 'react';
import { CRMCard, ChatSession, CRM_STAGE_LABELS } from '../types';

interface CRMDetailProps {
  card: CRMCard | null;
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

  const linkedSessions = sessions.filter(s => card.linkedSessionIds.includes(s.id));
  const currentStageLabel = CRM_STAGE_LABELS[card.stage];

  const stages = ['prospeccao', 'primeira_reuniao', 'levantamento', 'defesa_tecnica', 'dossie_final'] as const;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isDarkMode ? 'bg-black/70' : 'bg-black/50'}`}>
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
        isDarkMode 
          ? 'bg-slate-900 border-slate-700 text-slate-100' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div>
            <h2 className="text-xl font-bold">{card.companyName}</h2>
            {card.cnpj && (
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                CNPJ: {card.cnpj}
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
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Score PORTA */}
          {card.latestScorePorta !== undefined && (
            <div className={`p-4 rounded-xl ${
              isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Score PORTA</span>
                <span className={`text-2xl font-bold ${
                  card.latestScorePorta >= 71 ? 'text-emerald-500' :
                  card.latestScorePorta >= 41 ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {card.latestScorePorta}/100
                </span>
              </div>
              <div className={`w-full h-2 rounded-full mt-2 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                <div 
                  className={`h-full rounded-full transition-all ${
                    card.latestScorePorta >= 71 ? 'bg-emerald-500' :
                    card.latestScorePorta >= 41 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${card.latestScorePorta}%` }}
                />
              </div>
            </div>
          )}

          {/* Health */}
          <div className={`p-4 rounded-xl ${
            isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'
          }`}>
            <span className="text-sm font-medium">Saúde do Negócio</span>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-block w-3 h-3 rounded-full ${
                card.health === 'green' ? 'bg-emerald-500' :
                card.health === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="capitalize">
                {card.health === 'green' ? 'Verde - Saudável' :
                 card.health === 'yellow' ? 'Amarela - Atenção' : 'Vermelha - Crítica'}
              </span>
            </div>
          </div>

          {/* Stage */}
          <div>
            <label className="text-sm font-medium mb-2 block">Etapa do Funil</label>
            <select
              value={card.stage}
              onChange={(e) => onMoveStage(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border text-sm ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-600 text-slate-100' 
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              {stages.map(stage => (
                <option key={stage} value={stage}>
                  {CRM_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
            <p className={`text-xs mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Na etapa desde: {card.movedToStageAt[card.stage] 
                ? new Date(card.movedToStageAt[card.stage]!).toLocaleDateString('pt-BR')
                : 'Data não registrada'}
            </p>
          </div>

          {/* Linked Sessions */}
          <div>
            <h3 className="text-sm font-medium mb-3">Sessões de Investigação Vinculadas</h3>
            {linkedSessions.length > 0 ? (
              <div className="space-y-2">
                {linkedSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isDarkMode 
                        ? 'bg-slate-800 border-slate-700 hover:border-emerald-500/50' 
                        : 'bg-slate-50 border-slate-200 hover:border-emerald-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium truncate">{session.title}</p>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {new Date(session.updatedAt).toLocaleDateString('pt-BR')} • {session.messages.length} mensagens
                        </p>
                      </div>
                      <span className="text-emerald-500 text-sm">Abrir →</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Nenhuma sessão vinculada encontrada localmente.
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} pt-4 border-t ${
            isDarkMode ? 'border-slate-700' : 'border-slate-200'
          }`}>
            <p>Criado em: {new Date(card.createdAt).toLocaleDateString('pt-BR')}</p>
            <p>Última atualização: {new Date(card.updatedAt).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${
          isDarkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <button
            onClick={onClose}
            className={`w-full py-3 rounded-xl font-medium transition-colors ${
              isDarkMode 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-100' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
            }`}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
