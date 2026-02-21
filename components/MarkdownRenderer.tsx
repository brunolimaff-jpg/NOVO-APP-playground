import React, { useMemo, useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid'; // Importação do motor de gráficos!
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

// ==========================================
// RENDERIZADOR DE GRÁFICOS MERMAID
// ==========================================
const MermaidGraph: React.FC<{ chart: string; isDarkMode: boolean }> = ({ chart, isDarkMode }) => {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDarkMode ? 'dark' : 'default',
      securityLevel: 'loose',
    });

    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
      } catch (error: any) {
        console.error('Erro ao renderizar Mermaid:', error);
        setSvg(`<div class="text-red-500 text-sm border border-red-500/20 p-4 rounded-lg bg-red-500/10">Falha ao gerar o gráfico de teia societária. Verifique os dados.</div>`);
      }
    };
    renderChart();
  }, [chart, isDarkMode]);

  return (
    <div 
      className="flex justify-center my-8 overflow-x-auto w-full border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
};


// ==========================================
// COMPONENTES VISUAIS (PORTA E FONTES)
// ==========================================

const PortaScoreBadge: React.FC<{ score: number; p: number; o: number; r: number; t: number; a: number; isDarkMode: boolean; }> = ({ score, p, o, r, t, a, isDarkMode }) => {
  const isAlta = score >= 71;
  const isMedia = score >= 41 && score < 71;
  const barColor = isAlta ? '#059669' : isMedia ? '#eab308' : '#ef4444';
  const barBg = isAlta ? 'rgba(5,150,105,0.15)' : isMedia ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)';
  const label = isAlta ? 'Alta Compatibilidade' : isMedia ? 'Média Compatibilidade' : 'Baixa Compatibilidade';
  const emoji = isAlta ? '🟢' : isMedia ? '🟡' : '🔴';
  
  return (
    <div className={`my-5 p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <span className="text-xs font-bold tracking-[1.5px] uppercase text-slate-500 dark:text-slate-400">PORTA</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold leading-none" style={{ color: barColor }}>{score}</span>
          <span className="text-sm font-semibold text-slate-400">/100</span>
        </div>
      </div>
      <div className="w-full h-2 rounded-full mb-3 overflow-hidden" style={{ background: barBg }}>
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(score, 100)}%`, background: barColor }} />
      </div>
      <div className="mb-4">
        <span className="text-[13px] font-bold" style={{ color: barColor }}>{emoji} {label}</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {[ { l: 'P', v: p }, { l: 'O', v: o }, { l: 'R', v: r }, { l: 'T', v: t }, { l: 'A', v: a } ].map(({ l, v }) => (
          <div key={l} className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} text-xs`}>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-500">{l}</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CollapsibleSources: React.FC<{ sources: FootnoteSource[]; isDarkMode: boolean }> = ({ sources, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold transition-colors ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
      >
        <span className="text-sm">📚</span> Fontes Verificadas ({sources.length})
        <span className={`transform transition-transform text-[10px] ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className={`mt-3 p-4 rounded-xl border flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          {sources.map((s) => (
            <div key={s.num} className="flex items-start gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold mt-0.5">
                {s.num}
              </span>
              <div className="flex-1 min-w-0">
                {s.url && !isFakeUrl(s.url) ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm hover:underline break-words">
                    {s.title}
                  </a>
                ) : (
                  <span className="text-slate-600 dark:text-slate-300 font-semibold text-sm break-words">{s.title}</span>
                )}
                {s.url && !isFakeUrl(s.url) && (
                  <div className="text-slate-400 dark:text-slate-500 text-[10px] mt-0.5 truncate">{s.url}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// ==========================================
// RENDERIZADOR PRINCIPAL
// ==========================================

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isDarkMode, groundingSources, showCollapsibleSources = true }) => {
  
  // Extrai as fontes de forma segura, sem destruir o texto!
  const { processedContent, urlToNumMap, footnoteSources } = useMemo(() => {
    let text = cleanStatusMarkers(content.replace(/\[\[STATUS:.*?\]\]\n?/g, '')).cleanText;
    text = fixFakeLinks(text);
    text = rewriteMarkdownLinksToGoogle(text);
    text = autoLinkSeniorTerms(text);

    // Converte a tag do PORTA para HTML
    text = text.replace(
      /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+)\]\]/g,
      '<porta-score data-score="$1" data-p="$2" data-o="$3" data-r="$4" data-t="$5" data-a="$6"></porta-score>'
    );

    // Mapeia os URLs para criar a lista de fontes, mas NÃO apaga o texto
    const map = new Map<string, number>();
    const sources: FootnoteSource[] = [];
    let counter = 0;

    const getNum = (url: string, title: string) => {
      if (!url || isFakeUrl(url)) return null;
      let num = map.get(url);
      if (!num) {
        counter++;
        num = counter;
        map.set(url, num);
        sources.push({ num, title, url });
      }
      return num;
    };

    // Alimenta o mapa com as fontes do Grounding (Google Search)
    if (groundingSources) {
      groundingSources.forEach(gs => getNum(gs.url, gs.title));
    }

    return { processedContent: text, urlToNumMap: map, footnoteSources: sources };
  }, [content, groundingSources]);

  const theme = {
    textNormal: isDarkMode ? 'text-slate-300' : 'text-slate-700',
    textBold: isDarkMode ? 'text-white' : 'text-slate-900',
    h1: isDarkMode ? 'text-white' : 'text-slate-900',
    h2: isDarkMode ? 'text-emerald-500' : 'text-emerald-600',
    h3: isDarkMode ? 'text-emerald-400' : 'text-emerald-600',
    hr: isDarkMode ? 'border-slate-700' : 'border-slate-200',
  };

  return (
    <div className={`markdown-body ${theme.textNormal} w-full max-w-full text-[15px] md:text-base`} style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // @ts-ignore
          'porta-score': (props: any) => {
            return <PortaScoreBadge 
              score={parseInt(props['data-score']||'0')} p={parseInt(props['data-p']||'0')} 
              o={parseInt(props['data-o']||'0')} r={parseInt(props['data-r']||'0')} 
              t={parseInt(props['data-t']||'0')} a={parseInt(props['data-a']||'0')} 
              isDarkMode={isDarkMode} 
            />;
          },

          // INTERCEPTADOR DE LINKS (Corrige o problema do texto sendo engolido)
          a: ({ href, children, ...props }) => {
            if (!href || isFakeUrl(href)) {
              return <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{children}</strong>;
            }
            
            // Puxa o número da fonte
            const num = urlToNumMap.get(href);
            
            return (
              <span className="inline-flex items-baseline gap-1">
                <a 
                  href={href} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-emerald-600 dark:text-emerald-400 font-semibold hover:text-emerald-500 underline decoration-emerald-500/30 underline-offset-4 transition-colors break-words" 
                  {...props}
                >
                  {children}
                </a>
                {num && (
                  <sup className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-extrabold cursor-pointer hover:scale-110 transition-transform select-none -translate-y-2">
                    {num}
                  </sup>
                )}
              </span>
            );
          },

          // INTERCEPTADOR DE GRÁFICOS (Renderiza a Teia do Mermaid)
          code(props) {
            const {children, className, node, ...rest} = props;
            const match = /language-(\w+)/.exec(className || '');
            
            if (match && match[1] === 'mermaid') {
              return <MermaidGraph chart={String(children).replace(/\n$/, '')} isDarkMode={isDarkMode} />;
            }
            
            return match ? (
              <pre className="block p-5 rounded-xl my-4 text-sm bg-slate-900 text-emerald-300 overflow-x-auto shadow-inner border border-slate-800">
                <code className={className} {...rest}>{children}</code>
              </pre>
            ) : (
              <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[0.9em] text-emerald-600 dark:text-emerald-400" {...rest}>
                {children}
              </code>
            );
          },

          // TABELAS COM VISUAL PREMIUM
          table: ({...props}) => (
            <div className={`overflow-x-auto my-6 border rounded-xl shadow-sm ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
              <table className="min-w-full text-sm text-left border-collapse" {...props} />
            </div>
          ),
          thead: ({...props}) => <thead className={`border-b ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'}`} {...props} />,
          th: ({...props}) => <th className={`px-5 py-3.5 font-bold uppercase tracking-wider text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} {...props} />,
          td: ({...props}) => <td className={`px-5 py-3.5 border-b align-middle font-medium ${isDarkMode ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-700'}`} {...props} />,
          tr: ({...props}) => <tr className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'}`} {...props} />,

          // TIPOGRAFIA BASE
          h1: ({...props}) => <h1 className={`text-xl md:text-2xl font-black ${theme.h1} mt-8 mb-4 tracking-tight`} {...props} />,
          h2: ({...props}) => <h2 className={`text-lg md:text-xl font-bold ${theme.h2} mt-8 mb-4 border-b border-emerald-500/20 pb-2`} {...props} />,
          h3: ({...props}) => <h3 className={`text-base md:text-lg font-bold ${theme.h3} mt-6 mb-3`} {...props} />,
          p: ({...props}) => <p className="mb-4 leading-relaxed" {...props} />,
          ul: ({...props}) => <ul className="list-disc pl-6 mb-4 space-y-1.5" {...props} />,
          ol: ({...props}) => <ol className="list-decimal pl-6 mb-4 space-y-1.5" {...props} />,
          li: ({...props}) => <li className="pl-1" {...props} />,
          hr: ({...props}) => <hr className={`${theme.hr} my-8 border-t-2`} {...props} />,
          strong: ({...props}) => <strong className={`${theme.textBold} font-extrabold`} {...props} />,
          blockquote: ({...props}) => <blockquote className="border-l-4 border-emerald-500 pl-4 py-1 my-4 bg-emerald-50 dark:bg-emerald-900/20 text-slate-700 dark:text-slate-300 italic rounded-r-lg" {...props} />,
        }}
      >
        {processedContent}
      </Markdown>

      {showCollapsibleSources && <CollapsibleSources sources={footnoteSources} isDarkMode={isDarkMode} />}
    </div>
  );
};

export default MarkdownRenderer;
