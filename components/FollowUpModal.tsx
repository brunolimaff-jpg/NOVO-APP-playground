import React from 'react';

interface FollowUpModalProps {
  emailTo: string;
  onEmailToChange: (value: string) => void;
  followUpDias: number;
  onDiasChange: (value: number) => void;
  followUpNotas: string;
  onNotasChange: (value: string) => void;
  followUpStatus: 'idle' | 'sending' | 'sent' | 'error';
  onSchedule: () => void;
  onClose: () => void;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  emailTo,
  onEmailToChange,
  followUpDias,
  onDiasChange,
  followUpNotas,
  onNotasChange,
  followUpStatus,
  onSchedule,
  onClose,
}) => (
  <>
    <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4 pointer-events-none">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-xl pointer-events-auto">
        <h3 className="text-lg font-bold text-white mb-4">📅 Agendar Follow-up</h3>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[3, 7, 15, 30].map(d => (
            <button
              key={d}
              onClick={() => onDiasChange(d)}
              className={`p-3 rounded-xl border text-center transition-all ${
                followUpDias === d
                  ? 'border-emerald-500 bg-emerald-500/10 text-white'
                  : 'border-gray-700/30 bg-gray-800/50 text-gray-400'
              }`}
            >
              <p className="text-lg font-bold">{d}</p>
              <p className="text-xs">dias</p>
            </button>
          ))}
        </div>
        <input
          type="email"
          value={emailTo}
          onChange={(e) => onEmailToChange(e.target.value)}
          placeholder="Seu email para lembrete"
          className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700/50 text-white text-sm mb-3 focus:outline-none focus:border-emerald-500"
        />
        <input
          type="text"
          value={followUpNotas}
          onChange={(e) => onNotasChange(e.target.value)}
          placeholder="Notas (opcional)"
          className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700/50 text-white text-sm mb-4 focus:outline-none focus:border-emerald-500"
        />
        {followUpStatus === 'sent' && (
          <div className="text-sm mb-4 p-2 rounded-lg text-emerald-400 bg-emerald-500/10">
            ✅ Follow-up agendado!
          </div>
        )}
        {followUpStatus === 'error' && (
          <div className="text-sm mb-4 p-2 rounded-lg text-red-400 bg-red-500/10">
            ❌ Erro ao agendar.
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onSchedule}
            disabled={followUpStatus === 'sending'}
            className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white text-sm"
          >
            {followUpStatus === 'sending' ? 'Agendando...' : `Agendar (${followUpDias}d)`}
          </button>
        </div>
      </div>
    </div>
  </>
);
