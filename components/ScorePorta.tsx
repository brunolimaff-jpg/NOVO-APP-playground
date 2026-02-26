import React from 'react';
import { motion } from 'framer-motion';
import { ScorePortaData } from '../types';

interface ScorePortaProps extends ScorePortaData {
  isDarkMode?: boolean;
}

const pillars = [
  { key: 'p', letter: 'P', label: 'Porte Financeiro' },
  { key: 'o', letter: 'O', label: 'Operação (escala)' },
  { key: 'r', letter: 'R', label: 'Retorno esperado' },
  { key: 't', letter: 'T', label: 'Tecnologia (maturidade)' },
  { key: 'a', letter: 'A', label: 'Adoção / Cultura' },
];

const ScorePorta: React.FC<ScorePortaProps> = ({ score, p, o, r, t, a, isDarkMode = true }) => {
  const isAlta  = score >= 71;
  const isMedia = score >= 41 && score < 71;

  const barColor = isAlta ? '#059669' : isMedia ? '#eab308' : '#ef4444';
  const barBg    = isAlta ? 'rgba(5,150,105,0.15)' : isMedia ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)';
  const label    = isAlta ? 'Alta Compatibilidade'  : isMedia ? 'Média Compatibilidade'  : 'Baixa Compatibilidade';
  const emoji    = isAlta ? '🟢' : isMedia ? '🟡' : '🔴';

  const cardBg      = isDarkMode ? '#0f172a' : '#ffffff';
  const pillBg      = isDarkMode ? '#1e293b' : '#f1f5f9';
  const labelColor  = isDarkMode ? '#94a3b8' : '#64748b';
  const valueColor  = isDarkMode ? '#e2e8f0' : '#334155';
  const subColor    = isDarkMode ? '#475569' : '#94a3b8';

  const values: Record<string, number> = { p, o, r, t, a };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        margin: '0 0 16px',
        padding: '16px 20px',
        borderRadius: '12px',
        border: `1.5px solid ${barColor}40`,
        background: cardBg,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🎯</span>
          <span
            title="P = Porte · O = Operação · R = Retorno · T = Tecnologia · A = Adoção"
            style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: labelColor, cursor: 'help' }}
          >
            PORTA
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ fontSize: '28px', fontWeight: 800, color: barColor, lineHeight: 1 }}
          >
            {score}
          </motion.span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: subColor }}>/100</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: barBg, marginBottom: '10px', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: '4px', background: barColor }}
        />
      </div>

      {/* Compatibility label */}
      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: barColor }}>
          {emoji} {label}
        </span>
      </div>

      {/* Pillar pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {pillars.map(({ key, letter, label }, idx) => (
          <motion.div
            key={key}
            title={`${label}: ${values[key]}/10`}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08 * (idx + 1), type: 'spring', stiffness: 300 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 10px', borderRadius: '20px',
              background: pillBg, fontSize: '12px',
              cursor: 'default',
            }}
          >
            <span style={{ fontWeight: 700, color: barColor, fontSize: '11px' }}>{letter}</span>
            <span style={{ fontWeight: 600, color: valueColor }}>{values[key]}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default ScorePorta;
