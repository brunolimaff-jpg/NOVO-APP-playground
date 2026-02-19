import { useState, useMemo } from "react";

// Tipagem
interface Investigation {
  id: string;
  empresa: string;
  score: number;
  scoreLabel: string;
  gaps: string[];
  familias: string[];
  isCliente: boolean;
  modo: string;
  data: string;
  resumo: string;
}

// Armazena em memória (sem localStorage)
let investigationsStore: Investigation[] = [];

// Função pública para outros componentes adicionarem investigações
export function addInvestigation(inv: Investigation) {
  // Evita duplicatas por empresa (atualiza se já existe)
  const idx = investigationsStore.findIndex(i => 
    i.empresa.toUpperCase() === inv.empresa.toUpperCase()
  );
  if (idx >= 0) {
    investigationsStore[idx] = { ...inv, id: investigationsStore[idx].id };
  } else {
    investigationsStore = [inv, ...investigationsStore];
  }
}

export function getInvestigations(): Investigation[] {
  return [...investigationsStore];
}

// Componente Dashboard
export default function InvestigationDashboard({ 
  onClose, 
  onSelectEmpresa 
}: { 
  onClose: () => void; 
  onSelectEmpresa: (nome: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState<"data" | "score">("data");
  
  const investigations = useMemo(() => {
    let items = getInvestigations();
    if (filter) {
      const f = filter.toUpperCase();
      items = items.filter(i => i.empresa.toUpperCase().includes(f));
    }
    if (sortBy === "score") {
      items.sort((a, b) => b.score - a.score);
    }
    return items;
  }, [filter, sortBy]);

  const stats = useMemo(() => {
    const all = getInvestigations();
    return {
      total: all.length,
      quentes: all.filter(i => i.score >= 80).length,
      mornas: all.filter(i => i.score >= 60 && i.score < 80).length,
      frias: all.filter(i => i.score < 60).length,
      clientes: all.filter(i => i.isCliente).length,
    };
  }, []);

  const scoreColor = (s: number) => {
    if (s >= 80) return "text-green-400";
    if (s >= 60) return "text-yellow-400";
    if (s >= 40) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-bold text-white">📊 Histórico de Investigações</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-5 gap-2 mb-3 text-xs">
            <div className="bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-white font-bold text-lg">{stats.total}</div>
              <div className="text-gray-400">Total</div>
            </div>
            <div className="bg-green-900/20 border border-green-900 rounded-lg p-2 text-center">
              <div className="text-green-400 font-bold text-lg">{stats.quentes}</div>
              <div className="text-gray-400">Quentes</div>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-900 rounded-lg p-2 text-center">
              <div className="text-yellow-400 font-bold text-lg">{stats.mornas}</div>
              <div className="text-gray-400">Mornas</div>
            </div>
            <div className="bg-red-900/20 border border-red-900 rounded-lg p-2 text-center">
              <div className="text-orange-400 font-bold text-lg">{stats.frias}</div>
              <div className="text-gray-400">Frias</div>
            </div>
            <div className="bg-blue-900/20 border border-blue-900 rounded-lg p-2 text-center">
              <div className="text-blue-400 font-bold text-lg">{stats.clientes}</div>
              <div className="text-gray-400">Clientes</div>
            </div>
          </div>
          
          {/* Filtros */}
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Buscar empresa..." 
              value={filter} 
              onChange={e => setFilter(e.target.value)} 
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-green-500 text-white" 
            />
            <button 
              onClick={() => setSortBy(sortBy === "data" ? "score" : "data")}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-700 text-white"
            >
              {sortBy === "data" ? "📅 Recentes" : "🎯 Por Score"}
            </button>
          </div>
        </div>
        
        {/* Lista */}
        <div className="overflow-auto flex-1 p-4 space-y-2 custom-scrollbar">
          {investigations.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              Nenhuma investigação ainda. Pesquise uma empresa para começar.
            </p>
          )}
          {investigations.map(inv => (
            <div 
              key={inv.id}
              onClick={() => { onSelectEmpresa(inv.empresa); onClose(); }}
              className="bg-gray-800 border border-gray-700 rounded-xl p-3 hover:border-green-700 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`text-2xl font-bold ${scoreColor(inv.score)}`}>
                    {inv.score}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{inv.empresa}</h3>
                    <p className="text-gray-500 text-xs">
                      {inv.data} • {inv.modo} • {inv.isCliente ? "✅ Cliente" : "🆕 Prospect"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {inv.familias.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-1 mb-1">
                      {inv.familias.slice(0, 3).map(f => (
                        <span key={f} className="text-xs bg-gray-700 rounded px-1.5 py-0.5 text-gray-300">{f}</span>
                      ))}
                    </div>
                  )}
                  {inv.gaps.length > 0 && (
                    <div className="text-yellow-500 text-xs">{inv.gaps.length} gaps</div>
                  )}
                </div>
              </div>
              {inv.resumo && (
                <p className="text-gray-400 text-xs mt-2 line-clamp-2">{inv.resumo}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}