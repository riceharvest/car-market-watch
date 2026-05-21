import type { Context } from 'hono';
import { normalizeListingQuery, type ApiAuthBoundary, type ListingsQuery, type PaginatedListingsResponse } from '../contracts';

export type ListingsRepository = {
  listListings(query: ListingsQuery, auth: ApiAuthBoundary): Promise<PaginatedListingsResponse> | PaginatedListingsResponse;
};

export type AuthResolver = (request: Request, context: Context) => ApiAuthBoundary | null | undefined | Promise<ApiAuthBoundary | null | undefined>;

export type ListingsApiDeps = ListingsRepository & {
  getAuth: AuthResolver;
};

export async function handleListListings(c: Context, deps: ListingsApiDeps): Promise<Response> {
  const auth = await deps.getAuth(c.req.raw, c);

  if (!auth) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required to list market listings.',
        },
      },
      401,
    );
  }

  const query = normalizeListingQuery(c.req.query());
  const response = await deps.listListings(query, auth);

  return c.json(response);
}
