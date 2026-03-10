const ROUTER_MODEL = 'gemini-3.1-flash-lite-preview';
const DEEP_MODEL = 'deep-research-pro-preview-12-2025';

export const MODEL_IDS = {
  router: import.meta.env.VITE_ROUTER_MODEL || ROUTER_MODEL,
  tactical: import.meta.env.VITE_TACTICAL_MODEL || DEEP_MODEL,
  deepChat: import.meta.env.VITE_DEEP_CHAT_MODEL || DEEP_MODEL,
  deepResearch: import.meta.env.VITE_DEEP_RESEARCH_MODEL || DEEP_MODEL,
} as const;
