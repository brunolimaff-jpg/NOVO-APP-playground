export const DEFAULT_PINECONE_INDEX = 'scout-arsenal';
export const DEFAULT_PINECONE_DOCS_NAMESPACE = 'senior-erp-docs';

const PINECONE_INDEX_SECRET_PREFIX_RE = /^pcsk_/i;
const PINECONE_INDEX_NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i;

function normalizeEnvValue(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function resolvePineconeIndexName(
  candidate?: string | null,
  fallback: string = DEFAULT_PINECONE_INDEX,
): string {
  const normalized = normalizeEnvValue(candidate);

  if (!normalized) return fallback;
  if (PINECONE_INDEX_SECRET_PREFIX_RE.test(normalized)) return fallback;
  if (!PINECONE_INDEX_NAME_RE.test(normalized)) return fallback;

  return normalized;
}

export function didFallbackPineconeIndex(
  candidate?: string | null,
  fallback: string = DEFAULT_PINECONE_INDEX,
): boolean {
  const normalized = normalizeEnvValue(candidate);
  return !!normalized && resolvePineconeIndexName(normalized, fallback) !== normalized;
}

export function resolveOptionalNamespace(
  candidate?: string | null,
  fallback?: string,
): string | undefined {
  return normalizeEnvValue(candidate) ?? fallback;
}
