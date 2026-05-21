export type DatabaseConfigEnv = {
  DATABASE_URL?: string;
  DATABASE_SSL?: string;
  NODE_ENV?: string;
  INGESTION_DB_MODE?: string;
  WORKER_DB_MODE?: string;
};

export type DatabaseConfig = {
  url?: string;
  ssl: boolean;
  host?: string;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const SSL_DISABLED_VALUES = new Set(['0', 'false', 'no', 'disable', 'disabled', 'off']);
const SSL_ENABLED_VALUES = new Set(['1', 'true', 'yes', 'require', 'required', 'on']);
const DATABASE_BACKED_MODES = new Set(['db', 'database', 'postgres', 'postgresql', 'neon']);

export function getDatabaseConfig(env: DatabaseConfigEnv = process.env): DatabaseConfig {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    if (requiresDatabaseUrl(env)) {
      throw new Error('DATABASE_URL is required when running in production or database-backed worker mode');
    }

    return { ssl: false };
  }

  const parsed = parseDatabaseUrl(databaseUrl);
  const explicitSsl = parseExplicitSsl(env.DATABASE_SSL);

  return {
    url: databaseUrl,
    host: parsed.hostname,
    ssl: explicitSsl ?? shouldRequireSsl(parsed.hostname),
  };
}

function requiresDatabaseUrl(env: DatabaseConfigEnv): boolean {
  if (env.NODE_ENV === 'production') return true;

  return [env.INGESTION_DB_MODE, env.WORKER_DB_MODE]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase())
    .some((value) => DATABASE_BACKED_MODES.has(value));
}

function parseDatabaseUrl(databaseUrl: string): URL {
  try {
    return new URL(databaseUrl);
  } catch (error) {
    throw new Error(`DATABASE_URL must be a valid Postgres URL: ${(error as Error).message}`);
  }
}

function parseExplicitSsl(value: string | undefined): boolean | undefined {
  if (!value) return undefined;

  const normalized = value.trim().toLowerCase();
  if (SSL_DISABLED_VALUES.has(normalized)) return false;
  if (SSL_ENABLED_VALUES.has(normalized)) return true;

  throw new Error('DATABASE_SSL must be one of: true, false, require, disable');
}

function shouldRequireSsl(hostname: string): boolean {
  return !LOCAL_HOSTS.has(hostname.toLowerCase());
}
