import { describe, expect, it } from 'vitest';
import { limitDashboardRows } from '../src/domain/dashboardDisplay';

describe('dashboard display limits', () => {
  const rows = Array.from({ length: 10_404 }, (_, index) => ({ id: String(index) }));

  it('caps heavy mobile dashboard sections instead of rendering every listing', () => {
    const limited = limitDashboardRows(rows);

    expect(limited.purchaseRows).toHaveLength(100);
    expect(limited.listingCards).toHaveLength(60);
    expect(limited.analystRows).toHaveLength(100);
    expect(limited.chartRows).toHaveLength(40);
  });

  it('preserves the sorted order from the filtered source rows', () => {
    const limited = limitDashboardRows(rows);

    expect(limited.purchaseRows.map((row) => row.id).slice(0, 3)).toEqual(['0', '1', '2']);
    expect(limited.chartRows.at(-1)?.id).toBe('39');
  });

  it('does not mark small filtered sets as truncated', () => {
    const limited = limitDashboardRows(rows.slice(0, 12));

    expect(limited.isTruncated).toBe(false);
    expect(limited.listingCards).toHaveLength(12);
    expect(limited.analystRows).toHaveLength(12);
  });

  it('reports truncation counts for large filtered sets', () => {
    const limited = limitDashboardRows(rows);

    expect(limited.isTruncated).toBe(true);
    expect(limited.hiddenListingCardCount).toBe(10_344);
    expect(limited.hiddenAnalystRowCount).toBe(10_304);
    expect(limited.hiddenPurchaseRowCount).toBe(10_304);
  });
});
