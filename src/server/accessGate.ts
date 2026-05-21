export type AccessRequestInput = {
  method: string;
  pathname: string;
  cookieHeader?: string | null;
  submittedPassword?: string | null;
};

export type AccessDecision =
  | { kind: 'allow' }
  | { kind: 'challenge'; status: 401 }
  | { kind: 'reject'; status: 401 }
  | { kind: 'grant'; status: 303; location: string; cookie: string };

export const accessCookieName = 'cmw_access';

export function evaluateAccessRequest(input: AccessRequestInput, configuredPassword?: string | null): AccessDecision {
  const password = configuredPassword?.trim();
  if (!password) return { kind: 'allow' };

  if (input.method.toUpperCase() === 'POST' && input.pathname === '/access') {
    if (input.submittedPassword === password) {
      return {
        kind: 'grant',
        status: 303,
        location: '/',
        cookie: buildAccessCookie(password),
      };
    }
    return { kind: 'reject', status: 401 };
  }

  if (readCookie(input.cookieHeader, accessCookieName) === password) return { kind: 'allow' };

  return { kind: 'challenge', status: 401 };
}

export const missingVercelAccessPassword = '__ACCESS_PASSWORD_NOT_CONFIGURED__';

export function resolveConfiguredAccessPassword(env: Pick<NodeJS.ProcessEnv, 'ACCESS_PASSWORD' | 'VERCEL' | 'VERCEL_ENV'>): string | undefined {
  const configured = env.ACCESS_PASSWORD?.trim();
  if (configured) return configured;
  return env.VERCEL || env.VERCEL_ENV ? missingVercelAccessPassword : undefined;
}

function buildAccessCookie(password: string): string {
  return `${accessCookieName}=${encodeURIComponent(password)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const cookie of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName !== name) continue;
    return decodeURIComponent(rawValue.join('='));
  }
  return undefined;
}
