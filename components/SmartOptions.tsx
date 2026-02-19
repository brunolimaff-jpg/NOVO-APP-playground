
import React from 'react';
import { cleanSuggestionText } from '../utils/textCleaners';

interface SmartOptionsProps {
  options: string[];
  onSelect: (option: string) => void;
  isRegenerating?: boolean;
  onRegenerate?: () => void;
}

export function parseSmartOptions(text: string): { cleanText: string; options: string[] } {
  // Regex to find the suggestions block
  // Searches for separators like ---, then header like "**🔎 O que você quer descobrir agora?**"
  const suggestionHeaderRegex = /(?:---|___|\*\*\*)\s*[\r\n]+(?:\*\*|##|###)?\s*(?:🔎|⚡|🤠)?\s*(?:O que você quer descobrir agora|E aí, onde a gente joga o adubo agora|E aí, qual desses você quer cavucar|Próximos passos|Sugestões de perguntas)(?:.*?)[\r\n]+/i;
  
  const parts = text.split(suggestionHeaderRegex);
  
  // If no split happened, or split is weird, return original text and empty options
  if (parts.length < 2) {
    return { cleanText: text, options: [] };
  }

  // The content before the split is the clean text
  const cleanText = parts[0].trim();
  
  // The part after is the suggestions block
  const suggestionsBlock = parts[parts.length - 1];
  
  const lines = suggestionsBlock.split('\n');
  const options = lines
    .map(line => line.trim())
    .filter(line => /^[\*\-•\+]\s/.test(line) || /^\d+\./.test(line))
    .map(line => {
        const clean = line
            .replace(/^[\*\-•\+\d\.]+\s*/, '') // Remove bullet points or numbers
            .replace(/^"|"$/g, '') // Remove quotes
            .replace(/^'|'$/g, '')
            .replace(/\*+$/, '') // Remove trailing asterisks
            .trim();
        return cleanSuggestionText(clean);
    })
    .filter(line => line.length > 0)
    .slice(0, 3); // Max 3 suggestions

  return { cleanText, options };
}

const SmartOptions: React.FC<SmartOptionsProps> = ({ 
  options, 
  onSelect,
  isRegenerating = false,
  onRegenerate
}) => {
  if (!options || options.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-4 animate-fade-in select-none">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-50 flex items-center gap-1">
          🔎 Sugestões
        </span>
        {onRegenerate && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate();
            }}
            disabled={isRegenerating}
            className={`text-[10px] opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1 ${isRegenerating ? 'animate-pulse cursor-not-allowed' : ''}`}
            title="Gerar novas sugestões baseadas neste contexto"
          >
            {isRegenerating ? '↻ Gerando...' : '↻ Novas'}
          </button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(option)}
            className="text-xs text-left px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shadow-sm active:scale-95"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SmartOptions;
