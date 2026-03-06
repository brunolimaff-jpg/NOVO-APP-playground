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
      clientLookup: false,
    });
  });

  it('unlocks restricted features for bruno users', () => {
    const access = getFeatureAccessForUser({ displayName: 'Bruno', email: 'bruno@empresa.com', id: '', isGuest: false });
    expect(access).toEqual({
      miniCRM: true,
      dashboard: true,
      integrityCheck: true,
      clientLookup: true,
    });
  });

  it('matches MVP lookup access cases from requirements', () => {
    expect(
      getFeatureAccessForUser({
        displayName: 'Bruno Lima',
        email: 'brunolff@hotmail.com',
        id: '',
        isGuest: false,
      }).clientLookup,
    ).toBe(true);

    expect(
      getFeatureAccessForUser({
        displayName: 'João Silva',
        email: 'joao@senior.com.br',
        id: '',
        isGuest: false,
      }).clientLookup,
    ).toBe(false);

    expect(getFeatureAccessForUser(null).clientLookup).toBe(false);
  });

  it('keeps all restricted features disabled for guest-like users', () => {
    const access = getFeatureAccessForUser({
      displayName: 'Visitante',
      email: '',
      id: 'guest',
      isGuest: true,
    });
    expect(access).toEqual({
      miniCRM: false,
      dashboard: false,
      integrityCheck: false,
      clientLookup: false,
    });
  });
});
