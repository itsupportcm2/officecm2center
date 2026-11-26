const routeLoaders = new Map<string, () => Promise<unknown>>([
  ["/", () => import("../pages/DashboardPage")],
  ["/inventory", () => import("../pages/InventoryPage")],
  ["/stock-in", () => import("../pages/StockFormPage")],
  ["/stock-out", () => import("../pages/StockFormPage")],
  ["/stock-adjust", () => import("../pages/StockFormPage")],
  ["/stock-transfer", () => import("../pages/StockFormPage")],
  ["/history", () => import("../pages/StockHistoryPage")],
  ["/low-stock", () => import("../pages/LowStockPage")],
  ["/categories", () => import("../pages/MasterDataPages")],
  ["/locations", () => import("../pages/MasterDataPages")],
  ["/reports", () => import("../pages/ReportsPage")],
  ["/users", () => import("../pages/AdminPages")],
  ["/settings", () => import("../pages/AdminPages")],
  ["/renewals", () => import("../pages/RenewalsPage")],
  ["/audit-log", () => import("../pages/AuditLogPage")],
  ["/data-tools", () => import("../pages/DataToolsPage")],
  ["/stock-control", () => import("../pages/StockControlPage")],
  ["/purchase-requests", () => import("../pages/PurchaseRequestsPage")],
  ["/issue-requests", () => import("../pages/IssueRequestsPage")],
  ["/my-issue-requests", () => import("../pages/IssueRequestsPage")],
  ["/fulfillment", () => import("../pages/FulfillmentPage")],
  ["/migrant-workers", () => import("../pages/MigrantWorkerDocumentsPage")],
  ["/migrant-dashboard", () => import("../pages/MigrantDashboardPage")],
]);

const prefetchedLoaders = new Set<() => Promise<unknown>>();

/** Preload the lazy page chunk matching a sidebar href at most once on hover or focus. */
export function prefetchRoute(path: string): void {
  const cleanPath = path.split("?")[0].split("#")[0];
  const loader = routeLoaders.get(cleanPath);
  if (!loader || prefetchedLoaders.has(loader)) return;
  prefetchedLoaders.add(loader);
  void loader().catch(() => {
    prefetchedLoaders.delete(loader);
  });
}
