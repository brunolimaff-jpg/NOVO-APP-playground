import React from 'react';

interface NewsBadgeProps {
  count: number;
  dominant: 'positive' | 'negative' | 'neutral';
}

const NewsBadge: React.FC<NewsBadgeProps> = ({ count, dominant }) => {
  if (count === 0) return null;

  const bgColor = dominant === 'negative'
    ? 'bg-red-500/15 text-red-600 dark:text-red-400'
    : dominant === 'positive'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      : 'bg-slate-500/15 text-slate-600 dark:text-slate-400';

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${bgColor}`}>
      📰 {count}
    </span>
  );
};

export default NewsBadge;
