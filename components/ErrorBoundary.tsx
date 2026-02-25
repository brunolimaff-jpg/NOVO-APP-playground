import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Loga no audit trail existente (mesmo padrão de promptGuard.ts)
    try {
      const entry = {
        ts: new Date().toISOString(),
        level: 'error',
        reason: error.message,
        stack: info.componentStack ?? '',
      };
      const AUDIT_KEY = 'scout360_ui_errors_v1';
      const raw = localStorage.getItem(AUDIT_KEY);
      const entries: unknown[] = raw ? JSON.parse(raw) : [];
      entries.push(entry);
      localStorage.setItem(AUDIT_KEY, JSON.stringify(entries.slice(-50)));
    } catch {
      // localStorage indisponível — ignora
    }
    console.error('[ErrorBoundary] Erro capturado:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-900 border border-red-900/50 rounded-2xl p-8 text-center shadow-2xl">
            <div className="text-5xl mb-4">🚨</div>
            <h1 className="text-xl font-bold text-white mb-2">
              Senior Scout 360
            </h1>
            <h2 className="text-base font-semibold text-red-400 mb-4">
              Algo deu errado
            </h2>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              Ocorreu um erro inesperado. Seus dados locais estão seguros.
              Recarregue o aplicativo para continuar.
            </p>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 underline decoration-dotted">
                  Ver detalhes técnicos
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-black/40 text-xs text-red-300 overflow-auto max-h-32 whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors shadow-lg"
            >
              Recarregar aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
