
import React from 'react';
import { ChatMode } from '../constants';

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
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay escuro */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in"
        onClick={onClose}
      />
      
      {/* Drawer lateral direito */}
      <div className="fixed right-0 top-0 h-full w-80 md:w-96 bg-gray-900 border-l border-gray-700/50 z-50 overflow-y-auto shadow-2xl transform transition-transform duration-300 animate-slide-in">
        
        {/* Header do painel */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700/50 bg-gray-900/95 sticky top-0 backdrop-blur-md z-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>⚙️</span> Configurações
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="p-5 space-y-8">
        
          {/* ===== PERFIL ===== */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Perfil</h3>
            
            <div className="space-y-2">
              <label className="text-sm text-gray-300 font-medium">Como quer ser chamado?</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => onUpdateName(e.target.value)}
                placeholder="Ex: Bruno Lima"
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-gray-600"
              />
              <p className="text-[10px] text-gray-500 ml-1">Usado na saudação e nos relatórios exportados.</p>
            </div>
          </section>
          
          {/* ===== MODO DE INVESTIGAÇÃO ===== */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Modo de Investigação</h3>
            
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
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Aparência</h3>
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
              <div className="flex items-center gap-3">
                <span className="text-xl">{isDarkMode ? '🌙' : '☀️'}</span>
                <div>
                  <p className="text-sm font-medium text-white">Tema Escuro</p>
                  <p className="text-xs text-gray-400">{isDarkMode ? 'Ativado' : 'Desativado'}</p>
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
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Ações</h3>
            
            <div className="space-y-2">
              {/* Dashboard */}
              <button
                onClick={() => { onOpenDashboard(); onClose(); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800/30 border border-gray-700/30 hover:bg-gray-800 hover:border-gray-600 transition-all text-left group"
              >
                <span className="text-lg bg-gray-700 p-2 rounded-lg group-hover:bg-gray-600 transition-colors">📊</span>
                <div>
                  <p className="text-sm font-medium text-white">Dashboard</p>
                  <p className="text-xs text-gray-400">Histórico e estatísticas</p>
                </div>
              </button>
            </div>
          </section>
          
          {/* ===== SOBRE ===== */}
          <section>
            <div className="text-center pt-6 border-t border-gray-700/30">
              <p className="text-xs font-bold text-gray-500">Senior Scout 360 · v4.5</p>
              <p className="text-[10px] text-gray-600 mt-1">Inteligência Comercial para Agronegócio</p>
            </div>
          </section>
          
        </div>
      </div>
    </>
  );
};

export default SettingsDrawer;
