export const dashboardDisplayLimits = {
  purchaseRows: 100,
  listingCards: 60,
  analystRows: 100,
  chartRows: 40,
} as const;

export type LimitedDashboardRows<T> = {
  purchaseRows: T[];
  listingCards: T[];
  analystRows: T[];
  chartRows: T[];
  isTruncated: boolean;
  hiddenPurchaseRowCount: number;
  hiddenListingCardCount: number;
  hiddenAnalystRowCount: number;
  hiddenChartRowCount: number;
};

export function limitDashboardRows<T>(rows: readonly T[]): LimitedDashboardRows<T> {
  return {
    purchaseRows: rows.slice(0, dashboardDisplayLimits.purchaseRows),
    listingCards: rows.slice(0, dashboardDisplayLimits.listingCards),
    analystRows: rows.slice(0, dashboardDisplayLimits.analystRows),
    chartRows: rows.slice(0, dashboardDisplayLimits.chartRows),
    isTruncated: rows.length > dashboardDisplayLimits.listingCards,
    hiddenPurchaseRowCount: Math.max(0, rows.length - dashboardDisplayLimits.purchaseRows),
    hiddenListingCardCount: Math.max(0, rows.length - dashboardDisplayLimits.listingCards),
    hiddenAnalystRowCount: Math.max(0, rows.length - dashboardDisplayLimits.analystRows),
    hiddenChartRowCount: Math.max(0, rows.length - dashboardDisplayLimits.chartRows),
  };
}
