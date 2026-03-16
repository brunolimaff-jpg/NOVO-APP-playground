import React, { useMemo, Suspense } from 'react';
import { Message } from '../types';
import { parseMarkdownSections } from '../utils/sectionParser';
import { useAuth } from '../contexts/AuthContext';
import { ChatMode } from '../constants';
import SmartOptions, { parseSmartOptions } from './SmartOptions';
import type { AuditableSource } from '../utils/textCleaners';

const MarkdownRenderer = React.lazy(() => import('./MarkdownRenderer'));

interface SectionalBotMessageProps {
  message: Message;
  sessionId?: string;
  userId?: string;
  isDarkMode: boolean;
  mode?: ChatMode;
  onPreFillInput?: (text: string) => void;
  onRegenerateSuggestions?: (messageId: string) => void;
  hideSuggestions?: boolean;
  empresaAlvo?: string | null;
  auditableSources?: AuditableSource[];
}

const SectionalBotMessage: React.FC<SectionalBotMessageProps> = ({
  message,
  sessionId = "preview_session",
  userId,
  isDarkMode,
  mode = 'diretoria',
  onPreFillInput,
  onRegenerateSuggestions,
  hideSuggestions = false,
  empresaAlvo,
  auditableSources = []
}) => {
  const content = message.text || "";
  const { user } = useAuth();

  const { cleanText, options: parsedOptions } = useMemo(() => parseSmartOptions(content), [content]);
  const sections = useMemo(() => parseMarkdownSections(cleanText), [cleanText]);

  const activeOptions = message.suggestions && message.suggestions.length > 0 
    ? message.suggestions 
    : parsedOptions;

  // Substituir [NOME DA EMPRESA] nas sugestões
  const processedOptions = useMemo(() => {
    if (!empresaAlvo || !activeOptions || activeOptions.length === 0) return activeOptions;
    
    return activeOptions.map(option => 
      option
        .replace(/\[NOME DA EMPRESA\]/gi, empresaAlvo)
        .replace(/\[Nome da Empresa\]/gi, empresaAlvo)
        .replace(/\[Empresa\]/gi, empresaAlvo)
        .replace(/\[NOME DO GRUPO \/ EMPRESA ALVO\]/gi, empresaAlvo)
    );
  }, [activeOptions, empresaAlvo]);

  const isRegenerating = Boolean(message.isRegeneratingSuggestions);

  const handleRegenerate = () => {
    if (onRegenerateSuggestions && message.id) {
      onRegenerateSuggestions(message.id);
    }
  };

  if (sections.length <= 1 && !cleanText.includes('##')) {
     return (
       <div className="flex flex-col gap-2">
         <Suspense fallback={<div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />}>
           <MarkdownRenderer
              content={cleanText}
              isDarkMode={isDarkMode}
              groundingSources={message.groundingSources}
              auditableSources={auditableSources}
           />
         </Suspense>
         {processedOptions.length > 0 && onPreFillInput && !hideSuggestions && (
            <SmartOptions 
              options={processedOptions} 
              onPreFillInput={onPreFillInput}
              isRegenerating={isRegenerating}
              onRegenerate={handleRegenerate}
            />
         )}
       </div>
     );
  }

  return (
    <div className="sectional-message space-y-4">
      {sections.map((section, idx) => (
        <div key={section.key} className="section-block group relative">
          <div className="section-content">
             <Suspense fallback={<div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />}>
               <MarkdownRenderer
                  content={section.key === 'intro' ? section.content : `${'#'.repeat(section.level)} ${section.title}\n\n${section.content}`}
                  isDarkMode={isDarkMode}
                  groundingSources={message.groundingSources}
                  auditableSources={auditableSources}
                  showCollapsibleSources={idx === sections.length - 1}
               />
             </Suspense>
          </div>
        </div>
      ))}

      {processedOptions.length > 0 && onPreFillInput && !hideSuggestions && (
        <div className="pt-2 border-t border-dashed border-gray-500/20 mt-4">
           <SmartOptions 
              options={processedOptions} 
              onPreFillInput={onPreFillInput}
              isRegenerating={isRegenerating}
              onRegenerate={handleRegenerate}
           />
        </div>
      )}
    </div>
  );
};

export default SectionalBotMessage;