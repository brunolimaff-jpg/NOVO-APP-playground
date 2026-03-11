import { AuthUser } from '../contexts/AuthContext';

export interface UserFeatureAccess {
  miniCRM: boolean;
  dashboard: boolean;
  integrityCheck: boolean;
  clientLookup: boolean;
  deepDive: boolean;
  warRoom: boolean;
}

const MVP_LOCK_RESTRICTED_FEATURES = true;
const ADMIN_IDENTIFIER = 'admin';

const FULL_ACCESS: UserFeatureAccess = {
  miniCRM: true,
  dashboard: true,
  integrityCheck: true,
  clientLookup: true,
  deepDive: true,
  warRoom: true,
};

function normalizeValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function extractIdentifiers(user: Pick<AuthUser, 'displayName' | 'email'> | null): Set<string> {
  const identifiers = new Set<string>();
  if (!user) return identifiers;

  const normalizedName = normalizeValue(user.displayName || '');
  if (normalizedName) {
    identifiers.add(normalizedName);
    const firstName = normalizedName.split(/\s+/)[0];
    if (firstName) identifiers.add(firstName);
  }

  const normalizedEmail = normalizeValue(user.email || '');
  if (normalizedEmail) {
    identifiers.add(normalizedEmail);
    const emailPrefix = normalizedEmail.split('@')[0];
    if (emailPrefix) identifiers.add(emailPrefix);
  }

  return identifiers;
}

export function isAdminUser(user: Pick<AuthUser, 'displayName' | 'email'> | null): boolean {
  return extractIdentifiers(user).has(ADMIN_IDENTIFIER);
}

export function getFeatureAccessForUser(user: Pick<AuthUser, 'displayName' | 'email'> | null): UserFeatureAccess {
  if (!MVP_LOCK_RESTRICTED_FEATURES) return FULL_ACCESS;
  const hasRestrictedAccess = isAdminUser(user);
  return {
    miniCRM: hasRestrictedAccess,
    dashboard: hasRestrictedAccess,
    integrityCheck: hasRestrictedAccess,
    clientLookup: hasRestrictedAccess,
    deepDive: hasRestrictedAccess,
    warRoom: hasRestrictedAccess,
  };
}
