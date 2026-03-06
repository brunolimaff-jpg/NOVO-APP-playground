import { describe, expect, it } from 'vitest';
import { getFeatureAccessForUser, isBrunoUser } from '../../utils/featureAccess';

describe('featureAccess', () => {
  it('recognizes bruno by first name', () => {
    expect(isBrunoUser({ displayName: 'Bruno Lima', email: 'outro@empresa.com', id: '', isGuest: false })).toBe(true);
  });

  it('recognizes bruno by email prefix', () => {
    expect(isBrunoUser({ displayName: 'Usuário', email: 'bruno@empresa.com', id: '', isGuest: false })).toBe(true);
  });

  it('locks restricted features for non-bruno users', () => {
    const access = getFeatureAccessForUser({ displayName: 'Maria', email: 'maria@empresa.com', id: '', isGuest: false });
    expect(access).toEqual({
      miniCRM: false,
      dashboard: false,
      integrityCheck: false,
    });
  });

  it('unlocks restricted features for bruno users', () => {
    const access = getFeatureAccessForUser({ displayName: 'Bruno', email: 'bruno@empresa.com', id: '', isGuest: false });
    expect(access).toEqual({
      miniCRM: true,
      dashboard: true,
      integrityCheck: true,
    });
  });
});
