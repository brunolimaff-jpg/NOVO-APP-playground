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
  onPreFillInput?: (text: string) => void;
  onRegenerateSuggestions?: (messageId: string) => void;
  hideSuggestions?: boolean;
}

const SectionalBotMessage: React.FC<SectionalBotMessageProps> = ({
  message,
  sessionId = "preview_session",
  userId,
  isDarkMode,
  mode = 'diretoria',
  onPreFillInput,
  onRegenerateSuggestions,
  hideSuggestions = false
}) => {
  const content = message.text || "";
  const { user } = useAuth();

  const { cleanText, options: parsedOptions } = useMemo(() => parseSmartOptions(content), [content]);
  const sections = useMemo(() => parseMarkdownSections(cleanText), [cleanText]);

  const activeOptions = message.suggestions && message.suggestions.length > 0 
    ? message.suggestions 
    : parsedOptions;

  const isRegenerating = Boolean(message.isRegeneratingSuggestions);

  const handleRegenerate = () => {
    if (onRegenerateSuggestions && message.id) {
      onRegenerateSuggestions(message.id);
    }
  };

  if (sections.length <= 1 && !cleanText.includes('##')) {
     return (
       <div className="flex flex-col gap-2">
         <MarkdownRenderer 
            content={cleanText} 
            isDarkMode={isDarkMode} 
            groundingSources={message.groundingSources}
         />
         {activeOptions.length > 0 && onPreFillInput && !hideSuggestions && (
            <SmartOptions 
              options={activeOptions} 
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
             <MarkdownRenderer
                content={section.key === 'intro' ? section.content : `${'#'.repeat(section.level)} ${section.title}\n\n${section.content}`}
                isDarkMode={isDarkMode}
                groundingSources={message.groundingSources}
                showCollapsibleSources={idx === sections.length - 1}
             />
          </div>
        </div>
      ))}

      {activeOptions.length > 0 && onPreFillInput && !hideSuggestions && (
        <div className="pt-2 border-t border-dashed border-gray-500/20 mt-4">
           <SmartOptions 
              options={activeOptions} 
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
