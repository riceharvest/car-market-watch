import postgres, { type Sql } from 'postgres';
import { getDatabaseConfig, type DatabaseConfigEnv } from './config';
import type { QueryExecutor, SQLStatement } from './sql';

export type PostgresExecutor = QueryExecutor & {
  close(): Promise<void>;
};

export function createPostgresExecutor(env: DatabaseConfigEnv = process.env): PostgresExecutor {
  const config = getDatabaseConfig(env);
  if (!config.url) {
    throw new Error('DATABASE_URL is required to create a Postgres executor');
  }

  const client = postgres(config.url, {
    ssl: config.ssl ? 'require' : false,
    max: 4,
  });

  return createPostgresExecutorFromClient(client);
}

export function createPostgresExecutorFromClient(client: Sql): PostgresExecutor {
  return {
    async execute<T = unknown>(statement: SQLStatement): Promise<T[]> {
      return (await client.unsafe(statement.text, statement.values as never[])) as T[];
    },
    async close(): Promise<void> {
      await client.end();
    },
  };
}
