import { describe, expect, it, vi } from 'vitest';
import { createApiApp } from '../src/server/api/app';
import type { ApiAuthBoundary, PaginatedListingsResponse } from '../src/server/contracts';

const auth: ApiAuthBoundary = { userId: 'user-1', role: 'owner' };

function emptyListingsResponse(overrides: Partial<PaginatedListingsResponse> = {}): PaginatedListingsResponse {
  return {
    data: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
    generatedAt: '2026-05-21T00:00:00.000Z',
    filters: {},
    sort: { field: 'lastSeen', direction: 'desc' },
    ...overrides,
  };
}

describe('listings API boundary', () => {
  it('returns 401 JSON when auth is missing', async () => {
    const listListings = vi.fn();
    const app = createApiApp({
      getAuth: () => null,
      listListings,
    });

    const response = await app.request('/api/listings');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'UNAUTHORIZED', message: expect.any(String) },
    });
    expect(listListings).not.toHaveBeenCalled();
  });

  it('normalizes query params and delegates authenticated listing reads to the repository', async () => {
    const expectedResponse = emptyListingsResponse({
      pageSize: 100,
      filters: { make: 'Toyota' },
      sort: { field: 'priceEur', direction: 'asc' },
    });
    const listListings = vi.fn().mockResolvedValue(expectedResponse);
    const app = createApiApp({
      getAuth: () => auth,
      listListings,
    });

    const response = await app.request('/api/listings?pageSize=999&sort=priceEur&direction=asc&make=Toyota');

    expect(response.status).toBe(200);
    expect(listListings).toHaveBeenCalledOnce();
    expect(listListings).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 100,
        filters: expect.objectContaining({ make: 'Toyota' }),
        sort: { field: 'priceEur', direction: 'asc' },
      }),
      auth,
    );
    await expect(response.json()).resolves.toEqual(expectedResponse);
  });

  it('handles CORS preflight for listings without a 404', async () => {
    const app = createApiApp({
      getAuth: () => null,
      listListings: vi.fn(),
    });

    const response = await app.request('/api/listings', { method: 'OPTIONS' });

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(400);
  });
});
