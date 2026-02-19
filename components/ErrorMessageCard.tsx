
import React, { useState } from 'react';
import { AppError } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorHelpers';
import { ChatMode } from '../constants'; // Import ChatMode to use in props

interface ErrorMessageCardProps {
  error: AppError;
  onRetry: () => void;
  isLoadingRetry: boolean;
  isDarkMode: boolean;
  mode?: ChatMode; // Made optional but recommended
  onReportError?: () => void; // New prop for reporting error
}

const ErrorMessageCard: React.FC<ErrorMessageCardProps> = ({ 
  error, 
  onRetry, 
  isLoadingRetry,
  isDarkMode,
  mode = 'diretoria',
  onReportError
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isReported, setIsReported] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  // Get dynamic message based on mode
  const friendlyMessage = getFriendlyErrorMessage(error, mode as ChatMode);

  // Dynamic colors
  const theme = {
    bg: isDarkMode ? 'bg-red-900/10' : 'bg-red-50',
    border: isDarkMode ? 'border-red-500/30' : 'border-red-200',
    textPrimary: isDarkMode ? 'text-red-200' : 'text-red-800',
    textSecondary: isDarkMode ? 'text-red-300/80' : 'text-red-600',
    codeBg: isDarkMode ? 'bg-black/30' : 'bg-white',
    button: isDarkMode 
      ? 'bg-red-600 hover:bg-red-500 text-white border-red-500' 
      : 'bg-red-100 hover:bg-red-200 text-red-800 border-red-200',
    reportButton: isDarkMode
      ? 'text-red-400 hover:bg-red-900/30'
      : 'text-red-600 hover:bg-red-100'
  };

  const handleReport = () => {
    if (onReportError) {
        setIsReporting(true);
        onReportError();
        // Simulate a small delay for better UX or wait for async if prop was async
        setTimeout(() => {
            setIsReporting(false);
            setIsReported(true);
        }, 800);
    }
  };

  return (
    <div className={`rounded-xl border ${theme.border} ${theme.bg} p-5 animate-fade-in w-full`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl mt-0.5 select-none">❌</div>
        
        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <h3 className={`font-bold text-sm md:text-base ${theme.textPrimary}`}>
              {mode === 'operacao' ? 'Deu ruim na máquina.' : 'Falha na solicitação.'}
            </h3>
            <p className={`text-sm mt-1 leading-relaxed ${theme.textSecondary}`}>
              {friendlyMessage}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Retry Button */}
            {error.retryable && (
                <button
                onClick={(e) => {
                    e.stopPropagation();
                    onRetry();
                }}
                disabled={isLoadingRetry}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${theme.button}
                `}
                >
                {isLoadingRetry ? (
                    <>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span>Tentando de novo...</span>
                    </>
                ) : (
                    <>
                    <span>🔄</span>
                    <span>{mode === 'operacao' ? 'Tentar de novo' : 'Tentar novamente'}</span>
                    </>
                )}
                </button>
            )}

            {/* Report Button */}
            {onReportError && (
                <button 
                    onClick={handleReport}
                    disabled={isReported || isReporting}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${theme.reportButton} disabled:opacity-50 disabled:cursor-default`}
                    title="Enviar detalhes deste erro para análise"
                >
                    {isReporting ? (
                         <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : isReported ? (
                        <>
                            <span>✅</span>
                            <span>Reportado</span>
                        </>
                    ) : (
                        <>
                            <span>👎</span>
                            <span>Reportar erro</span>
                        </>
                    )}
                </button>
            )}
          </div>

          {/* Technical Details (Expandable) */}
          <div className="pt-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs opacity-70 hover:opacity-100 underline decoration-dotted transition-opacity focus:outline-none"
            >
              {showDetails ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}
            </button>

            {showDetails && (
              <div className={`mt-2 p-3 rounded text-xs font-mono overflow-x-auto ${theme.codeBg} border ${theme.border} select-text`}>
                <p><strong>Code:</strong> {error.code}</p>
                <p><strong>Source:</strong> {error.source}</p>
                {error.httpStatus && <p><strong>Status:</strong> {error.httpStatus}</p>}
                <p><strong>Message:</strong> {error.message}</p>
                {error.transient && <p><strong>Transient:</strong> Yes</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorMessageCard;
