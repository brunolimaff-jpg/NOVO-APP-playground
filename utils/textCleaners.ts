/**
 * textCleaners.ts - Utilitários para limpeza e formatação de texto
 * VERSÃO CONSOLIDADA: Remove duplicações com linkFixer.ts
 */

/**
 * Remove formatação Markdown básica de uma string para exibição em texto puro.
 */
export function stripMarkdown(text: string): string {
  if (!text) return text;

  return text
    .replace(/^#+\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s+/gm, '')
    .trim();
}

/**
 * Limpa títulos de sessão removendo formatação markdown.
 */
export function cleanTitle(title: string | null | undefined): string {
  if (!title) return '';
  return title
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpa e padroniza o texto das sugestões de follow-up.
 */
export function cleanSuggestionText(text: string): string {
  let cleaned = stripMarkdown(text);
  cleaned = cleaned.replace(/[?:.]+$/, '');
  
  const startersToRemove = [
    /^quer\s+/i, /^você quer\s+/i, /^você gostaria de\s+/i,
    /^gostaria de\s+/i, /^podemos\s+/i, /^seria bom\s+/i,
    /^que tal\s+/i, /^vamos\s+/i, /^bora\s+/i, /^posso\s+/i, /^dá pra\s+/i
  ];
  
  for (const regex of startersToRemove) {
    cleaned = cleaned.replace(regex, '');
  }
  
  cleaned = cleaned.trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  return cleaned;
}

/**
 * Remove marcadores [[STATUS:...]] do texto.
 */
export function cleanStatusMarkers(text: string): { cleanText: string; lastStatus: string | null } {
  let lastStatus: string | null = null;
  
  if (!text) return { cleanText: '', lastStatus: null };

  const cleanText = text.replace(
    /\[\[STATUS:(.*?)\]\]\n?/g, 
    (_, status) => {
      lastStatus = status.trim();
      return '';
    }
  );
  
  return { cleanText: cleanText.trim(), lastStatus };
}

// ============================================
// SOURCE EXTRACTION
// ============================================

export interface SourceRef {
  id: string;
  title: string;
  url: string;
}

/**
 * Extrai fontes do texto de forma estruturada.
 * NOTA: Para extração completa de links, use extractAllLinksFromMarkdown
 */
export function extractSources(text: string): SourceRef[] {
  const sources: SourceRef[] = [];
  if (!text) return sources;
  const lines = text.split('\n');
  
  const patterns = [
    /\^(\d+)\s*[-–—:]\s*(.*?)(?:\((https?:\/\/[^\s)]+)\))?$/,
    /\[\^(\d+)\]:\s*(https?:\/\/\S+)\s*[-–—]?\s*(.*)?$/,
    /^[¹²³⁴⁵⁶⁷⁸⁹⁰]+\s*(https?:\/\/\S+)\s*[-–—]?\s*(.*)?$/,
    /^(\d+)\.\s+(.*?)(?:\s*[-–—]\s*)?(https?:\/\/\S+)?$/,
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/,
  ];

  let inSourcesBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (/^(?:\*\*)?(?:fontes?|referências?|sources?|refs?)(?:\*\*)?:?\s*$/i.test(trimmed)) {
      inSourcesBlock = true;
      continue;
    }

    if (inSourcesBlock || trimmed.match(/^\^?\d/) || trimmed.match(/^\[.*\]\(http/)) {
      for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
          const id = match[1] || String(sources.length + 1);
          let title = '';
          let url = '';
          
          for (let i = 2; i <= match.length; i++) {
            const val = match[i] || '';
            if (val.startsWith('http')) {
              url = val;
            } else if (val.length > 0) {
              title = val;
            }
          }
          
          if (!url) {
            const urlMatch = (title || trimmed).match(/(https?:\/\/[^\s)]+)/);
            if (urlMatch) {
              url = urlMatch[1];
              title = title.replace(urlMatch[0], '').replace(/[()]/g, '').trim();
            }
          }

          if (!title && url) {
            try {
              title = new URL(url).hostname.replace('www.', '');
            } catch {
              title = url.substring(0, 50);
            }
          }

          if (url && url.startsWith('http')) {
            sources.push({ id: id.replace(/\D/g, ''), title: title || 'Fonte ' + id, url });
          }
          break;
        }
      }
    }
  }

  return sources;
}

/**
 * Extrai TODOS os links markdown do texto (não só do bloco de fontes).
 * Usado para gerar lista de fontes na exportação.
 */
export function extractAllLinksFromMarkdown(text: string): SourceRef[] {
  const links: SourceRef[] = [];
  if (!text) return links;
  
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match;
  let id = 1;
  
  while ((match = linkRegex.exec(text)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();
    
    if (!links.find(l => l.url === url)) {
      links.push({ id: String(id++), title, url });
    }
  }
  
  return links;
}

/**
 * Remove o bloco de fontes APENAS para exibição na UI.
 * MANTÉM links inline no texto.
 */
export function removeSourcesBlock(text: string): string {
  return text
    .replace(/\n\*?\*?(?:Fontes?|Referências?|Sources?)\*?\*?:?\s*\n[\s\S]*$/i, '')
    .replace(/\n\[\^\d+\]:[\s\S]*$/i, '')
    .trim();
}

/**
 * Formata lista de fontes para inclusão no PDF/DOC.
 */
export function formatSourcesForExport(sources: SourceRef[]): string {
  if (!sources || sources.length === 0) return '';
  
  const links = sources
    .filter(s => s.url && s.url.startsWith('http'))
    .map((s) => `<li><a href="${s.url}" target="_blank">${s.title || s.url}</a></li>`)
    .join('\n');
  
  if (!links) return '';
  
  return `
    <div class="sources-section" style="margin-top: 24px; padding-top: 16px; border-top: 2px solid #059669;">
      <h2 style="color: #064e3b; font-size: 14px; font-weight: 700; margin-bottom: 10px;">📚 Fontes e Referências</h2>
      <ul style="list-style: decimal; padding-left: 20px; font-size: 11px; color: #475569;">
        ${links}
      </ul>
    </div>
  `;
}
