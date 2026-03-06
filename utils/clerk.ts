const CLERK_PLACEHOLDER_PATTERN = /your_clerk_key_here/i;

function encodeBase64(value: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(value);
  }

  return Buffer.from(value, 'utf8').toString('base64');
}

export function normalizeClerkFrontendApiUrl(frontendApiUrl?: string): string | null {
  if (!frontendApiUrl) return null;

  const normalized = frontendApiUrl
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .replace(/\/.*$/, '');

  return normalized || null;
}

export function deriveClerkPublishableKey(frontendApiUrl?: string): string | null {
  const normalizedHost = normalizeClerkFrontendApiUrl(frontendApiUrl);
  if (!normalizedHost) return null;

  const environmentPrefix = normalizedHost.endsWith('.accounts.dev') ? 'pk_test_' : 'pk_live_';
  return `${environmentPrefix}${encodeBase64(`${normalizedHost}$`)}`;
}

export function isUsableClerkPublishableKey(publishableKey?: string): boolean {
  if (!publishableKey) return false;

  const trimmed = publishableKey.trim();
  return /^pk_(test|live)_/.test(trimmed) && !CLERK_PLACEHOLDER_PATTERN.test(trimmed);
}

export function resolveClerkPublishableKey({
  publishableKey,
  frontendApiUrl,
}: {
  publishableKey?: string;
  frontendApiUrl?: string;
}): string | null {
  if (isUsableClerkPublishableKey(publishableKey)) {
    return publishableKey!.trim();
  }

  return deriveClerkPublishableKey(frontendApiUrl);
}
