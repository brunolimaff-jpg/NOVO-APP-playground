import { extractValidLinks } from './linkFixer';
import { formatSourcesForExport, SourceRef } from './textCleaners';
import { fixFakeLinksHTML } from './linkFixer';
import { APP_NAME } from '../constants';
import { PortaFlag, PortaSegmento, PORTA_WEIGHTS } from '../types';

const PORTA_MARKER_V2_REGEX = /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+):(PRD|AGI|COP):(NONE|(?:(?:TRAD|LOCK|NOFIT)(?:,(?:TRAD|LOCK|NOFIT))*))\]\]/g;
const PORTA_MARKER_V1_REGEX = /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+)\]\]/g;

const portaSegmentLabels: Record<PortaSegmento, string> = {
  PRD: 'Produtor',
  AGI: 'Agroindustria',
  COP: 'Cooperativa',
};

const portaFlagLabels: Record<PortaFlag, string> = {
  TRAD: '🚩 TRAD',
  LOCK: '🔒 LOCK',
  NOFIT: '⛔ NOFIT',
};

function renderPortaCard({
  score,
  p,
  o,
  r,
  t,
  a,
  segmento,
  flags,
  scoreBruto,
}: {
  score: number;
  p: number;
  o: number;
  r: number;
  t: number;
  a: number;
  segmento: PortaSegmento;
  flags: PortaFlag[];
  scoreBruto?: number;
}): string {
  const color = score >= 71 ? '#059669' : score >= 41 ? '#eab308' : '#ef4444';
  const bgColor = score >= 71 ? '#f0fdf4' : score >= 41 ? '#fefce8' : '#fef2f2';
  const borderColor = color;
  const label = score >= 71 ? '🟢 Alta Compatibilidade' : score >= 41 ? '🟡 Media Compatibilidade' : '🔴 Baixa Compatibilidade';
  const showPenalty = typeof scoreBruto === 'number' && scoreBruto !== score && flags.length > 0;
  const flagsHtml = flags.length > 0
    ? flags.map((flag) => `<span class="pill">${portaFlagLabels[flag]}</span>`).join('')
    : '<span class="pill">Sem flags</span>';
  const brutoHtml = typeof scoreBruto === 'number'
    ? `<div class="meta-line"><b>Score:</b> ${score}${showPenalty ? ` (bruto: ${scoreBruto} - penalizado por ${flags.join(', ')})` : scoreBruto !== score ? ` (bruto: ${scoreBruto})` : ''}</div>`
    : '';

  return `<div class="porta-score" style="border:2px solid ${borderColor};background:${bgColor};">
    <div class="header"><span class="label-porta">🎯 PORTA</span><span><span class="score-num" style="color:${color};">${score}</span><span class="score-max">/100</span></span></div>
    <div class="bar-bg" style="background:${color}20;"><div class="bar-fill" style="width:${Math.min(score, 100)}%;background:${color};"></div></div>
    <div class="compat" style="color:${color};">${label}</div>
    <div class="meta-line"><b>Segmento:</b> ${segmento} - ${portaSegmentLabels[segmento]}</div>
    <div class="meta-line"><b>Flags:</b> ${flags.length > 0 ? flags.join(', ') : 'NONE'}</div>
    ${brutoHtml}
    <div class="pillars">
      <span class="pill"><b>P</b> ${p}</span><span class="pill"><b>O</b> ${o}</span><span class="pill"><b>R</b> ${r}</span><span class="pill"><b>T</b> ${t}</span><span class="pill"><b>A</b> ${a}</span>
    </div>
    <div class="pillars">${flagsHtml}</div>
  </div>`;
}

export function convertMarkdownToHTML(md: string, includeSources: boolean = true): string {
  const allLinks = extractValidLinks(md);
  const markdownHttpLinkRegex = /\[([^\]]+)\]\((https?:\/\/(?:[^\s()]+|\([^\s()]*\))+)\)/g;
  let html = md
    .replace(
      PORTA_MARKER_V2_REGEX,
      (_, score, p, o, r, t, a, segmento, flags) => {
        const parsed = {
          score: Number.parseInt(score, 10),
          p: Number.parseInt(p, 10),
          o: Number.parseInt(o, 10),
          r: Number.parseInt(r, 10),
          t: Number.parseInt(t, 10),
          a: Number.parseInt(a, 10),
          segmento: segmento as PortaSegmento,
          flags: flags === 'NONE' ? [] : flags.split(',') as PortaFlag[],
        };
        const weights = PORTA_WEIGHTS[parsed.segmento];
        const scoreBruto = Math.round(
          (parsed.p * weights.p + parsed.o * weights.o + parsed.r * weights.r + parsed.t * weights.t + parsed.a * weights.a) * 10
        );
        return renderPortaCard({ ...parsed, scoreBruto });
      }
    )
    .replace(
      PORTA_MARKER_V1_REGEX,
      (_, score, p, o, r, t, a) => renderPortaCard({
        score: Number.parseInt(score, 10),
        p: Number.parseInt(p, 10),
        o: Number.parseInt(o, 10),
        r: Number.parseInt(r, 10),
        t: Number.parseInt(t, 10),
        a: Number.parseInt(a, 10),
        segmento: 'PRD',
        flags: [],
      })
    )
    .replace(/^>\s*(.*$)/gm, '<blockquote>$1</blockquote>')
    .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(markdownHttpLinkRegex, (_match, text, url) => {
      if (url.includes('ai.studio') || url.includes('google.com/search') || url.includes('vertexai')) {
        return `<strong style="color:#059669;">${text}</strong>`;
      }
      return `<a href="${url}" target="_blank" style="color:#059669;text-decoration:underline;">${text}</a>`;
    })
    .replace(/\^(\d+)/g, '<sup style="background:#059669;color:#fff;padding:1px 5px;border-radius:8px;font-size:10px;margin:0 1px;">$1</sup>')
    .replace(/^[\-\*] (.*$)/gm, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^-----+$/gm, '<hr>')
    .replace(/^---+$/gm, '<hr>');
  html = html.replace(/(<li>[\s\S]*?<\/li>(?:\s*<li>[\s\S]*?<\/li>)*)/g, '<ul>$1</ul>');
  html = html.replace(/(<blockquote>[\s\S]*?<\/blockquote>)(\s*<blockquote>[\s\S]*?<\/blockquote>)*/g, (match) => {
    const content = match.replace(/<\/?blockquote>/g, '');
    return '<blockquote>' + content + '</blockquote>';
  });
  html = html.replace(/<p><hr><\/p>/g, '<hr>');
  if (includeSources && allLinks.length > 0) {
    const sources: SourceRef[] = allLinks.map((l, i) => ({ id: `src-${i}`, ...l }));
    html += formatSourcesForExport(sources);
  }
  return '<p>' + html + '</p>';
}

export function simpleMarkdownToHtml(md: string, title: string): string {
  const htmlBody = fixFakeLinksHTML(convertMarkdownToHTML(md, true));
  return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #333; }
        h1, h2, h3, h4 { color: #059669; font-family: Arial, sans-serif; }
        a { color: #059669; text-decoration: underline; }
        ul { padding-left: 20px; } li { margin-bottom: 5px; }
        blockquote { border-left: 4px solid #f59e0b; background: #fffbeb; padding: 10px; margin: 10px 0; color: #92400e; }
        .sources-section { margin-top: 20px; padding-top: 10px; border-top: 1px solid #059669; }
        .sources-section h2 { color: #064e3b; font-size: 14px; }
      </style>
    </head>
    <body>
      <h1 style="font-size: 24px; border-bottom: 2px solid #059669; padding-bottom: 10px;">${title}</h1>
      ${htmlBody}
      <br>
      <p style="font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px;">Gerado por ${APP_NAME} - Inteligência Comercial</p>
    </body>
    </html>
  `;
}
