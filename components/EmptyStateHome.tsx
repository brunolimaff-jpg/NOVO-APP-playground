import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChatMode, APP_NAME } from '../constants';
import {
  fetchCompanyByCnpj,
  formatCnpj,
  isValidCnpj,
  normalizeCnpj,
  validateCityInState,
} from '../services/brasilApiService';
import MarketPulse from './MarketPulse';

interface EmptyStateHomeProps {
  mode: ChatMode;
  onStartInvestigation: (payload: { companyName: string; cnpj: string | null; city: string; state: string }) => void;
  isDarkMode: boolean;
}

const VALID_UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

const EmptyStateHome: React.FC<EmptyStateHomeProps> = ({ mode, onStartInvestigation, isDarkMode }) => {
  const { user } = useAuth();
  const userName = user?.displayName;

  const [randomGreeting] = useState(() => {
    const greetings = [
      'E aí, parceiro! Qual empresa a gente vai fuçar hoje?',
      'Bora, comandante! Qual alvo vamos investigar?',
      'Pronto pra ação! Qual empresa quer desvendar hoje?',
      'Salve, bandeirante! Quem é o alvo da vez?',
      'Tamo on! Manda o nome da empresa que eu faço o resto.',
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  });

  const displayGreeting =
    userName && userName !== 'Sair' && userName.trim().length > 0
      ? mode === 'operacao'
        ? `E aí, ${userName}! Bão? Bora vender.`
        : `Olá, ${userName}. Vamos investigar quem hoje?`
      : randomGreeting;

  const heroContent = {
    diretoria: {
      title: APP_NAME,
      subtitle: 'Inteligência comercial estratégica para contas complexas.',
    },
    operacao: {
      title: 'Modo Operação 🛻',
      subtitle: 'Inteligência forense direto ao ponto — sem rodeio, sem enrolação.',
    },
  };

  const currentHero = heroContent[mode];

  const [companyName, setCompanyName] = useState('');
  const [cnpjInput, setCnpjInput] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [lastLookupCnpj, setLastLookupCnpj] = useState<string | null>(null);
  const [didSubmit, setDidSubmit] = useState(false);

  const theme = {
    textPrimary: isDarkMode ? 'text-white' : 'text-slate-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-slate-500',
    heading: isDarkMode ? 'text-gray-500' : 'text-slate-400',
    cardHoverBorder: isDarkMode ? 'hover:border-green-600' : 'hover:border-emerald-500',
    highlight: mode === 'operacao' ? 'text-orange-500' : 'text-green-500',
  };

  const cnpjDigits = normalizeCnpj(cnpjInput);
  const hasValidCnpj = cnpjDigits.length === 14 && isValidCnpj(cnpjDigits);
  const stateNormalized = state.trim().toUpperCase();
  const isStateValid = VALID_UFS.has(stateNormalized);
  const isFormValid = companyName.trim().length >= 2 && city.trim().length >= 2 && isStateValid;

  const canLookupCnpj = useMemo(
    () => hasValidCnpj && cnpjDigits !== lastLookupCnpj && !isFetchingCnpj,
    [hasValidCnpj, cnpjDigits, lastLookupCnpj, isFetchingCnpj],
  );

  const handleCnpjLookup = async () => {
    if (!canLookupCnpj) return;
    setIsFetchingCnpj(true);
    setCnpjStatus('Consultando CNPJ na BrasilAPI...');
    try {
      const data = await fetchCompanyByCnpj(cnpjDigits);
      setLastLookupCnpj(data.cnpj);
      setCompanyName(prev => prev.trim() || data.companyName);
      setCity(prev => prev.trim() || data.city);
      setState(prev => (prev.trim() || data.state).toUpperCase());
      setCnpjStatus('CNPJ validado e dados preenchidos.');
    } catch {
      setCnpjStatus('Não foi possível preencher via CNPJ. Complete manualmente.');
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const handleSubmit = async () => {
    setDidSubmit(true);
    if (!isFormValid) return;
    setLocationStatus('Validando cidade/UF no IBGE...');
    const locationValidation = await validateCityInState(city.trim(), stateNormalized);
    if (!locationValidation.isValid) {
      setLocationStatus('Cidade não encontrada para a UF informada. Verifique o cadastro.');
      return;
    }

    setLocationStatus('Localização validada.');
    onStartInvestigation({
      companyName: companyName.trim(),
      cnpj: cnpjDigits.length === 14 ? cnpjDigits : null,
      city: locationValidation.normalizedCity,
      state: locationValidation.normalizedState,
    });
  };

  return (
    <div className="w-full h-full animate-fade-in pb-10">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">{mode === 'operacao' ? '🛻' : '✈️'}</div>
          <h1 className={`text-2xl font-bold mb-1 ${theme.textPrimary}`}>{currentHero.title}</h1>
          <p className={`${theme.textSecondary} text-sm`}>{currentHero.subtitle}</p>
          <p className={`${theme.highlight} font-medium text-sm mt-2`}>{displayGreeting}</p>
        </div>

        {/* Formulário obrigatório de entrada */}
        <div className="mb-8">
          <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 px-1 ${theme.heading}`}>
            Cadastro inicial da conta
          </h2>
          <p className={`text-xs mb-3 px-1 ${theme.textSecondary}`}>
            Para iniciar o mapeamento profundo, preencha: empresa, CNPJ (opcional), cidade e UF.
          </p>
          <div
            className={`space-y-3 rounded-2xl border p-4 ${
              isDarkMode ? 'bg-gray-900/40 border-gray-700/60' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <input
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Nome da empresa *"
              className={`w-full rounded-lg border px-3 py-2 text-sm bg-transparent ${
                isDarkMode ? 'border-slate-700 text-slate-100' : 'border-slate-300 text-slate-900'
              }`}
            />
            <div className="flex gap-2">
              <input
                value={formatCnpj(cnpjInput)}
                onChange={e => setCnpjInput(normalizeCnpj(e.target.value))}
                onBlur={handleCnpjLookup}
                placeholder="CNPJ (opcional)"
                className={`flex-1 rounded-lg border px-3 py-2 text-sm bg-transparent ${
                  isDarkMode ? 'border-slate-700 text-slate-100' : 'border-slate-300 text-slate-900'
                }`}
              />
              <button
                onClick={handleCnpjLookup}
                disabled={!canLookupCnpj}
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  canLookupCnpj
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : isDarkMode
                      ? 'bg-slate-800 text-slate-500'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isFetchingCnpj ? 'Buscando...' : 'Validar CNPJ'}
              </button>
            </div>
            {cnpjStatus && <p className={`text-[11px] ${theme.textSecondary}`}>{cnpjStatus}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Cidade *"
                className={`sm:col-span-2 rounded-lg border px-3 py-2 text-sm bg-transparent ${
                  isDarkMode ? 'border-slate-700 text-slate-100' : 'border-slate-300 text-slate-900'
                }`}
              />
              <input
                value={state}
                onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="UF *"
                className={`rounded-lg border px-3 py-2 text-sm bg-transparent ${
                  isDarkMode ? 'border-slate-700 text-slate-100' : 'border-slate-300 text-slate-900'
                }`}
              />
            </div>
            {didSubmit && !isFormValid && (
              <p className="text-[11px] text-amber-500">
                Preencha empresa, cidade e UF válida para iniciar.
              </p>
            )}
            {locationStatus && <p className={`text-[11px] ${theme.textSecondary}`}>{locationStatus}</p>}
            <button
              onClick={handleSubmit}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 transition-colors"
            >
              Iniciar investigação completa
            </button>
          </div>
        </div>

        {/* Market Pulse */}
        <MarketPulse isDarkMode={isDarkMode} />

        {/* Footer */}
        <div
          className={`text-center text-xs font-bold ${theme.textSecondary} mt-6 pb-12 opacity-40 uppercase tracking-widest`}
        >
          SENIOR SCOUT 360 — INTELIGÊNCIA FORENSE
        </div>
      </div>
    </div>
  );
};

export default EmptyStateHome;
