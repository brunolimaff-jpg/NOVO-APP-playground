import React from 'react';
import { cleanSuggestionText } from '../utils/textCleaners';

interface SmartOptionsProps {
  options: string[];
  onPreFillInput: (text: string) => void;  // MUDANÇA: preenche input em vez de enviar
  isRegenerating?: boolean;
  onRegenerate?: () => void;
}

export function parseSmartOptions(text: string): { cleanText: string; options: string[] } {
  // Regex para encontrar o bloco de sugestões
  // Busca por separadores como ---, seguido de cabeçalho como "**🔎 O que você quer descobrir agora?**"
  const suggestionHeaderRegex = /(?:---|___|\*\*\*)\s*[\r\n]+(?:\*\*|##|###)?\s*(?:🔎|⚡|🤠)?\s*(?:O que você quer descobrir agora|E aí, onde a gente joga o adubo agora|E aí, qual desses você quer cavucar|Próximos passos|Sugestões de perguntas)(?:.*?)[\r\n]+/i;
  
  const parts = text.split(suggestionHeaderRegex);
  
  // Se não houver split, retorna texto original e opções vazias
  if (parts.length < 2) {
    return { cleanText: text, options: [] };
  }

  // O conteúdo antes do split é o texto limpo
  const cleanText = parts[0].trim();
  
  // A parte depois é o bloco de sugestões
  const suggestionsBlock = parts[parts.length - 1];
  
  const lines = suggestionsBlock.split('\n');
  const options = lines
    .map(line => line.trim())
    .filter(line => /^[\*\-•\+]\s/.test(line) || /^\d+\./.test(line))
    .map(line => {
        const clean = line
            .replace(/^[\*\-•\+\d\.]+\s*/, '') // Remove bullets ou números
            .replace(/^"|"$/g, '') // Remove aspas
            .replace(/^'|'$/g, '')
            .replace(/\*+$/, '') // Remove asteriscos finais
            .trim();
        return cleanSuggestionText(clean);
    })
    .filter(line => line.length > 0)
    .slice(0, 4); // Máximo 4 sugestões

  return { cleanText, options };
}

const SmartOptions: React.FC<SmartOptionsProps> = ({ 
  options, 
  onPreFillInput,  // MUDANÇA: nome mais claro
  isRegenerating = false,
  onRegenerate
}) => {
  if (!options || options.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-4 animate-fade-in select-none">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-50 flex items-center gap-1">
          💡 Sugestões
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
            onClick={() => onPreFillInput(option)}  // MUDANÇA: preenche input
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
