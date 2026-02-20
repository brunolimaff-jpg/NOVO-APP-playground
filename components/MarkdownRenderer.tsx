import React, { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { autoLinkSeniorTerms } from '../utils/seniorLinks';
import { rewriteMarkdownLinksToGoogle } from '../utils/markdownLinks';
import { cleanStatusMarkers } from '../utils/textCleaners';
import { fixFakeLinks } from '../utils/linkFixer';
import { isFakeUrl } from '../services/apiConfig';

interface MarkdownRendererProps {
  content: string;
  isDarkMode: boolean;
  groundingSources?: Array<{ title: string; url: string }>;
  showCollapsibleSources?: boolean;
}

interface FootnoteSource {
  num: number;
  title: string;
  url: string;
}

// --- Superscript footnote badge ---
const FootnoteBadge: React.FC<{ num: number }> = ({ num }) => (
  <sup style={{
    color: '#059669',
    fontSize: '0.7em',
    fontWeight: 700,
    cursor: 'pointer',
    marginLeft: '1px',
    verticalAlign: 'super',
    lineHeight: 1,
  }}>
    [{num}]
  </sup>
);

// --- PORTA Score ---
const PortaScoreBadge: React.FC<{
  score: number; p: number; o: number; r: number; t: number; a: number; isDarkMode: boolean;
}> = ({ score, p, o, r, t, a, isDarkMode }) => {
  const isAlta = score >= 71;
  const isMedia = score >= 41 && score < 71;
  const barColor = isAlta ? '#059669' : isMedia ? '#eab308' : '#ef4444';
  const barBg = isAlta ? 'rgba(5,150,105,0.15)' : isMedia ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)';
  const label = isAlta ? 'Alta Compatibilidade' : isMedia ? 'Média Compatibilidade' : 'Baixa Compatibilidade';
  const emoji = isAlta ? '🟢' : isMedia ? '🟡' : '🔴';
  const pillars = [
    { letter: 'P', value: p }, { letter: 'O', value: o },
    { letter: 'R', value: r }, { letter: 'T', value: t }, { letter: 'A', value: a },
  ];

  return (
    <div style={{ margin: '20px 0 12px', padding: '16px 20px', borderRadius: '12px', border: `1.5px solid ${barColor}40`, background: isDarkMode ? '#0f172a' : '#ffffff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🎯</span>
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: isDarkMode ? '#94a3b8' : '#64748b' }}>PORTA</span>
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

// --- Collapsible Fontes ---
const CollapsibleSources: React.FC<{ sources: FootnoteSource[]; isDarkMode: boolean }> = ({ sources, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div style={{ marginTop: '16px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', borderRadius: '20px',
          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
          background: isDarkMode ? '#1e293b' : '#f8fafc',
          color: isDarkMode ? '#94a3b8' : '#64748b',
          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '14px' }}>📚</span>
        <span>Fontes ({sources.length})</span>
        <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '10px' }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          marginTop: '10px', padding: '12px 16px', borderRadius: '12px',
          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
          background: isDarkMode ? '#0f172a' : '#ffffff',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          {sources.map((s) => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{
                flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%',
                background: '#059669', color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '10px', fontWeight: 700, marginTop: '1px',
              }}>{s.num}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {s.url && !isFakeUrl(s.url) ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#059669', fontWeight: 500, fontSize: '13px', textDecoration: 'none', wordBreak: 'break-word' }}>
                    {s.title}
                  </a>
                ) : (
                  <span style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontWeight: 500, fontSize: '13px', wordBreak: 'break-word' }}>{s.title}</span>
                )}
                {s.url && !isFakeUrl(s.url) && (
                  <div style={{ color: isDarkMode ? '#475569' : '#94a3b8', fontSize: '10px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Convert inline [text](url) to text + footnote ^N ---
function convertLinksToFootnotes(text: string, groundingSources: Array<{ title: string; url: string }>): {
  processedText: string;
  footnoteSources: FootnoteSource[];
} {
  const footnoteSources: FootnoteSource[] = [];
  const urlToNum = new Map<string, number>();
  let counter = 0;

  function getOrCreateNum(url: string, title: string): number {
    let num = urlToNum.get(url);
    if (!num) {
      counter++;
      num = counter;
      urlToNum.set(url, num);
      footnoteSources.push({ num, title, url });
    }
    return num;
  }

  // Add grounding sources primeiro
  for (const gs of groundingSources) {
    if (gs.url && !isFakeUrl(gs.url) && !urlToNum.has(gs.url)) {
      getOrCreateNum(gs.url, gs.title);
    }
  }

  // 1. Substitui links markdown: [texto](url)
  let processed = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi,
    (_match, linkText: string, url: string) => {
      if (isFakeUrl(url)) return `**${linkText}**`;
      const num = getOrCreateNum(url, linkText);
      return `${linkText}<footnote data-num="${num}"></footnote>`;
    }
  );

  // 2. URLs "cruas" entre parênteses: (https://url.com) ou texto(https://url.com)
  processed = processed.replace(
    /\(?(https?:\/\/[^\s)<>"]+)\)?/gi,
    (match, url: string) => {
      if (isFakeUrl(url)) return '';
      try {
        const domain = new URL(url).hostname.replace('www.', '');
        const label = domain || url;
        const num = getOrCreateNum(url, label);
        // Exibe domínio + badge de fonte, em vez de só o ^1 solto
        return `${label}<footnote data-num="${num}"></footnote>`;
      } catch {
        return match;
      }
    }
  );

  // 3. Limpa sobras de colchetes/parênteses vazios
  processed = processed
    .replace(/\[\s*\]/g, '')           // [] vazios
    .replace(/\(\s*\)/g, '')           // () vazios
    .replace(/\]\s*\./g, '.')          // ]. perdido
    .replace(/\]\s*,/g, ',')           // ], perdido
    .replace(/\]\s*$/gm, '');          // ] no fim da linha

  return { processedText: processed, footnoteSources };
}

// Remove "Fontes:" blocks from text (we show them in CollapsibleSources)
function removeSourcesBlock(text: string): string {
  return text
    .replace(/\n+#{1,3}\s*(?:Fontes?|Referências?|Sources?|Refs?)\s*\n([\s\S]*?)(?=\n#{1,3}\s|$)/gi, '\n')
    .replace(/\n+\*?\*?(?:Fontes?|Referências?|Sources?|Refs?)\*?\*?:?\s*\n([\s\S]*?)(?=\n#{1,3}\s|\n\*\*[A-Z]|$)/gi, '\n');
}

// Convert existing ^1, [^1], [1] to footnote tags
function preprocessExistingFootnotes(text: string): string {
  return text
    .replace(/\[\^(\d+)\]/g, '<footnote data-num="$1"></footnote>')
    .replace(/(?<!\[)\[(\d+)\](?!\()/g, '<footnote data-num="$1"></footnote>')
    .replace(/(?<!\[)\^(\d+)/g, '<footnote data-num="$1"></footnote>');
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isDarkMode, groundingSources, showCollapsibleSources = true }) => {
  const theme = {
    textNormal: isDarkMode ? 'text-slate-300' : 'text-slate-700',
    textBold: isDarkMode ? 'text-white' : 'text-slate-900',
    h1: isDarkMode ? 'text-white' : 'text-slate-900',
    h2: isDarkMode ? 'text-emerald-500' : 'text-emerald-600',
    h3: isDarkMode ? 'text-emerald-400' : 'text-emerald-600',
    hr: isDarkMode ? 'border-slate-700' : 'border-slate-200',
  };

  const { processedContent, footnoteSources } = useMemo(() => {
    const cleaned = content.replace(/\[\[STATUS:.*?\]\]\n?/g, '');
    let text = cleanStatusMarkers(cleaned).cleanText;
    text = fixFakeLinks(text);
    text = text.replace(/\s*\*?\[fonte não disponível\]\*?/gi, '');
    text = removeSourcesBlock(text);
    text = text.replace(/^--+$/gm, `<hr class="${theme.hr} my-8" />`);
    text = rewriteMarkdownLinksToGoogle(text);
    text = autoLinkSeniorTerms(text);

    const { processedText, footnoteSources: sources } = convertLinksToFootnotes(text, groundingSources || []);
    text = processedText;

    text = text.replace(
      /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+)\]\]/g,
      '<porta-score data-score="$1" data-p="$2" data-o="$3" data-r="$4" data-t="$5" data-a="$6"></porta-score>'
    );
    text = preprocessExistingFootnotes(text);

    return { processedContent: text, footnoteSources: sources };
  }, [content, groundingSources, theme.hr]);

  return (
    <div
      className={`markdown-body ${theme.textNormal} w-full max-w-full text-[15px] md:text-base`}
      style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // @ts-ignore
          'porta-score': (props: any) => {
            const score = parseInt(props['data-score'] || '0', 10);
            const pVal = parseInt(props['data-p'] || '0', 10);
            const oVal = parseInt(props['data-o'] || '0', 10);
            const rVal = parseInt(props['data-r'] || '0', 10);
            const tVal = parseInt(props['data-t'] || '0', 10);
            const aVal = parseInt(props['data-a'] || '0', 10);
            return <PortaScoreBadge score={score} p={pVal} o={oVal} r={rVal} t={tVal} a={aVal} isDarkMode={isDarkMode} />;
          },
          // @ts-ignore
          // FIX: footnote badges agora viram hyperlinks clicáveis quando URL está disponível
          'footnote': (props: any) => {
            const num = parseInt(props['data-num'] || '0', 10);
            const source = footnoteSources.find(s => s.num === num);
            if (source && source.url && !isFakeUrl(source.url)) {
              return (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                  title={source.title}
                >
                  <FootnoteBadge num={num} />
                </a>
              );
            }
            return <FootnoteBadge num={num} />;
          },

          h1: ({...props}) => <h1 className={`text-xl md:text-2xl font-bold ${theme.h1} mt-8 mb-4`} {...props} />,
          h2: ({...props}) => <h2 className={`text-lg md:text-xl font-bold ${theme.h2} mt-6 mb-3 border-b border-emerald-500/20 pb-2`} {...props} />,
          h3: ({...props}) => <h3 className={`text-base md:text-lg font-bold ${theme.h3} mt-5 mb-2`} {...props} />,
          p: ({...props}) => <p className="mb-3 leading-relaxed" {...props} />,
          ul: ({...props}) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
          ol: ({...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
          li: ({...props}) => <li className="pl-1" {...props} />,
          hr: ({...props}) => <hr className={`${theme.hr} my-5`} {...props} />,

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
              return <pre className="block p-4 rounded-lg my-4 text-sm bg-slate-800 text-emerald-300 overflow-x-auto"><code {...props} /></pre>;
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

      {showCollapsibleSources && <CollapsibleSources sources={footnoteSources} isDarkMode={isDarkMode} />}
    </div>
  );
};

export default MarkdownRenderer;
