const DEFAULT_GEMINI_MODEL = 'gemini-3.1-pro-preview';

export const MODEL_IDS = {
  router: import.meta.env.VITE_ROUTER_MODEL || DEFAULT_GEMINI_MODEL,
  tactical: import.meta.env.VITE_TACTICAL_MODEL || DEFAULT_GEMINI_MODEL,
  deepChat: import.meta.env.VITE_DEEP_CHAT_MODEL || DEFAULT_GEMINI_MODEL,
  deepResearch: import.meta.env.VITE_DEEP_RESEARCH_MODEL || DEFAULT_GEMINI_MODEL,
} as const;
