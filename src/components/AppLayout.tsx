import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  DatabaseBackup,
  FileClock,
  FileText,
  Grid2X2,
  History,
  LogOut,
  MapPin,
  Menu,
  PackageCheck,
  PackageSearch,
  Search,
  Settings,
  SlidersHorizontal,
  Tags,
  Users,
  X,
} from "lucide-react";
import { daysUntil, useRenewals } from "../store/RenewalContext";
import { useAuth } from "../store/AuthContext";
import { bangkokDateKey, formatThaiDate } from "../utils/date";
import { defaultSettings, settingsService } from "../services/settingsService";
import { isSupabaseConfigured } from "../lib/supabase";
import { useIssueRequests } from "../store/IssueRequestContext";
import { formatThaiDateTime } from "../utils/date";

const mainNav = [
  ["/", Grid2X2, "ภาพรวม"],
  ["/inventory", Boxes, "สินค้า"],
] as const;
const subNav = [
  ["/stock-in", ArrowDownToLine, "รับสินค้าเข้า"],
  ["/stock-out", ArrowUpFromLine, "เบิกสินค้าออก"],
  ["/stock-adjust", SlidersHorizontal, "ปรับยอดสต็อก"],
  ["/stock-transfer", ArrowRightLeft, "โอนย้ายสต็อก"],
  ["/history", History, "ประวัติ"],
] as const;
const trackingNav = [
  ["/issue-requests", ClipboardCheck, "คำขอเบิก"],
  ["/fulfillment", PackageCheck, "คำรอเบิก"],
  ["/reports", BarChart3, "รายงาน"],
  ["/low-stock", PackageSearch, "สินค้าใกล้หมด"],
  ["/purchase-requests", FileText, "ใบขอซื้อ"],
  ["/renewals", CalendarClock, "รายการต่ออายุ"],
] as const;
const adminNav = [
  ["/users", Users, "ผู้ใช้งาน"],
  ["/audit-log", FileClock, "บันทึกกิจกรรม"],
  ["/data-tools", DatabaseBackup, "สำรองข้อมูล"],
  ["/settings", Settings, "ตั้งค่า"],
] as const;
const titles: Record<string, string> = {
  "/": "Operations Cockpit",
  "/inventory": "คลังสินค้า",
  "/stock-in": "รับสินค้าเข้า",
  "/stock-out": "เบิกสินค้าออก",
  "/stock-adjust": "ปรับยอดสต็อก",
  "/stock-transfer": "โอนย้ายสต็อก",
  "/history": "ประวัติสต็อก",
  "/issue-requests": "คำขอเบิกสินค้า",
  "/fulfillment": "คำรอเบิก",
  "/my-issue-requests": "คำขอของฉัน",
  "/low-stock": "สินค้าใกล้หมด",
  "/purchase-requests": "ใบขอซื้อ",
  "/renewals": "รายการต่ออายุ",
  "/categories": "หมวดหมู่",
  "/locations": "ตำแหน่งจัดเก็บ",
  "/reports": "รายงาน",
  "/users": "ผู้ใช้งาน",
  "/audit-log": "บันทึกกิจกรรม",
  "/data-tools": "สำรองและกู้คืนข้อมูล",
  "/settings": "ตั้งค่า",
};
titles["/"] = "ระบบจัดการสำนักงาน CM";
const renewalDate = (date: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));

export function AppLayout() {
  const { dueItems } = useRenewals();
  const { user, signOut } = useAuth();
  const todayKey = bangkokDateKey();
  const alertKey = `renewal-alert-dismissed-${todayKey}`;
  const alertSignature = dueItems
    .map((item) => `${item.id}:${item.expiryDate}`)
    .join("|");
  const { pending: pendingIssueRequests, ready: readyIssueRequests } = useIssueRequests();
  const issueAlertSignature = pendingIssueRequests
    .map((request) => `${request.id}:${request.updatedAt}`)
    .join("|");
  const issueAlertKey = `issue-request-alert:${user?.id ?? "guest"}`;
  const isIssuer = user?.role === "issuer";
  const isFulfiller = user?.role === "fulfiller";
  const isOperator = user?.role === "admin" || user?.role === "staff";
  const canViewStock = isOperator || isFulfiller;
  const [renewalAlertsEnabled, setRenewalAlertsEnabled] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("cm-office-settings-v1") ?? "{}")
          .renewals !== false
      );
    } catch {
      return defaultSettings.renewals;
    }
  });
  const [open, setOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [showRenewalAlert, setShowRenewalAlert] = useState(false);
  const [showIssueAlert, setShowIssueAlert] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isSupabaseConfigured || !isOperator) return;
    void settingsService
      .load()
      .then((settings) => setRenewalAlertsEnabled(settings.renewals))
      .catch(console.error);
  }, [isOperator]);
  useEffect(() => {
    if (
      !isOperator ||
      pendingIssueRequests.length ||
      !renewalAlertsEnabled ||
      !alertSignature
    ) {
      setShowRenewalAlert(false);
      return;
    }
    const dismissed = sessionStorage.getItem(alertKey);
    const snoozedUntil = Number(
      localStorage.getItem("renewal-alert-snoozed-until") ?? 0,
    );
    if (dismissed !== alertSignature && Date.now() >= snoozedUntil)
      setShowRenewalAlert(true);
  }, [
    alertKey,
    alertSignature,
    isOperator,
    pendingIssueRequests.length,
    renewalAlertsEnabled,
  ]);
  useEffect(() => {
    if (!isOperator || !issueAlertSignature) {
      setShowIssueAlert(false);
      return;
    }
    try {
      const seen = new Set<string>(
        JSON.parse(sessionStorage.getItem(issueAlertKey) ?? "[]"),
      );
      if (pendingIssueRequests.some((request) => !seen.has(request.id)))
        setShowIssueAlert(true);
    } catch {
      setShowIssueAlert(true);
    }
  }, [isOperator, issueAlertKey, issueAlertSignature, pendingIssueRequests]);
  const closeRenewalAlert = () => {
    sessionStorage.setItem(alertKey, alertSignature);
    setShowRenewalAlert(false);
  };
  const snoozeRenewalAlert = () => {
    localStorage.setItem(
      "renewal-alert-snoozed-until",
      String(Date.now() + 4 * 60 * 60 * 1000),
    );
    setShowRenewalAlert(false);
  };
  const closeIssueAlert = () => {
    sessionStorage.setItem(
      issueAlertKey,
      JSON.stringify(pendingIssueRequests.map((request) => request.id)),
    );
    setShowIssueAlert(false);
  };
  const title = loc.pathname.startsWith("/inventory/")
    ? "รายละเอียดสินค้า"
    : (titles[loc.pathname] ?? "ระบบสต็อก");
  const dashboard = loc.pathname === "/";
  return (
    <div className={`app-shell ops-shell ${dashboard ? "dashboard-page" : ""}`}>
      {open && (
        <button
          className="mobile-overlay"
          aria-label="ปิดเมนู"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ops-sidebar ${open ? "open" : ""}`}>
        <div className="brand ops-brand">
          <img
            className="cm-brand-logo"
            src="/cm_logo.png"
            alt="โลโก้เชียงใหม่โฟรเซ่นฟูดส์"
          />
          <div className="brand-copy">
            <strong>ระบบจัดการสำนักงาน</strong>
            <span>เชียงใหม่โฟรเซ่นฟูดส์</span>
          </div>
          <button
            className="icon-btn mobile-only"
            aria-label="ปิดเมนู"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="ops-nav">
          {isIssuer && (
            <>
              <NavLink to="/issue-requests" onClick={() => setOpen(false)}>
                <ClipboardCheck size={21} />
                <span>ขอเบิกสินค้า</span>
              </NavLink>
              <NavLink to="/my-issue-requests" onClick={() => setOpen(false)}>
                <History size={21} />
                <span>คำขอของฉัน</span>
              </NavLink>
            </>
          )}
          {isFulfiller && (
            <>
              {mainNav.map(([to, Icon, label]) => (
                <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}>
                  <Icon size={21} /><span>{label}</span>
                </NavLink>
              ))}
              <NavLink to="/history" onClick={() => setOpen(false)}><History size={21}/><span>ประวัติ</span></NavLink>
              <NavLink to="/fulfillment" onClick={() => setOpen(false)}><PackageCheck size={21}/><span>คำรอเบิก</span>{readyIssueRequests.length>0&&<em className="nav-count">{readyIssueRequests.length}</em>}</NavLink>
              <NavLink to="/reports" onClick={() => setOpen(false)}><BarChart3 size={21}/><span>รายงาน</span></NavLink>
              <NavLink to="/low-stock" onClick={() => setOpen(false)}><PackageSearch size={21}/><span>สินค้าใกล้หมด</span></NavLink>
              <NavLink to="/categories" onClick={() => setOpen(false)}><Tags size={21}/><span>หมวดหมู่</span></NavLink>
            </>
          )}
          {isOperator && (
            <>
              {mainNav.map(([to, Icon, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={21} />
                  <span>{label}</span>
                </NavLink>
              ))}
              <button
                className="nav-group"
                onClick={() => setStockOpen((v) => !v)}
              >
                <ClipboardList size={21} />
                <span>รายการสต็อก</span>
                {stockOpen ? (
                  <ChevronUp className="nav-tail" size={16} />
                ) : (
                  <ChevronDown className="nav-tail" size={16} />
                )}
              </button>
              {stockOpen && (
                <div className="sub-nav">
                  {subNav.map(([to, Icon, label]) => (
                    <NavLink key={to} to={to} onClick={() => setOpen(false)}>
                      <Icon size={19} />
                      <span>{label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
              <div className="nav-separator" />
              <span className="nav-section-label">ติดตามและรายงาน</span>
              {trackingNav.map(([to, Icon, label]) => (
                <NavLink key={to} to={to} onClick={() => setOpen(false)}>
                  <Icon size={21} />
                  <span>{label}</span>
                  {to === "/issue-requests" &&
                    pendingIssueRequests.length > 0 && (
                      <em className="nav-count">
                        {pendingIssueRequests.length}
                      </em>
                    )}
                  {to === "/fulfillment" && readyIssueRequests.length > 0 && (
                    <em className="nav-count">{readyIssueRequests.length}</em>
                  )}
                </NavLink>
              ))}
              <div className="nav-separator" />
              <span className="nav-section-label">ข้อมูลสินค้า</span>
              <NavLink to="/categories" onClick={() => setOpen(false)}>
                <Tags size={21} />
                <span>หมวดหมู่</span>
              </NavLink>
              {user?.role === "admin" && (
                <NavLink to="/locations" onClick={() => setOpen(false)}>
                  <MapPin size={21} />
                  <span>ตำแหน่งจัดเก็บ</span>
                </NavLink>
              )}
              {user?.role === "admin" && (
                <>
                  <div className="nav-separator" />
                  <span className="nav-section-label">ผู้ดูแลระบบ</span>
                  {adminNav.map(([to, Icon, label]) => (
                    <NavLink key={to} to={to} onClick={() => setOpen(false)}>
                      <Icon size={21} />
                      <span>{label}</span>
                    </NavLink>
                  ))}
                </>
              )}
            </>
          )}
        </nav>
        <div className="side-profile ops-profile">
          <div className="avatar">{user?.name.slice(0, 2)}</div>
          <div>
            <strong>{user?.name}</strong>
            <span>
              {user?.role === "admin"
                ? "ผู้ดูแลระบบ"
                : user?.role === "staff"
                  ? "เจ้าหน้าที่พัสดุ"
                  : isIssuer
                    ? "ผู้ขอเบิกสินค้า"
                    : isFulfiller
                      ? "เจ้าหน้าที่เบิกของ"
                    : "ยังไม่ได้รับสิทธิ์"}
            </span>
          </div>
        </div>
        <button
          className="logout"
          onClick={async () => {
            await signOut();
            navigate("/login");
          }}
        >
          <LogOut size={20} />
          ออกจากระบบ
        </button>
      </aside>
      <div className="main-area ops-main">
        <header className="topbar ops-topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="ops-heading">
            <h1>{title}</h1>
            {dashboard ? (
              <p>
                <b>สวัสดี {user?.name}</b>
                <i />
                {formatThaiDate()}
              </p>
            ) : (
              <p>{formatThaiDate()}</p>
            )}
          </div>
          <div className="ops-header-tools">
            {canViewStock && (
              <label className="ops-search">
                <Search size={20} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && query.trim())
                      navigate(
                        `/inventory?search=${encodeURIComponent(query.trim())}`,
                      );
                  }}
                  placeholder="ค้นหาสินค้า รหัส หรือบาร์โค้ด"
                />
                <kbd>Ctrl + K</kbd>
              </label>
            )}
            {dashboard && isOperator && (
              <>
                <NavLink to="/stock-in" className="header-action receive">
                  <ArrowDownToLine />
                  รับเข้า
                </NavLink>
                <NavLink to="/stock-out" className="header-action issue">
                  <ArrowUpFromLine />
                  เบิกออก
                </NavLink>
              </>
            )}
            {canViewStock && (
              <button
                className="icon-btn notify"
                aria-label="เปิดการแจ้งเตือน"
                onClick={() => {
                  if (isOperator && pendingIssueRequests.length) setShowIssueAlert(true);
                  else if (readyIssueRequests.length) navigate("/fulfillment");
                  else if (renewalAlertsEnabled && dueItems.length)
                    setShowRenewalAlert(true);
                }}
              >
                <Bell size={22} />
                {((isOperator && pendingIssueRequests.length > 0) || readyIssueRequests.length > 0 ||
                  (renewalAlertsEnabled && dueItems.length > 0)) && <i />}
              </button>
            )}
            <div className="top-user ops-user">
              <div className="avatar">{user?.name.slice(0, 2)}</div>
              <ChevronDown size={17} />
            </div>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
      {isOperator && showRenewalAlert && (
        <div className="renewal-news-backdrop" role="presentation">
          <section
            className="renewal-news-modal"
            role="dialog"
            aria-modal="true"
            aria-label="แจ้งเตือนรายการต่ออายุ"
          >
            <button
              className="renewal-news-close"
              onClick={closeRenewalAlert}
              aria-label="ปิด"
            >
              <X />
            </button>
            <header>
              <span>
                <Bell />
              </span>
              <div>
                <small>ข่าวแจ้งเตือน</small>
                <h2>มีรายการใกล้ถึงกำหนดต่ออายุ</h2>
                <p>พบ {dueItems.length} รายการที่ควรตรวจสอบและดำเนินการ</p>
              </div>
            </header>
            <div className="renewal-news-list">
              {dueItems.slice(0, 4).map((item) => {
                const days = daysUntil(item.expiryDate);
                return (
                  <article key={item.id}>
                    <span className={days < 0 ? "overdue" : "due"}>
                      <CalendarClock />
                    </span>
                    <div>
                      <b>{item.name}</b>
                      <p>
                        {item.owner} · ครบกำหนด {renewalDate(item.expiryDate)}
                      </p>
                    </div>
                    <strong className={days < 0 ? "overdue" : ""}>
                      {days < 0
                        ? `เกิน ${Math.abs(days)} วัน`
                        : days === 0
                          ? "วันนี้"
                          : `อีก ${days} วัน`}
                    </strong>
                  </article>
                );
              })}
            </div>
            <footer>
              <button className="btn secondary" onClick={snoozeRenewalAlert}>
                เตือนอีกครั้งใน 4 ชม.
              </button>
              <button className="btn secondary" onClick={closeRenewalAlert}>
                รับทราบ
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  closeRenewalAlert();
                  navigate("/renewals");
                }}
              >
                ดูรายการทั้งหมด <ArrowRight size={17} />
              </button>
            </footer>
          </section>
        </div>
      )}
      {isOperator && showIssueAlert && (
        <div className="renewal-news-backdrop" role="presentation">
          <section
            className="renewal-news-modal"
            role="dialog"
            aria-modal="true"
            aria-label="แจ้งเตือนคำขอเบิก"
          >
            <button
              className="renewal-news-close"
              onClick={closeIssueAlert}
              aria-label="ปิด"
            >
              <X />
            </button>
            <header>
              <span>
                <ClipboardCheck />
              </span>
              <div>
                <small>คำขอใหม่</small>
                <h2>มีคำขอเบิกรออนุมัติ</h2>
                <p>พบ {pendingIssueRequests.length} คำขอที่ยังไม่ตัดสต็อก</p>
              </div>
            </header>
            <div className="renewal-news-list">
              {pendingIssueRequests.slice(0, 4).map((request) => (
                <article key={request.id}>
                  <span className="due">
                    <CheckCircle2 />
                  </span>
                  <div>
                    <b>{request.requestNo}</b>
                    <p>
                      {request.requestedByName} · {request.lines.length} รายการ
                    </p>
                  </div>
                  <strong>{formatThaiDateTime(request.createdAt)}</strong>
                </article>
              ))}
            </div>
            <footer>
              <button className="btn secondary" onClick={closeIssueAlert}>
                ไว้ภายหลัง
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  closeIssueAlert();
                  navigate("/issue-requests");
                }}
              >
                ตรวจสอบคำขอ <ArrowRight size={17} />
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
