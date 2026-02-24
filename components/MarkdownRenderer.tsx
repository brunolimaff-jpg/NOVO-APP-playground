import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import { GroundingSource } from '../types';
import {
  fixFakeLinks,
  rewriteMarkdownLinksToGoogle,
  autoLinkSeniorTerms,
  cleanFakeSourcesBlock,
} from '../utils/linkFixer';

interface MarkdownRendererProps {
  content: string;
  isDarkMode?: boolean;
  groundingSources?: GroundingSource[];
  showCollapsibleSources?: boolean;
}

interface MermaidProps {
  chart: string;
  isDarkMode?: boolean;
}

// ---------------------------------------------------------------------------
// MermaidChart
// ---------------------------------------------------------------------------
const MermaidChart: React.FC<MermaidProps> = ({ chart, isDarkMode }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!chart?.trim()) return;
    let cancelled = false;

    const initMermaid = async () => {
      try {
        const clean = sanitizeMermaidCode(chart);
        if (!clean) return;

        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkMode ? 'dark' : 'default',
          securityLevel: 'loose',
        });

        const id = 'mermaid-' + Math.random().toString(36).substring(2, 9);
        const { svg: rendered } = await mermaid.render(id, clean);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Erro Mermaid:', err);
          setError(err?.str || err?.message || 'Falha ao renderizar diagrama');
        }
      }
    };

    initMermaid();
    return () => { cancelled = true; };
  }, [chart, isDarkMode]);

  if (error) {
    return (
      <div className="mt-2 mb-4 rounded-xl border border-amber-300 bg-amber-50/80 dark:bg-amber-950/40 dark:border-amber-700 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <p className="font-semibold">Não foi possível renderizar o diagrama.</p>
          </div>
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="text-[10px] font-semibold underline underline-offset-2 shrink-0"
          >
            {showDetails ? 'Ocultar' : 'Ver erro'}
          </button>
        </div>
        {showDetails && (
          <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-black/5 dark:bg-black/40 p-2 text-[10px] leading-snug whitespace-pre-wrap">
            {error}
          </pre>
        )}
      </div>
    );
  }

  if (!svg) return null;

  return (
    <div
      className="mermaid-chart my-3 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

// ---------------------------------------------------------------------------
// sanitizeMermaidCode
// ---------------------------------------------------------------------------
function sanitizeMermaidCode(input: string): string {
  if (!input) return '';

  let code = input
    .replace(/<br\s*\/?>\s*/gi, '\n')
    .replace(/&lt;br\s*\/?&gt;\s*/gi, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u2600-\u27BF]/gu, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/^[^a-zA-Z0-9]+/, '')
    .trim();

  // Corrigir subgraph labels com espaços ou parênteses (Mermaid 10 exige aspas)
  code = code.replace(
    /^(\s*subgraph\s+)([^"'\n\[\]{]+?)(\s*)$/gm,
    (full, prefix, label, suffix) => {
      const t = label.trim();
      if (!t || !/[\s()\[\]\/\\%:]/.test(t)) return full;
      return prefix + '"' + t.replace(/"/g, "'") + '"' + suffix;
    }
  );

  const mermaidStart =
    /(graph\s+(?:TB|TD|LR|RL|BT)?|flowchart\s+(?:TB|TD|LR|RL|BT)?|sequenceDiagram|gantt|classDiagram|stateDiagram-v2?|erDiagram|journey|pie|quadrantChart|gitGraph)/i;
  const match = code.match(mermaidStart);
  if (!match) return '';

  code = code.slice(match.index ?? 0).trim();

  const firstWord = code.split(/\s+/)[0].toLowerCase();
  if (
    !/^(graph|flowchart|sequencediagram|gantt|classdiagram|statediagram-v2?|erdiagram|journey|pie|quadrantchart|gitgraph)$/.test(
      firstWord
    )
  ) {
    return '';
  }

  return code;
}

// ---------------------------------------------------------------------------
// MarkdownRenderer
// ---------------------------------------------------------------------------
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  isDarkMode = false,
  groundingSources = [],
  showCollapsibleSources = false,
}) => {
  const processedContent = useMemo(() => {
    if (!content) return '';

    let text = content;

    // 1) Converter {"mermaid":"..."} → bloco mermaid
    const FENCE = '`'.repeat(3);
    text = text.replace(/\{"mermaid":"([\s\S]*?)"\}/g, (_m, raw: string) => {
      const unescaped = raw.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      return '\n' + FENCE + 'mermaid\n' + unescaped + '\n' + FENCE + '\n';
    });

    // 2) Corrigir links falsos e limpar fontes no final
    text = fixFakeLinks(text);
    text = rewriteMarkdownLinksToGoogle(text);
    text = autoLinkSeniorTerms(text);
    text = cleanFakeSourcesBlock(text);

    // 3) Badges de confirmação/evidência — padrão ampliado:
    //    [🟢/🟡/🟠/🔴 TIPO - Label]  ou  [🟢/🟡/🟠/🔴 TIPO]
    //    Tipos suportados: CONFIRMADO OFICIAL, CONFIRMADO, EVIDÊNCIA FORTE,
    //                      EVIDENCIA FORTE, NÃO CONFIRMADO, NAO CONFIRMADO, SUSPEITO
    text = text.replace(
      /\[(🟢|🟡|🟠|🔴)\s+(CONFIRMADO\s*OFICIAL|CONFIRMADO|EVIDÊNCIA\s*FORTE|EVIDENCIA\s*FORTE|NÃO\s*CONFIRMADO|NAO\s*CONFIRMADO|SUSPEITO)(?:\s*[-–]\s*([^\]\n]+))?\]/gi,
      (_, level, kind, label) =>
        `<verified data-level="${level}" data-kind="${kind.trim().toUpperCase()}" data-label="${(label || '').trim()}"></verified>`
    );

    return text;
  }, [content]);

  // -------------------------------------------------------------------------
  // Componentes de renderização
  // -------------------------------------------------------------------------
  const components: any = {
    // Único renderer de code — trata Mermaid E inline code
    code: ({ inline, className, children, ...props }: any) => {
      const langMatch = /language-(\w+)/.exec(className || '');
      const isMermaid = !inline && langMatch && langMatch[1] === 'mermaid';

      if (isMermaid) {
        const chart = String(children).replace(/\n$/, '').trim();
        return <MermaidChart chart={chart} isDarkMode={isDarkMode} />;
      }

      return (
        <code
          className={
            'font-mono text-[0.75rem] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900/60 ' +
            'text-emerald-700 dark:text-emerald-300 ' +
            (className || '')
          }
          {...props}
        >
          {children}
        </code>
      );
    },

    // Badge de confirmação — renderizado como pill colorido
    verified: (props: any) => {
      const level = String(props['data-level'] || '');
      const kind  = String(props['data-kind']  || '').toUpperCase();
      const label = String(props['data-label'] || '');

      // Texto descritivo do tipo de confirmação
      const kindText =
        /EVIDÊNCIA|EVIDENCIA/i.test(kind) ? 'Evidência forte' :
        /NÃO\s*CONFIRMADO|NAO\s*CONFIRMADO/i.test(kind) ? 'Não confirmado' :
        /SUSPEITO/i.test(kind) ? 'Suspeito' :
        'Fonte oficial';

      const displayText = label ? `${kindText}: ${label}` : kindText;

      // Cor por emoji
      const colorClasses =
        level === '🟢'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700'
          : level === '🟡'
          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700'
          : level === '🟠'
          ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700'
          : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700';

      return (
        <span className={'inline-flex items-center gap-1 px-2 py-0.5 ml-1 rounded-full text-[10px] font-semibold border align-middle ' + colorClasses}>
          <span>{level}</span>
          <span>{displayText}</span>
        </span>
      );
    },

    a: ({ href, children, ...props }: any) => (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="text-emerald-700 dark:text-emerald-300 hover:underline" {...props}>
        {children}
      </a>
    ),
    p: ({ children }: any) => (
      <p className="mb-2 last:mb-0 text-sm md:text-[0.95rem] leading-relaxed text-slate-800 dark:text-slate-100">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc pl-5 mb-2 space-y-1 text-sm md:text-[0.95rem] text-slate-800 dark:text-slate-100">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal pl-5 mb-2 space-y-1 text-sm md:text-[0.95rem] text-slate-800 dark:text-slate-100">{children}</ol>
    ),
    li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
    h1: ({ children }: any) => (
      <h1 className="text-lg md:text-xl font-black tracking-tight mb-3 text-slate-900 dark:text-white">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-base md:text-lg font-black tracking-tight mt-4 mb-2 text-slate-900 dark:text-slate-50 border-b border-emerald-100 dark:border-emerald-900/60 pb-1 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full bg-emerald-500/80" />{children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-[0.95rem] md:text-[1rem] font-extrabold mt-3 mb-1 text-slate-900 dark:text-slate-50 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-[0.9rem] font-bold mt-2 mb-1 text-slate-900 dark:text-slate-50">{children}</h4>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-amber-400/80 bg-amber-50/80 dark:bg-amber-950/40 dark:border-amber-500/70 px-3 py-2 my-2 rounded-r-md text-xs md:text-[0.9rem] text-amber-900 dark:text-amber-100">
        {children}
      </blockquote>
    ),
  };

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
