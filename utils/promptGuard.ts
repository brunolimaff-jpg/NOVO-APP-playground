/**
 * promptGuard.ts
 * Proteção contra Prompt Injection — 100% frontend, zero dependências externas.
 *
 * Camadas implementadas:
 *  1. Sanitização de Unicode suspeito (zero-width chars, homoglyphs comuns)
 *  2. Deny-list de padrões de ataque conhecidos (PT-BR + EN)
 *  3. Budget de tokens (limite de tamanho do input)
 *  4. Rate limiter por sessão (máx 30 msgs/min)
 *  5. Delimitadores estruturais (separa instrução de conteúdo do usuário)
 *  6. Canary token (detecta extração do system prompt)
 *  7. Sanitização de conteúdo externo (RAG / dossiês / páginas)
 *  8. Audit logger (localStorage, mantém últimas 200 entradas)
 */

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

export type ThreatLevel = 'safe' | 'suspicious' | 'blocked';

export interface GuardResult {
  level: ThreatLevel;
  /** Input original ou sanitizado (nunca bloqueado é retornado como-é) */
  sanitized: string;
  /** Razão do bloqueio / suspeita (undefined se safe) */
  reason?: string;
  /** Pontuação de risco 0-100 */
  riskScore: number;
}

export interface AuditEntry {
  ts: string;
  level: ThreatLevel;
  reason?: string;
  riskScore: number;
  inputSnippet: string;
}

// ─────────────────────────────────────────────
// CONFIGURAÇÃO
// ─────────────────────────────────────────────

const MAX_INPUT_CHARS = 8_000;        // ~2k tokens — acima disso é suspeito
const RATE_LIMIT_WINDOW_MS = 60_000;  // janela de 1 minuto
const RATE_LIMIT_MAX_MSGS = 30;       // mensagens permitidas por janela
const AUDIT_KEY = 'scout360_guard_audit_v1';
const AUDIT_MAX_ENTRIES = 200;

// ─────────────────────────────────────────────
// CANARY TOKEN
// Inserido no system prompt — se aparecer no output/input é sinal de leak.
// ─────────────────────────────────────────────

export const CANARY_TOKEN = '[[SCOUT_CANARY_7f3a9b]]';

/**
 * Verifica se o input do usuário contém o canary token
 * (indica tentativa de extração do system prompt).
 */
export function hasCanaryLeak(input: string): boolean {
  return input.includes(CANARY_TOKEN);
}

// ─────────────────────────────────────────────
// CAMADA 1 — Sanitização de Unicode suspeito
// ─────────────────────────────────────────────

/**
 * Remove caracteres Unicode que são usados para ofuscar ataques:
 * zero-width chars, bidirectional overrides, homoglyphs frequentes.
 */
export function sanitizeUnicode(text: string): string {
  return text
    // Zero-width e invisíveis
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]/g, '')
    // Bidirectional overrides (BiDi attack)
    .replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, '')
    // Tags Unicode (U+E0000–U+E007F) — usados para smuggling
    .replace(/[\uE0000-\uE007F]/g, '')
    // Substitui variantes de aspas/traços por ASCII equivalente
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .trim();
}

// ─────────────────────────────────────────────
// CAMADA 2 — Deny-list de padrões de ataque
// ─────────────────────────────────────────────

interface AttackPattern {
  pattern: RegExp;
  weight: number;   // contribuição para riskScore (0-100)
  label: string;
}

const ATTACK_PATTERNS: AttackPattern[] = [
  // ── Jailbreak clássico (EN) ──────────────────
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|prompts?)/i, weight: 90, label: 'jailbreak:ignore-previous' },
  { pattern: /you\s+are\s+now\s+(a|an|the)?\s*\[?[A-Za-z]/i, weight: 80, label: 'jailbreak:role-reassign' },
  { pattern: /forget\s+(everything|all|your|the)\s+(instructions?|rules?|training|context)/i, weight: 85, label: 'jailbreak:forget' },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above|your)/i, weight: 85, label: 'jailbreak:disregard' },
  { pattern: /act\s+as\s+if\s+you\s+(have\s+no|don.t\s+have|without)/i, weight: 75, label: 'jailbreak:act-as' },
  { pattern: /do\s+anything\s+now|DAN\s+mode|developer\s+mode/i, weight: 90, label: 'jailbreak:DAN' },
  { pattern: /\bDAN\b.*\bjailbreak\b|\bjailbreak\b.*\bDAN\b/i, weight: 95, label: 'jailbreak:DAN-explicit' },
  { pattern: /new\s+instruction[s]?\s*:/i, weight: 80, label: 'injection:new-instruction' },
  { pattern: /system\s*:\s*you\s+are/i, weight: 85, label: 'injection:fake-system' },

  // ── Jailbreak em Português ───────────────────
  { pattern: /ignore\s+(todas?\s+as?\s+)?(instru[çc][õo]es?|regras?|contexto)\s*(anteriores?|acima|anteriores)/i, weight: 90, label: 'jailbreak:pt-ignore' },
  { pattern: /esque[çc][ae]\s+(tudo|todas?|suas?)\s*(instru[çc][õo]es?|regras?|treinamento)/i, weight: 85, label: 'jailbreak:pt-forget' },
  { pattern: /voc[eê]\s+agora\s+[eé]\s+(um|uma)?/i, weight: 80, label: 'jailbreak:pt-role-reassign' },
  { pattern: /nova[s]?\s+instru[çc][õo]es?\s*:/i, weight: 80, label: 'injection:pt-new-instruction' },
  { pattern: /finja\s+que\s+(voc[eê]\s+[eé]|n[aã]o\s+tem)/i, weight: 75, label: 'jailbreak:pt-finja' },
  { pattern: /desconsider[ea]\s+(o\s+contexto|as\s+instru)/i, weight: 80, label: 'jailbreak:pt-disregard' },

  // ── Extração de system prompt ─────────────────
  { pattern: /repeat\s+(your\s+)?(system\s+)?instructions?\s+(verbatim|exactly|word\s+for\s+word)/i, weight: 95, label: 'extraction:system-prompt' },
  { pattern: /print\s+(the\s+)?(full\s+)?(system\s+)?prompt/i, weight: 90, label: 'extraction:print-prompt' },
  { pattern: /what\s+(are|were|is)\s+your\s+(initial\s+)?(system\s+)?instructions/i, weight: 85, label: 'extraction:what-instructions' },
  { pattern: /mostre?\s+(as?|o)\s+(seu|suas?)\s*(prompt|instru[çc][õo]es?|sistema)/i, weight: 90, label: 'extraction:pt-show-prompt' },
  { pattern: /repita\s+(as?|o)\s*(instru[çc][õo]es?|prompt|sistema)/i, weight: 90, label: 'extraction:pt-repeat' },
  { pattern: /revele?\s+(o\s+)?(prompt|segredo|chave\s+de\s+api|api.key)/i, weight: 95, label: 'extraction:reveal-secret' },

  // ── Injeção via dados externos (indireta) ─────
  { pattern: /\[SYSTEM\]/i, weight: 70, label: 'injection:fake-system-tag' },
  { pattern: /<\s*system\s*>/i, weight: 75, label: 'injection:system-xml-tag' },
  { pattern: /```\s*(system|instructions?)\s*\n/i, weight: 70, label: 'injection:code-block-system' },
  { pattern: /---+\s*\n\s*(system|instru[çc][õo]es?)/i, weight: 65, label: 'injection:hr-system' },

  // ── Exfiltração de dados ──────────────────────
  { pattern: /send\s+(all\s+)?(conversation|history|context)\s+to/i, weight: 85, label: 'exfil:send-data' },
  { pattern: /http[s]?:\/\/(?!senior\.com\.br|gatec\.com\.br|gov\.br)[^\s]{0,200}\?.*=.*\{/i, weight: 70, label: 'exfil:suspicious-url-with-template' },

  // ── Manipulação de ferramentas/funções ────────
  { pattern: /call\s+(the\s+)?(function|tool|api)\s+["']?\w+["']?\s+with/i, weight: 65, label: 'tool-hijack:call-function' },
  { pattern: /execute\s+(the\s+)?(following\s+)?(code|script|command)/i, weight: 70, label: 'tool-hijack:execute-code' },
];

/**
 * Pontua o input contra os padrões de ataque.
 * Retorna o maior peso encontrado e o label correspondente.
 */
function scoreAttackPatterns(text: string): { maxWeight: number; label: string | undefined } {
  let maxWeight = 0;
  let label: string | undefined;

  for (const { pattern, weight, label: l } of ATTACK_PATTERNS) {
    if (pattern.test(text)) {
      if (weight > maxWeight) {
        maxWeight = weight;
        label = l;
      }
    }
  }

  return { maxWeight, label };
}

// ─────────────────────────────────────────────
// CAMADA 3 — Budget de tokens (tamanho)
// ─────────────────────────────────────────────

function checkBudget(text: string): { exceeded: boolean; riskScore: number } {
  if (text.length > MAX_INPUT_CHARS) {
    const excess = text.length - MAX_INPUT_CHARS;
    const riskScore = Math.min(60 + Math.floor(excess / 1000) * 5, 80);
    return { exceeded: true, riskScore };
  }
  return { exceeded: false, riskScore: 0 };
}

// ─────────────────────────────────────────────
// CAMADA 4 — Rate limiter (persistido em localStorage)
// ─────────────────────────────────────────────

const RATE_BUCKET_KEY = 'scout360_rate_bucket_v1';

function loadRateBucket(): number[] {
  try {
    const raw = localStorage.getItem(RATE_BUCKET_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRateBucket(bucket: number[]): void {
  try {
    localStorage.setItem(RATE_BUCKET_KEY, JSON.stringify(bucket));
  } catch {
    // localStorage indisponível — ignora silenciosamente
  }
}

function checkRateLimit(): { blocked: boolean; reason?: string } {
  const now = Date.now();
  // Carrega bucket persistido e filtra timestamps fora da janela
  const bucket = loadRateBucket().filter(t => t > now - RATE_LIMIT_WINDOW_MS);
  if (bucket.length >= RATE_LIMIT_MAX_MSGS) {
    saveRateBucket(bucket); // persiste sem adicionar (já bloqueado)
    return { blocked: true, reason: 'rate_limit:exceeded' };
  }
  bucket.push(now);
  saveRateBucket(bucket);
  return { blocked: false };
}

// ─────────────────────────────────────────────
// CAMADA 8 — Audit logger
// ─────────────────────────────────────────────

function auditLog(entry: AuditEntry): void {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    const entries: AuditEntry[] = raw ? JSON.parse(raw) : [];
    entries.push(entry);
    // Mantém apenas as últimas N entradas
    const trimmed = entries.slice(-AUDIT_MAX_ENTRIES);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage indisponível — ignora silenciosamente
  }
}

export function getAuditLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearAuditLog(): void {
  try { localStorage.removeItem(AUDIT_KEY); } catch { /* ignore */ }
}

// ─────────────────────────────────────────────
// API PÚBLICA — scanInput
// ─────────────────────────────────────────────

/**
 * Ponto de entrada principal.
 * Chame antes de qualquer envio ao Gemini.
 *
 * @returns GuardResult com level, sanitized, reason e riskScore
 */
export function scanInput(rawInput: string): GuardResult {
  // 1. Sanitização Unicode
  const sanitized = sanitizeUnicode(rawInput);

  // 2. Canary leak (extração do system prompt)
  if (hasCanaryLeak(sanitized)) {
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      level: 'blocked',
      reason: 'extraction:canary-leak',
      riskScore: 100,
      inputSnippet: sanitized.slice(0, 120),
    };
    auditLog(entry);
    return { level: 'blocked', sanitized, reason: 'extraction:canary-leak', riskScore: 100 };
  }

  // 3. Rate limit
  const rate = checkRateLimit();
  if (rate.blocked) {
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      level: 'blocked',
      reason: rate.reason,
      riskScore: 100,
      inputSnippet: sanitized.slice(0, 120),
    };
    auditLog(entry);
    return { level: 'blocked', sanitized, reason: rate.reason, riskScore: 100 };
  }

  // 4. Budget
  const budget = checkBudget(sanitized);
  if (budget.exceeded) {
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      level: 'suspicious',
      reason: 'budget:input-too-large',
      riskScore: budget.riskScore,
      inputSnippet: sanitized.slice(0, 120),
    };
    auditLog(entry);
    return { level: 'suspicious', sanitized: sanitized.slice(0, MAX_INPUT_CHARS), reason: 'budget:input-too-large', riskScore: budget.riskScore };
  }

  // 5. Deny-list de padrões
  const { maxWeight, label } = scoreAttackPatterns(sanitized);

  if (maxWeight >= 80) {
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      level: 'blocked',
      reason: label,
      riskScore: maxWeight,
      inputSnippet: sanitized.slice(0, 120),
    };
    auditLog(entry);
    return { level: 'blocked', sanitized, reason: label, riskScore: maxWeight };
  }

  if (maxWeight >= 50) {
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      level: 'suspicious',
      reason: label,
      riskScore: maxWeight,
      inputSnippet: sanitized.slice(0, 120),
    };
    auditLog(entry);
    // Suspeito: passa sanitizado mas marcado
    return { level: 'suspicious', sanitized, reason: label, riskScore: maxWeight };
  }

  // 6. Safe
  return { level: 'safe', sanitized, riskScore: maxWeight };
}

// ─────────────────────────────────────────────
// CAMADA 7 — Sanitização de conteúdo externo
// (RAG, dossiês, páginas web injetadas no prompt)
// ─────────────────────────────────────────────

/**
 * Sanitiza texto que vem de fontes externas ANTES de injetar no prompt.
 * Remove tags de sistema falsas, zero-width chars e padrões de injeção indireta.
 */
export function sanitizeExternalContent(text: string): string {
  return text
    // Unicode
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]/g, '')
    .replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, '')
    .replace(/[\uE0000-\uE007F]/g, '')
    // Tags XML/HTML de sistema falsas
    .replace(/<\s*\/?\s*(system|instructions?|prompt|role)\s*[^>]*>/gi, '[REMOVED_TAG]')
    // Blocos de code fence com rótulo de sistema
    .replace(/```\s*(system|instructions?)\s*\n[\s\S]*?```/gi, '[REMOVED_CODE_BLOCK]')
    // Injeções via separador
    .replace(/---+\s*\n\s*(system|instru[çc][õo]es?|instructions?)/gi, '---')
    // Padrões de ignore clássicos
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?)/gi, '[FILTERED]')
    .replace(/ignore\s+(todas?\s+as?\s+)?(instru[çc][õo]es?|regras?)\s*(anteriores?|acima)/gi, '[FILTERED]')
    // Canary token (se vier de fonte externa, remove)
    .replace(/\[\[SCOUT_CANARY_[A-Za-z0-9_]+\]\]/g, '')
    .trim();
}

// ─────────────────────────────────────────────
// CAMADA 5 — Delimitadores estruturais
// ─────────────────────────────────────────────

/**
 * Envolve o input do usuário em delimitadores XML claros.
 * Usar ao montar o prompt final enviado ao modelo.
 *
 * Exemplo de uso:
 *   const safePrompt = wrapUserInput(guardResult.sanitized);
 *   // -> "<user_input>\n...\n</user_input>"
 */
export function wrapUserInput(sanitizedInput: string): string {
  return `<user_input>\n${sanitizedInput}\n</user_input>`;
}
