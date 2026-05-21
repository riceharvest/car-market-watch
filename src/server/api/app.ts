import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleListListings, type ListingsApiDeps } from './listings';

export type ApiAppDeps = ListingsApiDeps & {
  allowedOrigins?: string[];
};

const LOCALHOST_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function createApiApp(deps: ApiAppDeps): Hono {
  const app = new Hono();
  const allowedOrigins = new Set([...LOCALHOST_ORIGINS, ...(deps.allowedOrigins ?? [])]);

  app.use(
    '/api/*',
    cors({
      origin: (origin) => (allowedOrigins.has(origin) ? origin : ''),
      allowMethods: ['GET', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.get('/api/listings', (c) => handleListListings(c, deps));

  return app;
}
