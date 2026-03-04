import { useState, useEffect, useRef, useCallback } from 'react';
import { get, set } from 'idb-keyval';
import { ChatSession } from '../types';
import { cleanStatusMarkers } from '../utils/textCleaners';

const SESSIONS_IDB_KEY = 'scout360_sessions_v2';
const SESSIONS_LEGACY_KEY = 'scout360_sessions_v1';

export function useSessionStorage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const sessionsRef = useRef<ChatSession[]>([]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const loadSessions = useCallback(async (): Promise<ChatSession[]> => {
    try {
      const idbSessions = await get<ChatSession[]>(SESSIONS_IDB_KEY);
      if (idbSessions && idbSessions.length > 0) return idbSessions;
    } catch {
      // IndexedDB unavailable, try localStorage fallback
    }

    try {
      const raw = localStorage.getItem(SESSIONS_LEGACY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.map((s: Record<string, unknown>) => ({
          ...s,
          messages: ((s.messages as Array<Record<string, unknown>>) || []).map((m) => ({
            ...m,
            text: cleanStatusMarkers(String(m.text || '')).cleanText,
            timestamp: new Date(m.timestamp as string),
          })),
        })) as ChatSession[];
      }
    } catch (e) {
      console.error('Session load error', e);
    }

    return [];
  }, []);

  const persistSessions = useCallback(async (data: ChatSession[]) => {
    try {
      await set(SESSIONS_IDB_KEY, data);
    } catch {
      try {
        localStorage.setItem(SESSIONS_LEGACY_KEY, JSON.stringify(data));
      } catch (e: unknown) {
        const storageErr = e as { name?: string; code?: number };
        if (storageErr?.name === 'QuotaExceededError' || storageErr?.code === 22) {
          console.warn('[Storage] Quota exceeded — trimming oldest sessions');
          const trimmed = data.slice(0, Math.max(data.length - 5, 1));
          localStorage.setItem(SESSIONS_LEGACY_KEY, JSON.stringify(trimmed));
        }
      }
    }
  }, []);

  useEffect(() => {
    if (isInitialized && sessions.length >= 0) {
      persistSessions(sessions);
    }
  }, [sessions, isInitialized, persistSessions]);

  return {
    sessions,
    setSessions,
    sessionsRef,
    isInitialized,
    setIsInitialized,
    loadSessions,
  };
}
