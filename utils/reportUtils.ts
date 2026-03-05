import { Message, Sender } from '../types';
import { extractAllLinksFromMarkdown, SourceRef } from './textCleaners';

export function collectFullReport(messages: Message[]): { text: string; sections: string[]; allLinks: SourceRef[] } {
  const botMessages = messages.filter(m => {
    return m.sender === Sender.Bot && typeof m.text === 'string' && m.text.length > 50;
  });
  if (botMessages.length === 0) return { text: '', sections: [], allLinks: [] };

  const sections: string[] = [];
  const allLinks: SourceRef[] = [];
  const dossieText = botMessages[0].text;
  sections.push(dossieText);
  const dossieLinks = extractAllLinksFromMarkdown(dossieText);
  dossieLinks.forEach(link => { if (!allLinks.find(l => l.url === link.url)) allLinks.push(link); });

  for (let i = 1; i < botMessages.length; i++) {
    const botText = botMessages[i].text;
    const botIndex = messages.indexOf(botMessages[i]);
    let userQuestion = '';
    for (let j = botIndex - 1; j >= 0; j--) {
      if (messages[j].sender === Sender.User) { userQuestion = messages[j].text; break; }
    }
    if (botText.length > 50) {
      const sectionHeader = userQuestion
        ? `\n\n---\n\n## 🔍 APROFUNDAMENTO: ${userQuestion}\n\n`
        : `\n\n---\n\n## 🔍 APROFUNDAMENTO #${i}\n\n`;
      sections.push(sectionHeader + botText);
      const sectionLinks = extractAllLinksFromMarkdown(botText);
      sectionLinks.forEach(link => { if (!allLinks.find(l => l.url === link.url)) allLinks.push(link); });
    }
  }
  return { text: sections.join('\n\n'), sections, allLinks };
}

export function detectInconsistencies(sections: string[]): string {
  if (sections.length < 2) return '';
  const inconsistencies: string[] = [];
  const patterns = [
    { label: 'Faturamento', regex: /faturamento[^:]*?:?\s*(?:R\$\s*)?(\d[\d.,]*\s*(?:mi|bi|mil|trilh)[a-záãõüê]*)/gi },
    { label: 'Área/Hectares', regex: /(\d[\d.,]*)\s*(?:mil\s+)?(?:hectares|ha\b)/gi },
    { label: 'Funcionários', regex: /(\d[\d.,]*)\s*(?:mil\s+)?(?:funcionários|colaboradores|empregados)/gi },
    { label: 'Receita', regex: /receita[^:]*?:?\s*(?:R\$\s*)?(\d[\d.,]*\s*(?:mi|bi|mil|trilh)[a-záãõüê]*)/gi },
    { label: 'Unidades', regex: /(\d[\d.,]*)\s*(?:unidades|filiais|fábricas|plantas|usinas)/gi },
  ];
  const mainSection = sections[0];
  for (let i = 1; i < sections.length; i++) {
    const drilldown = sections[i];
    for (const { label, regex } of patterns) {
      regex.lastIndex = 0;
      const mainMatches: string[] = [];
      let match;
      while ((match = regex.exec(mainSection)) !== null) mainMatches.push(match[0].trim());
      regex.lastIndex = 0;
      const drillMatches: string[] = [];
      while ((match = regex.exec(drilldown)) !== null) drillMatches.push(match[0].trim());
      if (mainMatches.length > 0 && drillMatches.length > 0) {
        const mainVal = mainMatches[0].toLowerCase();
        const drillVal = drillMatches[0].toLowerCase();
        if (mainVal !== drillVal) {
          inconsistencies.push(`**${label}:** Dossiê principal menciona *${mainMatches[0]}*, mas aprofundamento menciona *${drillMatches[0]}*. Verifique qual é o dado mais recente.`);
        }
      }
    }
  }
  if (inconsistencies.length === 0) return '';
  return '\n\n---\n\n## ⚠️ INCONSISTÊNCIAS DETECTADAS\n\n' +
    '> Os dados abaixo apareceram com valores diferentes entre o dossiê principal e os aprofundamentos. Recomenda-se verificar a fonte mais confiável antes de usar em propostas.\n\n' +
    inconsistencies.map((inc, i) => `${i + 1}. ${inc}`).join('\n') + '\n';
}
