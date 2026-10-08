import { lazy, Suspense, useEffect } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useStock } from "./store/StockContext";
import { useWebMcp } from "./hooks/useWebMcp";
import { useAuth } from "./store/AuthContext";
import type { Role } from "./types";

const AppLayout = lazy(() =>
  import("./components/AppLayout").then((module) => ({
    default: module.AppLayout,
  })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const InventoryPage = lazy(() =>
  import("./pages/InventoryPage").then((module) => ({
    default: module.InventoryPage,
  })),
);
const ItemDetailPage = lazy(() =>
  import("./pages/ItemDetailPage").then((module) => ({
    default: module.ItemDetailPage,
  })),
);
const StockFormPage = lazy(() =>
  import("./pages/StockFormPage").then((module) => ({
    default: module.StockFormPage,
  })),
);
const StockHistoryPage = lazy(() =>
  import("./pages/StockHistoryPage").then((module) => ({
    default: module.StockHistoryPage,
  })),
);
const LowStockPage = lazy(() =>
  import("./pages/LowStockPage").then((module) => ({
    default: module.LowStockPage,
  })),
);
const CategoriesPage = lazy(() =>
  import("./pages/MasterDataPages").then((module) => ({
    default: module.CategoriesPage,
  })),
);
const LocationsPage = lazy(() =>
  import("./pages/MasterDataPages").then((module) => ({
    default: module.LocationsPage,
  })),
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  })),
);
const UsersPage = lazy(() =>
  import("./pages/AdminPages").then((module) => ({
    default: module.UsersPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/AdminPages").then((module) => ({
    default: module.SettingsPage,
  })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const RenewalsPage = lazy(() =>
  import("./pages/RenewalsPage").then((module) => ({
    default: module.RenewalsPage,
  })),
);
const AuditLogPage = lazy(() =>
  import("./pages/AuditLogPage").then((module) => ({
    default: module.AuditLogPage,
  })),
);
const DataToolsPage = lazy(() =>
  import("./pages/DataToolsPage").then((module) => ({
    default: module.DataToolsPage,
  })),
);
const StockControlPage = lazy(() =>
  import("./pages/StockControlPage").then((module) => ({
    default: module.StockControlPage,
  })),
);
const PurchaseRequestsPage = lazy(() =>
  import("./pages/PurchaseRequestsPage").then((module) => ({
    default: module.PurchaseRequestsPage,
  })),
);
const IssueRequestsPage = lazy(() =>
  import("./pages/IssueRequestsPage").then((module) => ({
    default: module.IssueRequestsPage,
  })),
);
const FulfillmentPage = lazy(() =>
  import("./pages/FulfillmentPage").then((module) => ({
    default: module.FulfillmentPage,
  })),
);

function LoadingShell({ label }: { label: string }) {
  return (
    <div className="startup-shell" aria-busy="true">
      <aside className="startup-sidebar">
        <div className="startup-brand">
          <img src="/cm_logo.png" alt="" />
          <span>
            <b>ระบบจัดการสำนักงาน</b>
            <small>เชียงใหม่โฟรเซ่นฟูดส์</small>
          </span>
        </div>
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <i key={row} />
        ))}
      </aside>
      <section className="startup-main">
        <header>
          <div>
            <i />
            <i />
          </div>
          <i />
        </header>
        <main>
          <p>{label}</p>
          <div className="startup-actions">
            <i />
            <i />
          </div>
          <div className="startup-content">
            <i />
            <i />
            <i />
          </div>
        </main>
      </section>
    </div>
  );
}
function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingShell label="กำลังตรวจสอบสิทธิ์..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
function HomePage() {
  const { user } = useAuth();
  if (user?.role === "issuer") return <Navigate to="/issue-requests" replace />;
  if (user?.role === "viewer")
    return (
      <div className="route-loading">
        บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ
      </div>
    );
  return <DashboardPage />;
}

export default function App() {
  const { items, loading, error, reload } = useStock();
  const { user } = useAuth();
  useWebMcp(items);
  useEffect(() => {
    if (!user || loading) return;
    const timer = window.setTimeout(() => {
      const pages =
        user.role === "issuer"
          ? [import("./pages/IssueRequestsPage")]
          : [
              import("./pages/InventoryPage"),
              import("./pages/StockFormPage"),
              import("./pages/StockHistoryPage"),
              import("./pages/IssueRequestsPage"),
              import("./pages/FulfillmentPage"),
              import("./pages/LowStockPage"),
              import("./pages/ReportsPage"),
            ];
      void Promise.all(pages).catch(() => undefined);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [user, loading]);
  if (user && loading)
    return <LoadingShell label="กำลังเตรียมข้อมูลสำนักงาน..." />;
  if (user && error)
    return (
      <div className="data-load-error">
        <div>
          <h1>โหลดข้อมูลไม่สำเร็จ</h1>
          <p>{error}</p>
          <button
            className="btn primary"
            onClick={() => void reload().catch(() => undefined)}
          >
            ลองโหลดใหม่
          </button>
        </div>
      </div>
    );
  return (
    <Suspense fallback={<div className="route-loading">กำลังโหลดหน้า...</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route
              element={<ProtectedRoute roles={["admin", "staff", "issuer"]} />}
            >
              <Route path="issue-requests" element={<IssueRequestsPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={["issuer"]} />}>
              <Route
                path="my-issue-requests"
                element={<IssueRequestsPage view="history" />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute roles={["admin", "staff", "fulfiller"]} />
              }
            >
              <Route path="fulfillment" element={<FulfillmentPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="inventory/:id" element={<ItemDetailPage />} />
              <Route path="history" element={<StockHistoryPage />} />
              <Route path="low-stock" element={<LowStockPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
            </Route>
            <Route
              element={
                <ProtectedRoute roles={["admin", "staff", "fulfiller"]} />
              }
            >
              <Route path="stock-in" element={<StockFormPage mode="IN" />} />
              <Route path="stock-out" element={<StockFormPage mode="OUT" />} />
              <Route
                path="stock-adjust"
                element={<StockControlPage mode="ADJUST" />}
              />
              <Route
                path="stock-transfer"
                element={<StockControlPage mode="TRANSFER" />}
              />
            </Route>
            <Route element={<ProtectedRoute roles={["admin", "staff"]} />}>
              <Route path="renewals" element={<RenewalsPage />} />
              <Route
                path="purchase-requests"
                element={<PurchaseRequestsPage />}
              />
            </Route>
            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route path="locations" element={<LocationsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="audit-log" element={<AuditLogPage />} />
              <Route path="data-tools" element={<DataToolsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
