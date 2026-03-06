import { extractValidLinks } from './linkFixer';
import { formatSourcesForExport, SourceRef } from './textCleaners';
import { fixFakeLinksHTML } from './linkFixer';
import { APP_NAME } from '../constants';

export function convertMarkdownToHTML(md: string, includeSources: boolean = true): string {
  const allLinks = extractValidLinks(md);
  const markdownHttpLinkRegex = /\[([^\]]+)\]\((https?:\/\/(?:[^\s()]+|\([^\s()]*\))+)\)/g;
  let html = md
    .replace(
      /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+)(?::(PRD|AGI|COP):(NONE|(?:(?:TRAD|LOCK|NOFIT)(?:,(?:TRAD|LOCK|NOFIT))*)))?\]\]/g,
      (_, score, p, o, r, t, a, seg, flags) => {
        const s = parseInt(score);
        const color = s >= 71 ? '#059669' : s >= 41 ? '#eab308' : '#ef4444';
        const bgColor = s >= 71 ? '#f0fdf4' : s >= 41 ? '#fefce8' : '#fef2f2';
        const borderColor = s >= 71 ? '#059669' : s >= 41 ? '#eab308' : '#ef4444';
        const label = s >= 71 ? '🟢 Alta Compatibilidade' : s >= 41 ? '🟡 Média Compatibilidade' : '🔴 Baixa Compatibilidade';
        const segLabel = seg ? ` <span class="seg-badge">${seg}</span>` : '';
        const flagsHtml = flags && flags !== 'NONE'
          ? `<div class="flags">${flags.split(',').map((f: string) => {
              const ic = f === 'TRAD' ? '🚩' : f === 'LOCK' ? '🔒' : '⛔';
              return `<span class="flag-badge">${ic} ${f}</span>`;
            }).join('')}</div>`
          : '';
        return `<div class="porta-score" style="border:2px solid ${borderColor};background:${bgColor};">
          <div class="header"><span class="label-porta">🎯 PORTA${segLabel}</span><span><span class="score-num" style="color:${color};">${score}</span><span class="score-max">/100</span></span></div>
          <div class="bar-bg" style="background:${color}20;"><div class="bar-fill" style="width:${Math.min(s, 100)}%;background:${color};"></div></div>
          <div class="compat" style="color:${color};">${label}</div>
          ${flagsHtml}
          <div class="pillars"><span class="pill"><b>P</b> ${p}</span><span class="pill"><b>O</b> ${o}</span><span class="pill"><b>R</b> ${r}</span><span class="pill"><b>T</b> ${t}</span><span class="pill"><b>A</b> ${a}</span></div>
        </div>`;
      }
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
