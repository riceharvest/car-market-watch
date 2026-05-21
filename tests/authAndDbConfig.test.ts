import { describe, expect, it, vi } from 'vitest';
import { resolveApiAuth } from '../src/server/auth';
import { getDatabaseConfig } from '../src/server/db/config';

describe('getDatabaseConfig', () => {
  it('disables SSL for localhost DATABASE_URL values', () => {
    const config = getDatabaseConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5433/car_market_watch',
    });

    expect(config.ssl).toBe(false);
  });

  it('requires SSL for remote Neon-like DATABASE_URL values', () => {
    const config = getDatabaseConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@ep-example.us-east-2.aws.neon.tech/neondb',
    });

    expect(config.ssl).toBe(true);
  });

  it('throws in production when DATABASE_URL is missing', () => {
    expect(() => getDatabaseConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/i);
  });

  it('throws in database-backed ingestion mode when DATABASE_URL is missing', () => {
    expect(() => getDatabaseConfig({ NODE_ENV: 'development', INGESTION_DB_MODE: 'db' })).toThrow(/DATABASE_URL/i);
  });
});

describe('createAuth', () => {
  it('fails fast in production when Better Auth secrets are missing', async () => {
    const { createAuth } = await import('../src/server/auth');

    expect(() => createAuth({ env: { NODE_ENV: 'production' } })).toThrow(/BETTER_AUTH_SECRET/i);
  });
});

describe('resolveApiAuth', () => {
  it('ignores browser-supplied userId query params without a trusted source', async () => {
    const request = new Request('https://example.test/api/listings?userId=attacker');

    await expect(resolveApiAuth(request)).resolves.toBeNull();
  });

  it('uses trusted server-side session dependency when present', async () => {
    const request = new Request('https://example.test/api/listings?userId=attacker');

    const result = await resolveApiAuth(request, {
      getSession: vi.fn(async () => ({ user: { id: 'session-user' } })),
    });

    expect(result).toEqual({ userId: 'session-user', role: 'owner' });
  });

  it('uses explicitly configured trusted headers without reading query userId', async () => {
    const request = new Request('https://example.test/api/listings?userId=attacker', {
      headers: { 'x-trusted-user-id': 'edge-user', 'x-trusted-role': 'viewer' },
    });

    const result = await resolveApiAuth(request, {
      trustedUserIdHeader: 'x-trusted-user-id',
      trustedRoleHeader: 'x-trusted-role',
    });

    expect(result).toEqual({ userId: 'edge-user', role: 'viewer' });
  });
});
