import type { AuthUser } from '../contexts/AuthContext';

const PRIVILEGED_USER_HINTS = ['bruno'];

function normalize(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

export function canAccessInternalTools(user: AuthUser | null): boolean {
  if (!user) return false;

  const name = normalize(user.displayName);
  const email = normalize(user.email);
  const emailLocalPart = email.includes('@') ? email.split('@')[0] : email;

  return PRIVILEGED_USER_HINTS.some(
    hint => name.includes(hint) || emailLocalPart.includes(hint)
  );
}
