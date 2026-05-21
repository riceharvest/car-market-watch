import { betterAuth } from 'better-auth';
import type { ApiAuthBoundary } from './contracts';

type BetterAuthOptions = Parameters<typeof betterAuth>[0] & { database?: unknown };

export type BetterAuthFactoryEnv = {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  NODE_ENV?: string;
};

export type BetterAuthFactoryOptions = {
  env?: BetterAuthFactoryEnv;
  adapter?: unknown;
  betterAuth?: (options: BetterAuthOptions) => unknown;
};

export type ResolveApiAuthOptions = {
  /** Trusted server-side session lookup, e.g. backed by Better Auth. */
  getSession?: (request: Request) => Promise<unknown> | unknown;
  /** Explicit trusted infrastructure/header boundary; never inferred from browser query params. */
  trustedUserIdHeader?: string | string[];
  trustedRoleHeader?: string;
};

/**
 * Better Auth integration boundary.
 *
 * Install `better-auth` and pass its `betterAuth` factory here from server-only code,
 * or replace this stub with a direct import once the runtime package is wired.
 */
export function createAuth(options: BetterAuthFactoryOptions = {}): unknown {
  const env = options.env ?? process.env;
  if (env.NODE_ENV === 'production' && !env.BETTER_AUTH_SECRET?.trim()) {
    throw new Error('BETTER_AUTH_SECRET is required in production');
  }
  if (env.NODE_ENV === 'production' && !env.BETTER_AUTH_URL?.trim()) {
    throw new Error('BETTER_AUTH_URL is required in production');
  }

  const config: BetterAuthOptions = {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: options.adapter,
  };

  return (options.betterAuth ?? betterAuth)(config);
}

export function getAuth(): unknown {
  return createAuth();
}

export async function resolveApiAuth(
  request: Request,
  options: ResolveApiAuthOptions = {},
): Promise<ApiAuthBoundary | null> {
  const sessionUserId = extractUserIdFromSession(await options.getSession?.(request));
  if (sessionUserId) {
    return { userId: sessionUserId, role: 'owner' };
  }

  const trustedHeaderUserId = extractTrustedHeaderUserId(request, options.trustedUserIdHeader);
  if (trustedHeaderUserId) {
    return { userId: trustedHeaderUserId, role: extractTrustedRole(request, options.trustedRoleHeader) };
  }

  // Deliberately ignore URL/search params such as ?userId=. Browser-controlled identity
  // must never cross the API boundary unless a trusted server dependency supplies it.
  return null;
}

function extractTrustedHeaderUserId(request: Request, trustedUserIdHeader: string | string[] | undefined): string | undefined {
  if (!trustedUserIdHeader) return undefined;

  const headers = Array.isArray(trustedUserIdHeader) ? trustedUserIdHeader : [trustedUserIdHeader];
  for (const header of headers) {
    const value = request.headers.get(header)?.trim();
    if (value) return value;
  }

  return undefined;
}

function extractTrustedRole(request: Request, trustedRoleHeader: string | undefined): ApiAuthBoundary['role'] {
  const value = trustedRoleHeader ? request.headers.get(trustedRoleHeader)?.trim() : undefined;
  return value === 'viewer' ? 'viewer' : 'owner';
}

function extractUserIdFromSession(session: unknown): string | undefined {
  if (!session || typeof session !== 'object') return undefined;

  const candidate = session as {
    userId?: unknown;
    user?: { id?: unknown };
    session?: { userId?: unknown };
  };

  for (const value of [candidate.userId, candidate.user?.id, candidate.session?.userId]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return undefined;
}
