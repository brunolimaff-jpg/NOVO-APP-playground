export interface BrasilApiCompanyData {
  cnpj: string;
  companyName: string;
  city: string;
  state: string;
}

function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

export function normalizeCnpj(value: string): string {
  return onlyDigits(value).slice(0, 14);
}

export function formatCnpj(value: string): string {
  const digits = normalizeCnpj(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const calcDigit = (base: string, factors: number[]): number => {
    const total = base
      .split('')
      .reduce((sum, char, idx) => sum + Number(char) * factors[idx], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const d1 = calcDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${d1}${d2}`);
}

export async function fetchCompanyByCnpj(cnpjValue: string, signal?: AbortSignal): Promise<BrasilApiCompanyData> {
  const cnpj = normalizeCnpj(cnpjValue);
  if (!isValidCnpj(cnpj)) {
    throw new Error('CNPJ inválido');
  }

  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    method: 'GET',
    signal,
  });
  if (!response.ok) {
    throw new Error(`BrasilAPI retornou ${response.status}`);
  }

  const payload = (await response.json()) as {
    cnpj?: string;
    razao_social?: string;
    nome_fantasia?: string;
    municipio?: string;
    uf?: string;
  };

  const companyName = (payload.nome_fantasia || payload.razao_social || '').trim();
  const city = (payload.municipio || '').trim();
  const state = (payload.uf || '').trim().toUpperCase();

  if (!companyName || !city || !state) {
    throw new Error('Dados incompletos na BrasilAPI');
  }

  return {
    cnpj: payload.cnpj ? normalizeCnpj(payload.cnpj) : cnpj,
    companyName,
    city,
    state,
  };
}
