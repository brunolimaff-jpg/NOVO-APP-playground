
import React from 'react';
import { ChatMode } from '../constants';
import { usePWA } from '../hooks/usePWA';
import { version } from '../package.json';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onUpdateName: (name: string) => void;
  mode: ChatMode;
  onSetMode: (mode: ChatMode) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenDashboard: () => void;
  onExportPDF: () => void;
  onCopyMarkdown: () => void;
  onSendEmail: () => void;
  onScheduleFollowUp: () => void; // New prop
  exportStatus: 'idle' | 'loading' | 'success' | 'error';
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  userName,
  onUpdateName,
  mode,
  onSetMode,
  isDarkMode,
  onToggleTheme,
  onOpenDashboard,
  onExportPDF,
  onCopyMarkdown,
  onSendEmail,
  onScheduleFollowUp,
  exportStatus
}) => {
  const { canInstall, isInstalled, installApp } = usePWA();
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay escuro */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in"
        onClick={onClose}
      />
      
      {/* Drawer lateral direito */}
      <div className={`fixed right-0 top-0 h-full w-80 md:w-96 border-l z-50 overflow-y-auto shadow-2xl transform transition-transform duration-300 animate-slide-in ${
        isDarkMode
          ? 'bg-gray-900 border-gray-700/50'
          : 'bg-white border-gray-200'
      }`}>

        {/* Header do painel */}
        <div className={`flex items-center justify-between p-5 border-b sticky top-0 backdrop-blur-md z-10 ${
          isDarkMode
            ? 'border-gray-700/50 bg-gray-900/95'
            : 'border-gray-200 bg-white/95'
        }`}>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            <span>⚙️</span> Configurações
          </h2>
          <button
            onClick={onClose}
            className={`text-xl p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            ✕
          </button>
        </div>
        
        <div className="p-5 space-y-8">
        
          {/* ===== PERFIL ===== */}
          <section>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Perfil</h3>

            <div className="space-y-2">
              <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Como quer ser chamado?</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => onUpdateName(e.target.value)}
                placeholder="Ex: Bruno Lima"
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-600'
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              <p className={`text-[10px] ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Usado na saudação e nos relatórios exportados.</p>
            </div>
          </section>
          
          {/* ===== MODO DE INVESTIGAÇÃO ===== */}
          <section>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Modo de Investigação</h3>
            
            <div className="grid gap-3">
              {/* Operação */}
              <button
                onClick={() => onSetMode('operacao')}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all relative overflow-hidden group ${
                  mode === 'operacao' 
                    ? 'border-orange-500/50 bg-orange-500/10' 
                    : 'border-gray-700/50 bg-gray-800/30 hover:bg-gray-800 hover:border-gray-600'
                }`}
              >
                <span className="text-3xl filter drop-shadow-lg group-hover:scale-110 transition-transform">🛻</span>
                <div className="text-left">
                  <p className={`text-sm font-bold ${mode === 'operacao' ? 'text-orange-400' : 'text-gray-200'}`}>Operação</p>
                  <p className="text-xs text-gray-400 mt-0.5">Direto ao ponto, linguagem de campo</p>
                </div>
                {mode === 'operacao' && <span className="absolute top-3 right-3 text-orange-500">✓</span>}
              </button>
              
              {/* Diretoria */}
              <button
                onClick={() => onSetMode('diretoria')}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all relative overflow-hidden group ${
                  mode === 'diretoria' 
                    ? 'border-blue-500/50 bg-blue-500/10' 
                    : 'border-gray-700/50 bg-gray-800/30 hover:bg-gray-800 hover:border-gray-600'
                }`}
              >
                <span className="text-3xl filter drop-shadow-lg group-hover:scale-110 transition-transform">✈️</span>
                <div className="text-left">
                  <p className={`text-sm font-bold ${mode === 'diretoria' ? 'text-blue-400' : 'text-gray-200'}`}>Diretoria</p>
                  <p className="text-xs text-gray-400 mt-0.5">Análise executiva, estratégica e sóbria</p>
                </div>
                {mode === 'diretoria' && <span className="absolute top-3 right-3 text-blue-500">✓</span>}
              </button>
            </div>
          </section>
          
          {/* ===== APARÊNCIA ===== */}
          <section>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Aparência</h3>

            <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{isDarkMode ? '🌙' : '☀️'}</span>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Tema Escuro</p>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{isDarkMode ? 'Ativado' : 'Desativado'}</p>
                </div>
              </div>
              <button
                onClick={onToggleTheme}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none ${
                  isDarkMode ? 'bg-emerald-600' : 'bg-gray-600'
                }`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </section>
          
          {/* ===== AÇÕES ===== */}
          <section>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Ações</h3>

            <div className="space-y-2">
              {/* Instalar PWA */}
              {canInstall && (
                <button
                  onClick={installApp}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group border-emerald-500/40 ${
                    isDarkMode
                      ? 'bg-emerald-900/20 hover:bg-emerald-900/40'
                      : 'bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  <span className={`text-lg p-2 rounded-lg ${isDarkMode ? 'bg-emerald-800/60' : 'bg-emerald-200'}`}>📲</span>
                  <div>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>Instalar aplicativo</p>
                    <p className={`text-xs ${isDarkMode ? 'text-emerald-500' : 'text-emerald-600'}`}>Adicionar à tela inicial</p>
                  </div>
                </button>
              )}
              {isInstalled && (
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'border-emerald-700/30 bg-emerald-900/10' : 'border-emerald-200 bg-emerald-50'}`}>
                  <span className="text-lg">✅</span>
                  <p className={`text-xs ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>App instalado na tela inicial</p>
                </div>
              )}

              {/* Dashboard */}
              <button
                onClick={() => { onOpenDashboard(); onClose(); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                  isDarkMode
                    ? 'bg-gray-800/30 border-gray-700/30 hover:bg-gray-800 hover:border-gray-600'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                <span className={`text-lg p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-gray-700 group-hover:bg-gray-600' : 'bg-gray-200 group-hover:bg-gray-300'}`}>📊</span>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Dashboard</p>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Histórico e estatísticas</p>
                </div>
              </button>
            </div>
          </section>

          {/* ===== SOBRE ===== */}
          <section>
            <div className={`text-center pt-6 border-t ${isDarkMode ? 'border-gray-700/30' : 'border-gray-200'}`}>
              <p className={`text-xs font-bold ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Senior Scout 360 · v{version}</p>
              <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>Inteligência Comercial para Agronegócio</p>
            </div>
          </section>
          
        </div>
      </div>
    </>
  );
};

export default SettingsDrawer;
