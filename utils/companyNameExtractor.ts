const COMPANY_PATTERNS = [
  /completa?\s+d[oa]s?\s+(.*)/i,
  /(?:empresa|grupo|companhia)\s+(.*)/i,
  /(?:investigar?|analisar?|pesquisar?)\s+(?:a\s+|o\s+)?(.*)/i,
  /(?:sobre\s+(?:a|o)\s+)(.*)/i,
  /(?:dossie?\s+d[oa]s?\s+)(.*)/i,
  /(?:capivara\s+d[oa]s?\s+)(.*)/i,
];

export function extractCompanyName(title: string | null | undefined): string {
  if (!title) return 'Empresa';
  for (const pattern of COMPANY_PATTERNS) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim().replace(/\.{3}$/, '').trim();
      if (name.length > 2 && name.length < 60) return name;
    }
  }
  return title.replace(/\.{3}$/, '').trim();
}
