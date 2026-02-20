import React from 'react';
import { motion } from 'framer-motion';
import { ScorePortaData } from '../types';

interface ScorePortaProps extends ScorePortaData {}

const pillars = [
  { key: 'p', label: 'Porte', description: 'Complexidade societária + hectares' },
  { key: 'o', label: 'Operação', description: 'Verticalização e industrialização' },
  { key: 'r', label: 'Retorno', description: 'Exposição fiscal e compliance' },
  { key: 't', label: 'Tecnologia', description: 'Infraestrutura e conectividade' },
  { key: 'a', label: 'Adoção', description: 'Maturidade e sponsor interno' },
];

function getScoreColor(score: number): string {
  if (score >= 71) return 'text-green-500';
  if (score >= 41) return 'text-yellow-500';
  return 'text-red-500';
}

function getScoreBg(score: number): string {
  if (score >= 71) return 'bg-green-500';
  if (score >= 41) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 71) return 'Alta Compatibilidade';
  if (score >= 41) return 'Média Compatibilidade';
  return 'Baixa Compatibilidade';
}

function getScoreEmoji(score: number): string {
  if (score >= 71) return '🎯';
  if (score >= 41) return '⚡';
  return '⚠️';
}

const ScorePorta: React.FC<ScorePortaProps> = ({ score, p, o, r, t, a }) => {
  const values = { p, o, r, t, a };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 md:p-6 text-white shadow-xl border border-slate-700 my-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-gray-300 flex items-center gap-2">
            {getScoreEmoji(score)} Score PORTA
          </h3>
          <p className="text-xs text-gray-500">Análise de compatibilidade</p>
        </div>
        <div className="text-right">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className={`text-3xl md:text-4xl font-bold ${getScoreColor(score)}`}
          >
            {score}
          </motion.div>
          <p className="text-xs text-gray-400">{getScoreLabel(score)}</p>
        </div>
      </div>

      {/* Main Score Bar */}
      <div className="mb-4">
        <div className="relative h-2.5 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`absolute inset-y-0 left-0 rounded-full ${getScoreBg(score)}`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {/* Pillars */}
      <div className="space-y-3">
        {pillars.map((pillar, index) => (
          <div key={pillar.key}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm font-medium text-gray-300">{pillar.label}</span>
                <span className="text-[10px] text-gray-500 hidden md:inline">({pillar.description})</span>
              </div>
              <span className={`text-xs md:text-sm font-semibold ${getScoreColor(values[pillar.key as keyof typeof values] * 10)}`}>
                {values[pillar.key as keyof typeof values]}/10
              </span>
            </div>
            <div className="relative h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${values[pillar.key as keyof typeof values] * 10}%` }}
                transition={{ duration: 0.8, delay: 0.1 * (index + 1), ease: 'easeOut' }}
                className={`absolute inset-y-0 left-0 rounded-full ${getScoreBg(values[pillar.key as keyof typeof values] * 10)}`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-700">
        <div className="flex items-center justify-center gap-3 text-[10px] text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Alta (71+)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Média (41-70)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Baixa (0-40)</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ScorePorta;