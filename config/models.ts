export const MODEL_IDS = {
  router: import.meta.env.VITE_ROUTER_MODEL || 'gemini-2.5-flash',
  tactical: import.meta.env.VITE_TACTICAL_MODEL || 'gemini-2.5-flash',
  deepChat: import.meta.env.VITE_DEEP_CHAT_MODEL || 'gemini-3.1-pro-preview',
  deepResearch: import.meta.env.VITE_DEEP_RESEARCH_MODEL || 'gemini-3.1-pro-preview',
} as const;
