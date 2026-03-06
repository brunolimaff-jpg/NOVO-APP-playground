import React from 'react';
import { motion } from 'framer-motion';
import { ScorePortaData } from '../types';
import { getPortaCompatibility, PORTA_FLAG_META, PORTA_SEGMENT_LABELS } from '../utils/porta';
import { getPortaState } from '../services/portaStateService';

interface ScorePortaProps extends ScorePortaData {
  isDarkMode?: boolean;
}

const pillars = [
  { key: 'p', letter: 'P', label: 'Porte / massa crítica' },
  { key: 'o', letter: 'O', label: 'Operação / cadeia' },
  { key: 'r', letter: 'R', label: 'Retorno / pressão externa' },
  { key: 't', letter: 'T', label: 'Tecnologia / dor + troca' },
  { key: 'a', letter: 'A', label: 'Adoção / governança + timing' },
];

const ScorePorta: React.FC<ScorePortaProps> = ({
  score,
  p,
  o,
  r,
  t,
  a,
  segmento,
  flags,
  scoreBruto,
  isDarkMode = true,
}) => {
  const compatibility = getPortaCompatibility(score);
  const barColor = compatibility.color;
  const barBg = compatibility.background;

  const cardBg = isDarkMode ? '#0f172a' : '#ffffff';
  const pillBg = isDarkMode ? '#1e293b' : '#f1f5f9';
  const labelColor = isDarkMode ? '#94a3b8' : '#64748b';
  const valueColor = isDarkMode ? '#e2e8f0' : '#334155';
  const subColor = isDarkMode ? '#475569' : '#94a3b8';
  const badgeBg = isDarkMode ? '#111827' : '#e2e8f0';
  const subtleBg = isDarkMode ? '#0b1220' : '#f8fafc';
  const subtleBorder = isDarkMode ? 'rgba(148,163,184,0.12)' : '#e2e8f0';

  const values: Record<string, number> = { p, o, r, t, a };
  const flagsText = flags.length > 0 ? flags.join(', ') : 'NONE';
  const portaState = getPortaState();
  const baseScore = portaState?.baseScore?.score ?? null;
  const adjustmentHistory = (portaState?.feedAdjustments || []).slice(-3).reverse();
  const scoreSummary =
    typeof scoreBruto === 'number'
      ? `Score final ${score} (bruto: ${scoreBruto}${flags.length > 0 ? ` - penalizado por ${flagsText}` : ''})`
      : `Score final ${score}`;

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
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '16px' }}>🎯</span>
            <span
              title="P = Porte · O = Operação · R = Retorno · T = Tecnologia · A = Adoção"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: labelColor,
                cursor: 'help',
              }}
            >
              PORTA v2
            </span>
            <span
              title={PORTA_SEGMENT_LABELS[segmento]}
              style={{
                padding: '3px 8px',
                borderRadius: '999px',
                background: `${barColor}14`,
                color: barColor,
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.4px',
              }}
            >
              {segmento}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: subColor }}>{scoreSummary}</span>
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

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '999px',
            background: badgeBg,
            color: valueColor,
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          SEG {segmento}
        </span>
        {flags.length > 0 ? (
          flags.map((flag) => (
            <span
              key={flag}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: badgeBg,
                color: valueColor,
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {PORTA_FLAG_META[flag].icon} {PORTA_FLAG_META[flag].label}
            </span>
          ))
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '999px',
              background: badgeBg,
              color: labelColor,
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            Sem flags
          </span>
        )}
      </div>

      {(baseScore !== null || adjustmentHistory.length > 0) && (
        <div
          style={{
            marginBottom: '12px',
            padding: '10px',
            borderRadius: '10px',
            background: subtleBg,
            border: `1px solid ${subtleBorder}`,
          }}
        >
          {baseScore !== null && (
            <div style={{ fontSize: '11px', fontWeight: 700, color: labelColor, marginBottom: '6px' }}>
              Score base: {baseScore} | Score consolidado: {score}
            </div>
          )}
          {adjustmentHistory.length > 0 ? (
            adjustmentHistory.map(item => (
              <div key={`${item.source}-${item.dimension}-${item.timestamp}`} style={{ fontSize: '11px', color: valueColor }}>
                {item.source}: {item.dimension} -> {item.suggestedValue}
              </div>
            ))
          ) : (
            <div style={{ fontSize: '11px', color: labelColor }}>Nenhum ajuste incremental registrado.</div>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div
        style={{
          width: '100%',
          height: '8px',
          borderRadius: '4px',
          background: barBg,
          marginBottom: '10px',
          overflow: 'hidden',
        }}
      >
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
          {compatibility.emoji} {compatibility.label}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '12px',
          padding: '10px',
          borderRadius: '10px',
          background: subtleBg,
          border: `1px solid ${subtleBorder}`,
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: labelColor }}>
          Segmento: {PORTA_SEGMENT_LABELS[segmento]}
        </span>
        {flags.length === 0 ? (
          <span style={{ fontSize: '11px', fontWeight: 600, color: valueColor }}>Flags: NONE</span>
        ) : (
          flags.map(flag => (
            <span
              key={flag}
              title={PORTA_FLAG_META[flag].description}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '999px',
                background: pillBg,
                color: valueColor,
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              <span>{PORTA_FLAG_META[flag].icon}</span>
              <span>{PORTA_FLAG_META[flag].shortLabel}</span>
            </span>
          ))
        )}
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
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '20px',
              background: pillBg,
              fontSize: '12px',
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
