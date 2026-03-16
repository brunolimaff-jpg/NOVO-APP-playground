export const APP_NAME = '🦅 Senior Scout 360';
export const APP_VERSION = 'Investigação Completa v4.7';

export type ChatMode = 'operacao' | 'diretoria';

export const DEFAULT_MODE: ChatMode = 'operacao';

export const NOME_VENDEDOR_PLACEHOLDER = '{{NOME_VENDEDOR}}';

interface ModeTheme {
  bg: string;
  text: string;
  border: string;
  hover: string;
}

export const MODE_LABELS: Record<ChatMode, { label: string; icon: string; description: string; theme: ModeTheme }> = {
  operacao: {
    label: 'Modo Operação',
    icon: '🛻',
    description: 'Direto, linguagem de campo, foco na linha de frente',
    theme: {
      bg: 'bg-[#8B4513]',
      text: 'text-[#FFD700]',
      border: 'border-orange-500',
      hover: 'hover:bg-[#A0522D]',
    },
  },
  diretoria: {
    label: 'Modo Diretoria',
    icon: '✈️',
    description: 'Executivo, estratégico e pronto para o board',
    theme: {
      bg: 'bg-[#1a365d]',
      text: 'text-[#63b3ed]',
      border: 'border-blue-500',
      hover: 'hover:bg-[#2c5282]',
    },
  },
};

