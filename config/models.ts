const ROUTER_MODEL = 'gemini-3.1-flash-lite-preview';
const COMPAT_MODEL = 'gemini-3.1-pro-preview';

function pickModel(envValue: string | undefined, fallback: string): string {
  const value = (envValue || '').trim();
  if (!value) return fallback;

  // Defensive fallback: these IDs can fail in chat flow with
  // "This model only supports Interactions API".
  if (/^deep-research-/i.test(value)) return fallback;

  return value;
}

export const MODEL_IDS = {
  router: pickModel(import.meta.env.VITE_ROUTER_MODEL, ROUTER_MODEL),
  tactical: pickModel(import.meta.env.VITE_TACTICAL_MODEL, COMPAT_MODEL),
  deepChat: pickModel(import.meta.env.VITE_DEEP_CHAT_MODEL, COMPAT_MODEL),
  deepResearch: pickModel(import.meta.env.VITE_DEEP_RESEARCH_MODEL, COMPAT_MODEL),
} as const;
