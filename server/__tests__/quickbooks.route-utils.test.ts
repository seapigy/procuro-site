import axios from 'axios';
import { __quickbooksTestUtils } from '../src/routes/quickbooks';

describe('QuickBooks route utilities', () => {
  it('creates and consumes oauth state exactly once', () => {
    const state = __quickbooksTestUtils.buildOAuthState('connect', 'invite-token-123');
    const parsed = __quickbooksTestUtils.consumeOAuthState(state);
    expect(parsed.mode).toBe('connect');
    expect(parsed.inviteToken).toBe('invite-token-123');
    expect(() => __quickbooksTestUtils.consumeOAuthState(state)).toThrow(/already used|not found/i);
  });

  it('rejects malformed oauth state', () => {
    expect(() => __quickbooksTestUtils.consumeOAuthState('bad-state')).toThrow(/invalid/i);
  });

  it('detects invalid-token axios errors for retry logic', () => {
    const err = new axios.AxiosError(
      'Unauthorized',
      '401',
      undefined,
      undefined,
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'www-authenticate': 'Bearer realm="Intuit", error="invalid_token"' },
        config: {},
        data: {},
      } as any
    );
    expect(__quickbooksTestUtils.isTokenExpiredError(err)).toBe(true);
    expect(__quickbooksTestUtils.isTokenExpiredError(new Error('other'))).toBe(false);
  });
});
