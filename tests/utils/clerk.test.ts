import { describe, expect, it } from 'vitest';
import {
  deriveClerkPublishableKey,
  isUsableClerkPublishableKey,
  normalizeClerkFrontendApiUrl,
  resolveClerkPublishableKey,
} from '../../utils/clerk';

describe('clerk helpers', () => {
  it('normalizes a frontend api url to the host', () => {
    expect(normalizeClerkFrontendApiUrl('https://tough-kiwi-91.clerk.accounts.dev/')).toBe(
      'tough-kiwi-91.clerk.accounts.dev',
    );
  });

  it('derives a test publishable key from a clerk accounts.dev host', () => {
    const key = deriveClerkPublishableKey('https://tough-kiwi-91.clerk.accounts.dev');

    expect(key).toMatch(/^pk_test_/);
    expect(key).toBe(resolveClerkPublishableKey({ frontendApiUrl: 'https://tough-kiwi-91.clerk.accounts.dev' }));
  });

  it('rejects the placeholder publishable key', () => {
    expect(isUsableClerkPublishableKey('pk_test_your_clerk_key_here')).toBe(false);
  });

  it('prefers a real publishable key when provided', () => {
    const realKey = 'pk_test_ZmFrZS5jbGVyay5hY2NvdW50cy5kZXYk';

    expect(
      resolveClerkPublishableKey({
        publishableKey: realKey,
        frontendApiUrl: 'https://tough-kiwi-91.clerk.accounts.dev',
      }),
    ).toBe(realKey);
  });
});
