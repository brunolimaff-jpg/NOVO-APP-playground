import React, { useMemo } from 'react';
import { Message } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { parseMarkdownSections } from '../utils/sectionParser';
import { useAuth } from '../contexts/AuthContext';
import { ChatMode } from '../constants';
import SmartOptions, { parseSmartOptions } from './SmartOptions';

interface SectionalBotMessageProps {
  message: Message;
  sessionId?: string;
  userId?: string;
  isDarkMode: boolean;
  mode?: ChatMode;
  // MUDANÇA: Callback para preencher o input (não enviar)
  onPreFillInput?: (text: string) => void;
  onRegenerateSuggestions?: (messageId: string) => void;
}

const SectionalBotMessage: React.FC<SectionalBotMessageProps> = ({
  message,
  sessionId = "preview_session",
  userId,
  isDarkMode,
  mode = 'diretoria',
  onPreFillInput,  // MUDANÇA: novo nome
  onRegenerateSuggestions
}) => {
  const content = message.text || "";
  const { user } = useAuth();

  // 1. Parse Smart Options do texto bruto (Fallback)
  const { cleanText, options: parsedOptions } = useMemo(() => parseSmartOptions(content), [content]);

  // 2. Parse Markdown Sections do texto limpo
  const sections = useMemo(() => parseMarkdownSections(cleanText), [cleanText]);

  // ARQUITETURA DE ESTADO: Priorizamos as sugestões em tempo de execução
  // Se não houver, fazemos fallback para as extraídas do Markdown original.
  const activeOptions = message.suggestions && message.suggestions.length > 0 
    ? message.suggestions 
    : parsedOptions;

  // Extraímos o estado de loading da própria mensagem
  const isRegenerating = Boolean(message.isRegeneratingSuggestions);

  // Helper para não poluir o JSX
  const handleRegenerate = () => {
    if (onRegenerateSuggestions && message.id) {
      onRegenerateSuggestions(message.id);
    }
  };

  // Se mensagem simples (sem seções)
  if (sections.length <= 1 && !cleanText.includes('##')) {
     return (
       <div className="flex flex-col gap-2">
         <MarkdownRenderer 
            content={cleanText} 
            isDarkMode={isDarkMode} 
            groundingSources={message.groundingSources}
         />
         {activeOptions.length > 0 && onPreFillInput && (
            <SmartOptions 
              options={activeOptions} 
              onPreFillInput={onPreFillInput}  // MUDANÇA: preenche input
              isRegenerating={isRegenerating}
              onRegenerate={handleRegenerate}
            />
         )}
       </div>
     );
  }

  // Se mensagem complexa (com seções PORTA ou Dossiê)
  return (
    <div className="sectional-message space-y-4">
      {sections.map((section) => (
        <div key={section.key} className="section-block group relative">
          <div className="section-content">
             <MarkdownRenderer 
                content={section.key === 'intro' ? section.content : `${'#'.repeat(section.level)} ${section.title}\n\n${section.content}`} 
                isDarkMode={isDarkMode}
                groundingSources={message.groundingSources}
             />
          </div>
        </div>
      ))}

      {/* Render Smart Options */}
      {activeOptions.length > 0 && onPreFillInput && (
        <div className="pt-2 border-t border-dashed border-gray-500/20 mt-4">
           <SmartOptions 
              options={activeOptions} 
              onPreFillInput={onPreFillInput}  // MUDANÇA: preenche input
              isRegenerating={isRegenerating}
              onRegenerate={handleRegenerate}
           />
        </div>
      )}
    </div>
  );
};

export default SectionalBotMessage;
