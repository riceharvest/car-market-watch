import { describe, expect, it } from 'vitest';
import { evaluateAccessRequest, resolveConfiguredAccessPassword } from '../src/server/accessGate';

describe('private access gate', () => {
  it('allows requests when no access password is configured', () => {
    const decision = evaluateAccessRequest({ method: 'GET', pathname: '/', cookieHeader: '' }, undefined);

    expect(decision.kind).toBe('allow');
  });

  it('challenges every route including data chunks when the access cookie is missing', () => {
    const decision = evaluateAccessRequest({ method: 'GET', pathname: '/data/chunks/listings-000.json', cookieHeader: '' }, 'test-password');

    expect(decision.kind).toBe('challenge');
  });

  it('allows protected routes when the access cookie matches the configured password', () => {
    const decision = evaluateAccessRequest({ method: 'GET', pathname: '/', cookieHeader: 'cmw_access=test-password' }, 'test-password');

    expect(decision.kind).toBe('allow');
  });

  it('sets an http-only access cookie after the password form posts the configured password', () => {
    const decision = evaluateAccessRequest({ method: 'POST', pathname: '/access', cookieHeader: '', submittedPassword: 'test-password' }, 'test-password');

    expect(decision.kind).toBe('grant');
    expect(decision.cookie).toContain('cmw_access=test-password');
    expect(decision.cookie).toContain('HttpOnly');
    expect(decision.cookie).toContain('Secure');
    expect(decision.cookie).toContain('SameSite=Lax');
  });

  it('fails closed on Vercel when ACCESS_PASSWORD is missing', () => {
    const password = resolveConfiguredAccessPassword({ VERCEL: '1' });
    const decision = evaluateAccessRequest({ method: 'GET', pathname: '/', cookieHeader: '' }, password);

    expect(decision.kind).toBe('challenge');
  });

  it('rejects an incorrect submitted password without setting a cookie', () => {
    const decision = evaluateAccessRequest({ method: 'POST', pathname: '/access', cookieHeader: '', submittedPassword: 'wrong' }, 'test-password');

    expect(decision.kind).toBe('reject');
  });
});
