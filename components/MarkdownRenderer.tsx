import React, { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { autoLinkSeniorTerms } from '../utils/seniorLinks';
import { rewriteMarkdownLinksToGoogle } from '../utils/markdownLinks';
import { cleanStatusMarkers } from '../utils/textCleaners';
import { fixFakeLinks, extractAllSourceMentions } from '../utils/linkFixer';
import { isFakeUrl } from '../services/apiConfig';

interface MarkdownRendererProps {
  content: string;
  isDarkMode: boolean;
  groundingSources?: Array<{ title: string; url: string }>;
}

// --- Footnote Tooltip ---
interface FootnoteTooltipProps {
  number: string;
  sources: Array<{ title: string; url: string }>;
  isDarkMode: boolean;
}

const FootnoteTooltip: React.FC<FootnoteTooltipProps> = ({ number, sources }) => {
  const numIndex = parseInt(number, 10);
  const sourceIndex = isNaN(numIndex) ? -1 : numIndex - 1;
  const source = sources && sources[sourceIndex];

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    color: '#fff',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    fontSize: '10px',
    fontWeight: 600,
    textDecoration: 'none',
    verticalAlign: 'super',
    marginLeft: '2px',
    lineHeight: 1,
    cursor: 'pointer'
  };

  if (!source) {
    return <span style={{ ...badgeStyle, backgroundColor: '#9ca3af' }}>{number}</span>;
  }

  const isFake = !source.url || isFakeUrl(source.url);
  const title = source.title || `Fonte ${number}`;

  if (!isFake) {
    return (
      <a href={source.url} target="_blank" rel="noopener noreferrer" title={title} style={badgeStyle}>
        {number}
      </a>
    );
  }

  return <span title={title} style={badgeStyle}>{number}</span>;
};

// --- PORTA Score ---
interface PortaScoreProps {
  score: number;
  p: number;
  o: number;
  r: number;
  t: number;
  a: number;
  isDarkMode: boolean;
}

const PortaScoreBadge: React.FC<PortaScoreProps> = ({ score, p, o, r, t, a, isDarkMode }) => {
  const isAlta = score >= 71;
  const isMedia = score >= 41 && score < 71;
  
  const barColor = isAlta ? '#059669' : isMedia ? '#eab308' : '#ef4444';
  const barBg = isAlta ? 'rgba(5,150,105,0.15)' : isMedia ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)';
  const label = isAlta ? 'Alta Compatibilidade' : isMedia ? 'Média Compatibilidade' : 'Baixa Compatibilidade';
  const emoji = isAlta ? '🟢' : isMedia ? '🟡' : '🔴';

  const pillars = [
    { letter: 'P', value: p },
    { letter: 'O', value: o },
    { letter: 'R', value: r },
    { letter: 'T', value: t },
    { letter: 'A', value: a },
  ];

  return (
    <div style={{
      margin: '20px 0 12px',
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1.5px solid ${barColor}40`,
      background: isDarkMode ? '#0f172a' : '#ffffff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🎯</span>
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            PORTA
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '28px', fontWeight: 800, color: barColor, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#475569' : '#94a3b8' }}>/100</span>
        </div>
      </div>

      <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: barBg, marginBottom: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', borderRadius: '4px', background: barColor }} />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: barColor }}>{emoji} {label}</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {pillars.map(({ letter, value }) => (
          <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', background: isDarkMode ? '#1e293b' : '#f1f5f9', fontSize: '12px' }}>
            <span style={{ fontWeight: 700, color: '#059669', fontSize: '11px' }}>{letter}</span>
            <span style={{ fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#334155' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Seção de Fontes ---
interface SourcesSectionProps {
  sources: Array<{ title: string; url?: string }>;
  isDarkMode: boolean;
}

const SourcesSection: React.FC<SourcesSectionProps> = ({ sources, isDarkMode }) => {
  if (!sources || sources.length === 0) return null;

  // Agrupar fontes por tipo
  const sourcesWithUrl = sources.filter(s => s.url && !isFakeUrl(s.url));
  const sourcesWithoutUrl = sources.filter(s => !s.url || isFakeUrl(s.url));

  return (
    <div style={{
      marginTop: '20px',
      padding: '16px',
      borderRadius: '12px',
      border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
      background: isDarkMode ? '#1e293b' : '#f8fafc',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📚</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
            Fontes e Referências
          </span>
        </div>
        <span style={{
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '12px',
          background: '#05966920',
          color: '#059669',
          fontWeight: 600,
        }}>
          {sources.length} {sources.length === 1 ? 'fonte' : 'fontes'}
        </span>
      </div>

      {/* Fontes com link */}
      {sourcesWithUrl.length > 0 && (
        <div style={{ marginBottom: sourcesWithoutUrl.length > 0 ? '16px' : 0 }}>
          <div style={{ fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: '8px', fontWeight: 600 }}>
            🔗 Links disponíveis
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sourcesWithUrl.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: isDarkMode ? '#0f172a' : '#ffffff',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{
                  minWidth: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#059669',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#059669', fontWeight: 500, fontSize: '13px', wordBreak: 'break-word' }}>
                    {s.title}
                  </div>
                  <div style={{ color: isDarkMode ? '#64748b' : '#94a3b8', fontSize: '10px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.url}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Fontes sem link */}
      {sourcesWithoutUrl.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: '8px', fontWeight: 600 }}>
            📖 Mencionadas
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {sourcesWithoutUrl.map((s, i) => (
              <span
                key={i}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: isDarkMode ? '#334155' : '#e2e8f0',
                  color: isDarkMode ? '#cbd5e1' : '#475569',
                  fontSize: '12px',
                }}
              >
                {s.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Pré-processamento ---
function preprocessFootnotes(text: string): string {
  return text
    .replace(/\[\^(\d+)\]/g, '<footnote data-num="$1"></footnote>')
    .replace(/(?<!\[)\[(\d+)\](?!\()/g, '<footnote data-num="$1"></footnote>')
    .replace(/(?<!\[)\^(\d+)/g, '<footnote data-num="$1"></footnote>');
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isDarkMode, groundingSources }) => {
  const theme = {
    textNormal: isDarkMode ? 'text-slate-300' : 'text-slate-700',
    textBold: isDarkMode ? 'text-white' : 'text-slate-900',
    h1: isDarkMode ? 'text-white' : 'text-slate-900',
    h2: isDarkMode ? 'text-emerald-500' : 'text-emerald-600',
    h3: isDarkMode ? 'text-emerald-400' : 'text-emerald-600',
    hr: isDarkMode ? 'border-slate-700' : 'border-slate-200',
  };

  const processedContent = useMemo(() => {
    // 0. Remove marcadores de status
    const cleaned = content.replace(/\[\[STATUS:.*?\]\]\n?/g, '');
    let text = cleanStatusMarkers(cleaned).cleanText;
    
    // 1. Fix fake links (MANTÉM links válidos!)
    text = fixFakeLinks(text);

    // 2. Fix double dashes
    text = text.replace(/^--+$/gm, `<hr class="${theme.hr} my-8" />`);

    // 3. Rewrite links (mapeia Senior links)
    text = rewriteMarkdownLinksToGoogle(text);
    
    // 4. Auto-link Senior terms
    text = autoLinkSeniorTerms(text);

    // 5. Fix bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 6. PORTA score
    text = text.replace(
      /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+)\]\]/g,
      '<porta-score data-score="$1" data-p="$2" data-o="$3" data-r="$4" data-t="$5" data-a="$6"></porta-score>'
    );

    // 7. Footnotes
    text = preprocessFootnotes(text);

    return text;
  }, [content, theme.hr]);

  // Extrair todas as fontes para exibição
  const allSources = useMemo(() => {
    const extracted = extractAllSourceMentions(content);
    const grounding = groundingSources || [];
    
    // Combinar e remover duplicatas
    const combined = [...grounding];
    extracted.forEach(s => {
      if (!combined.find(c => c.title === s.title && c.url === s.url)) {
        combined.push(s);
      }
    });
    
    return combined;
  }, [content, groundingSources]);

  return (
    <div className={`markdown-body ${theme.textNormal} w-full max-w-full overflow-visible text-base md:text-lg`}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]} 
        rehypePlugins={[rehypeRaw]} 
        components={{
          // @ts-ignore
          'porta-score': (props: any) => {
            const score = parseInt(props['data-score'] || '0', 10);
            const p = parseInt(props['data-p'] || '0', 10);
            const o = parseInt(props['data-o'] || '0', 10);
            const r = parseInt(props['data-r'] || '0', 10);
            const t = parseInt(props['data-t'] || '0', 10);
            const a = parseInt(props['data-a'] || '0', 10);
            return <PortaScoreBadge score={score} p={p} o={o} r={r} t={t} a={a} isDarkMode={isDarkMode} />;
          },
          // @ts-ignore
          'footnote': (props: any) => {
            const num = props['data-num'] || '?';
            return <FootnoteTooltip number={num} sources={groundingSources || []} isDarkMode={isDarkMode} />;
          },

          h1: ({...props}) => <h1 className={`text-2xl font-bold ${theme.h1} mt-10 mb-6`} {...props} />,
          h2: ({...props}) => <h2 className={`text-xl font-bold ${theme.h2} mt-8 mb-4 border-b border-emerald-500/20 pb-2`} {...props} />,
          h3: ({...props}) => <h3 className={`text-lg font-bold ${theme.h3} mt-6 mb-3`} {...props} />,
          p: ({...props}) => <p className="mb-4 leading-relaxed" {...props} />,
          ul: ({...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
          ol: ({...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
          li: ({...props}) => <li className="pl-1" {...props} />,
          hr: ({...props}) => <hr className={`${theme.hr} my-6`} {...props} />,
          
          // Links clicáveis
          a: ({href, children, ...props}) => {
            if (!href || isFakeUrl(href)) {
              return <strong className="text-emerald-500 font-semibold">{children}</strong>;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-400 hover:underline font-medium" {...props}>
                {children}
              </a>
            );
          },
          
          strong: ({...props}) => <strong className={`${theme.textBold} font-bold`} {...props} />,
          
          code: ({...props}) => {
            const isBlock = String(props.children).includes('\n');
            if (isBlock) {
              return <pre className="block p-4 rounded-lg my-4 text-sm bg-slate-800 text-emerald-300"><code {...props} /></pre>;
            }
            return <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm text-emerald-600 dark:text-emerald-300" {...props} />;
          },
          
          table: ({...props}) => (
            <div className="overflow-x-auto mb-4 border rounded-lg">
              <table className="min-w-full text-sm" {...props} />
            </div>
          ),
          th: ({...props}) => <th className="px-4 py-2 bg-slate-100 dark:bg-slate-800 font-semibold text-left" {...props} />,
          td: ({...props}) => <td className="px-4 py-2 border-t" {...props} />,
        }}
      >
        {processedContent}
      </Markdown>
      
      {/* NOVO: Seção de fontes no final */}
      {allSources.length > 0 && (
        <SourcesSection sources={allSources} isDarkMode={isDarkMode} />
      )}
    </div>
  );
};

export default MarkdownRenderer;
