/**
 * linkFixer.ts - Intercepta e corrige links falsos/alucinados gerados pelo Gemini
 *
 * Pipeline de tratamento:
 * 1. Links de domínios FAKE (ai.studio, gemini.google.com) → substituir por produto Senior ou remover
 * 2. Links de domínios NÃO-CONFIÁVEIS (Wikipedia, etc) → converter para busca Google verificável
 * 3. Links reais → preservar intactos
 */

import { findSeniorProductUrl, isFakeUrl, isUnreliableUrl, FAKE_DOMAINS, UNRELIABLE_LINK_DOMAINS } from '../services/apiConfig';

/**
 * Gera um link de busca Google como fallback verificável
 * para quando a IA alucina uma URL de Wikipedia ou similar
 */
function buildSearchFallback(linkText: string, originalUrl: string): string {
  const searchQuery = encodeURIComponent(linkText.trim());
  return `https://www.google.com/search?q=${searchQuery}`;
}

/**
 * Extrai um nome amigável do domínio para exibição
 */
function domainLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    if (hostname.includes('wikipedia.org')) return 'Wikipedia';
    return hostname;
  } catch {
    return 'fonte';
  }
}

/**
 * Corrige links no texto MARKDOWN (antes de renderizar)
 */
export function fixFakeLinks(markdownText: string): string {
  if (!markdownText) return markdownText;

  let clean = markdownText.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi,
    (match, linkText, url) => {
      // 1) Link completamente falso (domínios AI internos)
      if (isFakeUrl(url)) {
        const realUrl = findSeniorProductUrl(linkText);
        if (realUrl) {
          return `[${linkText}](${realUrl})`;
        }
        return `**${linkText}**`;
      }

      // 2) Link não-confiável (Wikipedia, etc) — substituir por busca verificável
      if (isUnreliableUrl(url)) {
        const label = domainLabel(url);
        const searchUrl = buildSearchFallback(linkText, url);
        return `[${linkText}](${searchUrl} "Buscar: ${linkText} (fonte original: ${label})")`;
      }

      return match;
    }
  );

  // 3) URLs soltas fake no texto
  const allBlockedDomains = [...FAKE_DOMAINS, ...UNRELIABLE_LINK_DOMAINS];
  const domainsRegexPart = allBlockedDomains.map(d => d.replace(/\./g, '\\.')).join('|');
  const fakeStandaloneRegex = new RegExp(`https?:\\/\\/(?:www\\.)?(?:${domainsRegexPart})[^\\s)>]*`, 'gi');
  
  clean = clean.replace(fakeStandaloneRegex, '');

  return clean;
}

/**
 * Corrige links no HTML JÁ RENDERIZADO (para export de email/doc)
 */
export function fixFakeLinksHTML(html: string): string {
  if (!html) return html;

  return html.replace(
    /<a\s+[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi,
    (match, url, linkText) => {
      // 1) Fake → remover ou substituir por produto Senior
      if (isFakeUrl(url)) {
        const realUrl = findSeniorProductUrl(linkText);
        if (realUrl) {
          return `<a href="${realUrl}" target="_blank" rel="noopener noreferrer" style="color:#059669;text-decoration:underline;">${linkText}</a>`;
        }
        return `<strong style="color:#059669;">${linkText}</strong>`;
      }

      // 2) Não-confiável → busca Google
      if (isUnreliableUrl(url)) {
        const label = domainLabel(url);
        const searchUrl = buildSearchFallback(linkText, url);
        return `<a href="${searchUrl}" target="_blank" rel="noopener noreferrer" style="color:#059669;text-decoration:underline;" title="Buscar: ${linkText} (fonte original: ${label})">${linkText}</a>`;
      }

      return match;
    }
  );
}

/**
 * Remove bloco de "Fontes" que contém apenas URLs fake/não-confiáveis
 */
export function cleanFakeSourcesBlock(text: string): string {
  if (!text) return text;

  const sourcesMatch = text.match(/(\n\*?\*?(?:Fontes?|Referências?|Sources?)[\s\S]*$)/i);
  if (!sourcesMatch) return text;

  const sourcesBlock = sourcesMatch[1];
  const lines = sourcesBlock.split('\n');
  const cleanedLines: string[] = [];
  let hasValidContent = false;

  for (const line of lines) {
    const urlMatch = line.match(/(https?:\/\/[^\s)]+)/);
    
    if (urlMatch && (isFakeUrl(urlMatch[1]) || isUnreliableUrl(urlMatch[1]))) {
      const titleMatch = line.match(/^\s*[\^]?\d*\s*[-–—:"]?\s*(.+?)(?:\s*\(|\s*https?:\/\/)/);
      if (titleMatch && titleMatch[1] && titleMatch[1].trim().length > 3) {
        const cleanTitle = titleMatch[1].trim();
        const searchUrl = buildSearchFallback(cleanTitle, urlMatch[1]);
        cleanedLines.push(`- [${cleanTitle}](${searchUrl})`);
        hasValidContent = true;
      }
      continue;
    }
    
    if (urlMatch && !isFakeUrl(urlMatch[1]) && !isUnreliableUrl(urlMatch[1])) {
      hasValidContent = true;
    }
    
    if (!urlMatch && line.trim().length > 5) {
      hasValidContent = true;
    }
    
    cleanedLines.push(line);
  }

  const cleaned = cleanedLines.join('\n').trim();
  if (!hasValidContent || cleaned.replace(/\*?\*?(?:Fontes?|Referências?|Sources?)\*?\*?:?\s*/i, '').trim().length < 10) {
    return text.replace(sourcesMatch[1], '').trim();
  }

  return text.replace(sourcesMatch[1], '\n' + cleaned);
}

/**
 * Extrai apenas links VÁLIDOS e confiáveis do texto (não-fake, não-unreliable).
 */
export function extractValidLinks(text: string): Array<{ title: string; url: string }> {
  const links: Array<{ title: string; url: string }> = [];
  if (!text) return links;
  
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi;
  let match;
  
  while ((match = linkRegex.exec(text)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();
    
    if (!isFakeUrl(url) && !isUnreliableUrl(url)) {
      if (!links.find(l => l.url === url)) {
        links.push({ title, url });
      }
    }
  }
  
  return links;
}

/**
 * Extrai TODAS as menções de fontes, incluindo as de domínios não-confiáveis
 * (convertidas para busca Google)
 */
export function extractAllSourceMentions(text: string): Array<{ title: string; url?: string }> {
  const sources: Array<{ title: string; url?: string }> = [];
  if (!text) return sources;
  
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi;
  let match;
  
  while ((match = linkRegex.exec(text)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();
    
    if (isFakeUrl(url)) {
      if (!sources.find(s => s.title === title)) {
        sources.push({ title });
      }
    } else if (isUnreliableUrl(url)) {
      const searchUrl = buildSearchFallback(title, url);
      if (!sources.find(s => s.title === title)) {
        sources.push({ title, url: searchUrl });
      }
    } else {
      if (!sources.find(s => s.url === url)) {
        sources.push({ title, url });
      }
    }
  }
  
  const mentionPatterns = [
    /(?:segundo|conforme|de acordo com|fonte:?)\s+([A-Z][A-Za-zÀ-ÿ\s]+?)(?:\s*[,.\[]|\s*$)/gi,
    /(?:citado em|mencionado em|relatado por)\s+([A-Z][A-Za-zÀ-ÿ\s]+?)(?:\s*[,.\[]|\s*$)/gi,
  ];
  
  for (const pattern of mentionPatterns) {
    while ((match = pattern.exec(text)) !== null) {
      const title = match[1].trim();
      if (title.length > 3 && title.length < 100 && !sources.find(s => s.title === title)) {
        sources.push({ title });
      }
    }
  }
  
  return sources;
}

// Stubs para compatibilidade
export function rewriteMarkdownLinksToGoogle(markdownText: string): string {
  if (!markdownText) return markdownText;
  return markdownText;
}

export function autoLinkSeniorTerms(markdownText: string): string {
  if (!markdownText) return markdownText;
  return markdownText;
}
