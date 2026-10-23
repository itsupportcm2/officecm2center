import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Filter,
  Globe2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  migrantWorkerService,
  getWorkerGender,
  type ForeignWorker,
  type MigrantDocumentType,
  type MigrantWorkerDocument,
  type WorkerGender,
} from "../services/migrantWorkerService";

const labels: Record<MigrantDocumentType, string> = {
  PASSPORT_RED: "พาสปอร์ตเล่มแดง",
  PASSPORT_GREEN: "พาสปอร์ตเล่มเขียว",
  PINK_CARD: "บัตรชมพู",
  TEN_YEAR_CARD: "บัตร 10 ปี",
};

const DOC_COLORS: Record<MigrantDocumentType, string> = {
  PASSPORT_RED: "#ef4444",
  PASSPORT_GREEN: "#10b981",
  PINK_CARD: "#ec4899",
  TEN_YEAR_CARD: "#8b5cf6",
};

const daysUntil = (date: string) =>
  Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() -
      new Date(new Date().toDateString()).getTime()) /
      86400000,
  );

const thaiDate = (date: string) =>
  new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));

const formatDays = (absDays: number): string => {
  if (absDays < 30) return `${absDays} วัน`;
  const years = Math.floor(absDays / 365);
  const rem = absDays % 365;
  const months = Math.floor(rem / 30);
  const days = rem % 30;
  if (years > 0) {
    return months > 0 ? `${years} ปี ${months} เดือน` : `${years} ปี`;
  }
  return days > 0 ? `${months} เดือน ${days} วัน` : `${months} เดือน`;
};

interface ExpiryRow {
  worker: ForeignWorker;
  doc: MigrantWorkerDocument;
  field: string;
  date: string;
  days: number;
}

export function MigrantDashboardPage() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<ForeignWorker[]>([]);
  const [docs, setDocs] = useState<MigrantWorkerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [activeTab, setActiveTab] = useState<"urgent" | "expired" | "due" | "caution" | "all">("urgent");
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "MALE" | "FEMALE">("all");

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const snapshot = await migrantWorkerService.load();
      setWorkers(snapshot.workers);
      setDocs(snapshot.documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activeWorkers = useMemo(() => workers.filter((w) => w.isActive), [workers]);
  const activeWorkerMap = useMemo(() => new Map(activeWorkers.map((w) => [w.id, w])), [activeWorkers]);
  const activeDocs = useMemo(
    () => docs.filter((d) => d.isActive && activeWorkerMap.has(d.workerId)),
    [docs, activeWorkerMap],
  );

  // Departments list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const w of activeWorkers) {
      if (w.department) set.add(w.department);
    }
    return Array.from(set).sort();
  }, [activeWorkers]);

  // Gender statistics
  const genderStats = useMemo(() => {
    let male = 0;
    let female = 0;
    let other = 0;
    for (const w of activeWorkers) {
      const g = getWorkerGender(w);
      if (g === "MALE") male++;
      else if (g === "FEMALE") female++;
      else other++;
    }
    const total = activeWorkers.length || 1;
    return {
      male,
      female,
      other,
      malePct: Math.round((male / total) * 100),
      femalePct: Math.round((female / total) * 100),
      otherPct: Math.round((other / total) * 100),
    };
  }, [activeWorkers]);

  const expiryRows = useMemo(() => {
    const list: ExpiryRow[] = [];
    const fields: Array<{ key: keyof MigrantWorkerDocument; label: string }> = [
      { key: "expiresOn", label: "วันหมดอายุเอกสาร/พาสปอร์ต" },
      { key: "visaExpiresOn", label: "วันหมดอายุ Visa" },
      { key: "workPermitExpiresOn", label: "วันหมดอายุใบอนุญาตทำงาน" },
      { key: "areaPermitExpiresOn", label: "รายงานตัว / พื้นที่" },
    ];

    for (const doc of activeDocs) {
      const worker = activeWorkerMap.get(doc.workerId);
      if (!worker) continue;
      for (const f of fields) {
        const val = doc[f.key];
        if (typeof val === "string" && val) {
          const days = daysUntil(val);
          list.push({ worker, doc, field: f.label, date: val, days });
        }
      }
    }
    return list.sort((a, b) => a.days - b.days);
  }, [activeDocs, activeWorkerMap]);

  // Breakdown buckets
  const expired = useMemo(() => expiryRows.filter((r) => r.days < 0), [expiryRows]);
  const due30 = useMemo(() => expiryRows.filter((r) => r.days >= 0 && r.days <= 30), [expiryRows]);
  const due90 = useMemo(() => expiryRows.filter((r) => r.days > 30 && r.days <= 90), [expiryRows]);
  const safe = useMemo(() => expiryRows.filter((r) => r.days > 90), [expiryRows]);

  // Document types distribution
  const docTypeStats = useMemo(() => {
    const counts = new Map<MigrantDocumentType, number>();
    for (const d of activeDocs) counts.set(d.documentType, (counts.get(d.documentType) ?? 0) + 1);
    const total = activeDocs.length || 1;
    return (Object.keys(labels) as MigrantDocumentType[]).map((t) => {
      const count = counts.get(t) ?? 0;
      const pct = Math.round((count / total) * 100);
      return { type: t, label: labels[t], count, pct, color: DOC_COLORS[t] };
    });
  }, [activeDocs]);

  // Department ranking (Top 8)
  const deptStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of activeWorkers) {
      const dept = w.department || "ไม่ระบุ";
      counts.set(dept, (counts.get(dept) ?? 0) + 1);
    }
    const max = Math.max(1, ...Array.from(counts.values()));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count, max }));
  }, [activeWorkers]);

  // Nationality stats
  const natStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of activeWorkers) {
      const nat = w.nationality || "ไม่ระบุ";
      counts.set(nat, (counts.get(nat) ?? 0) + 1);
    }
    const total = activeWorkers.length || 1;
    const colors = ["#175cd3", "#0d9488", "#ea580c", "#8b5cf6", "#ec4899", "#64748b"];
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({
        name,
        count,
        pct: Math.round((count / total) * 100),
        color: colors[i % colors.length],
      }));
  }, [activeWorkers]);

  // Filtered rows for watchlist
  const filteredRows = useMemo(() => {
    let list = expiryRows;
    if (activeTab === "urgent") {
      list = list.filter((r) => r.days <= 30);
    } else if (activeTab === "expired") {
      list = expired;
    } else if (activeTab === "due") {
      list = due30;
    } else if (activeTab === "caution") {
      list = due90;
    }

    if (deptFilter !== "all") {
      list = list.filter((r) => r.worker.department === deptFilter);
    }

    if (genderFilter !== "all") {
      list = list.filter((r) => getWorkerGender(r.worker) === genderFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.worker.fullName.toLowerCase().includes(q) ||
          r.worker.employeeCode.toLowerCase().includes(q) ||
          r.worker.department.toLowerCase().includes(q) ||
          r.doc.documentNumber.toLowerCase().includes(q) ||
          r.field.toLowerCase().includes(q),
      );
    }

    return list;
  }, [expiryRows, activeTab, deptFilter, genderFilter, searchQuery, expired, due30, due90]);

  const nowFormatted = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="mdb-container">
      {/* Hero Banner */}
      <section className="mdb-hero">
        <div className="mdb-hero-content">
          <div className="mdb-hero-badge">
            <span className="mdb-hero-pulse" />
            <span>หมวดต่อภาษีพนักงานต่างด้าว • Realtime Overview</span>
          </div>
          <h1>Dashboard ภาพรวมและสถานะเอกสารแรงงานต่างด้าว</h1>
          <p className="mdb-hero-desc">
            ศูนย์ตรวจสอบและติดตามวันหมดอายุพาสปอร์ต, วีซ่า (Visa) และใบอนุญาตทำงาน (Work Permit) พร้อมสถิติภาพรวม
          </p>
          <div className="mdb-hero-meta">
            <div className="mdb-hero-meta-item">
              <Calendar size={15} />
              <span>{nowFormatted}</span>
            </div>
            <div className="mdb-hero-meta-item">
              <ShieldCheck size={15} />
              <span>ระบบตรวจสอบอัตโนมัติ</span>
            </div>
          </div>
        </div>

        <div className="mdb-hero-actions">
          <button
            type="button"
            className="mdb-btn-glass"
            onClick={() => void load()}
            disabled={loading}
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            <span>{loading ? "กำลังโหลด..." : "รีเฟรช"}</span>
          </button>
          <button
            type="button"
            className="mdb-btn-primary"
            onClick={() => navigate("/migrant-workers")}
          >
            <span>จัดการเอกสาร</span>
            <ExternalLink size={16} />
          </button>
        </div>
      </section>

      {error && <div className="mdb-error">{error}</div>}

      {/* 6 Key Performance Indicator Cards */}
      <section className="mdb-kpi-grid">
        <div className="mdb-kpi-card mdb-kpi-primary">
          <div className="mdb-kpi-top">
            <span className="mdb-kpi-title">พนักงานในระบบ</span>
            <div className="mdb-kpi-icon-wrap">
              <Users size={20} />
            </div>
          </div>
          <div className="mdb-kpi-val-row">
            <span className="mdb-kpi-val">{activeWorkers.length.toLocaleString("th-TH")}</span>
            <span className="mdb-kpi-unit">คน</span>
          </div>
          <div className="mdb-kpi-footer">
            <span style={{ fontWeight: 600, color: "#1e293b" }}>
              👨 ชาย {genderStats.male} • 👩 หญิง {genderStats.female}
            </span>
            <span className="mdb-kpi-pill" style={{ background: "#eff6ff", color: "#175cd3" }}>
              ใช้งานอยู่
            </span>
          </div>
        </div>

        <div className="mdb-kpi-card mdb-kpi-teal">
          <div className="mdb-kpi-top">
            <span className="mdb-kpi-title">เอกสารทั้งหมด</span>
            <div className="mdb-kpi-icon-wrap">
              <FileText size={20} />
            </div>
          </div>
          <div className="mdb-kpi-val-row">
            <span className="mdb-kpi-val">{activeDocs.length.toLocaleString("th-TH")}</span>
            <span className="mdb-kpi-unit">ฉบับ</span>
          </div>
          <div className="mdb-kpi-footer">
            <span>เอกสารสถานะปกติ</span>
            <span className="mdb-kpi-pill" style={{ background: "#f0fdfa", color: "#0d9488" }}>
              Active
            </span>
          </div>
        </div>

        <div className="mdb-kpi-card mdb-kpi-danger">
          <div className="mdb-kpi-top">
            <span className="mdb-kpi-title">หมดอายุแล้ว</span>
            <div className="mdb-kpi-icon-wrap">
              <AlertOctagon size={20} />
            </div>
          </div>
          <div className="mdb-kpi-val-row">
            <span className="mdb-kpi-val" style={{ color: "#dc2626" }}>
              {expired.length.toLocaleString("th-TH")}
            </span>
            <span className="mdb-kpi-unit">รายการ</span>
          </div>
          <div className="mdb-kpi-footer">
            <span>เกินกำหนดระยะเวลา</span>
            <span className="mdb-kpi-pill" style={{ background: "#fef2f2", color: "#dc2626" }}>
              ต้องต่ออายุด่วน
            </span>
          </div>
        </div>

        <div className="mdb-kpi-card mdb-kpi-warning">
          <div className="mdb-kpi-top">
            <span className="mdb-kpi-title">ใกล้หมดอายุ ≤ 30 วัน</span>
            <div className="mdb-kpi-icon-wrap">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="mdb-kpi-val-row">
            <span className="mdb-kpi-val" style={{ color: "#ea580c" }}>
              {due30.length.toLocaleString("th-TH")}
            </span>
            <span className="mdb-kpi-unit">รายการ</span>
          </div>
          <div className="mdb-kpi-footer">
            <span>ระยะเร่งด่วน</span>
            <span className="mdb-kpi-pill" style={{ background: "#fff7ed", color: "#ea580c" }}>
              เตรียมเอกสาร
            </span>
          </div>
        </div>

        <div className="mdb-kpi-card mdb-kpi-caution">
          <div className="mdb-kpi-top">
            <span className="mdb-kpi-title">ใกล้หมดอายุ 31-90 วัน</span>
            <div className="mdb-kpi-icon-wrap">
              <CalendarClock size={20} />
            </div>
          </div>
          <div className="mdb-kpi-val-row">
            <span className="mdb-kpi-val" style={{ color: "#d97706" }}>
              {due90.length.toLocaleString("th-TH")}
            </span>
            <span className="mdb-kpi-unit">รายการ</span>
          </div>
          <div className="mdb-kpi-footer">
            <span>เฝ้าระวังล่วงหน้า</span>
            <span className="mdb-kpi-pill" style={{ background: "#fffbeb", color: "#d97706" }}>
              ช่วงวางแผน
            </span>
          </div>
        </div>

        <div className="mdb-kpi-card mdb-kpi-success">
          <div className="mdb-kpi-top">
            <span className="mdb-kpi-title">สถานะปกติ &gt; 90 วัน</span>
            <div className="mdb-kpi-icon-wrap">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mdb-kpi-val-row">
            <span className="mdb-kpi-val" style={{ color: "#16a34a" }}>
              {safe.length.toLocaleString("th-TH")}
            </span>
            <span className="mdb-kpi-unit">รายการ</span>
          </div>
          <div className="mdb-kpi-footer">
            <span>ระยะปลอดภัย</span>
            <span className="mdb-kpi-pill" style={{ background: "#f0fdf4", color: "#16a34a" }}>
              ความเสี่ยงต่ำ
            </span>
          </div>
        </div>
      </section>

      {/* Visual Analytics Grid: 4 Panels including Gender */}
      <section className="mdb-analytics-grid">
        {/* Panel 1: Gender Distribution */}
        <div className="mdb-panel">
          <div className="mdb-panel-header">
            <div className="mdb-panel-title">
              <div className="mdb-panel-title-icon" style={{ background: "#fdf2f8", color: "#db2777" }}>
                <Users size={18} />
              </div>
              <div>
                <h2>สัดส่วนเพศ (ชาย / หญิง)</h2>
                <p>จำนวนแรงงานจำแนกตามเพศ</p>
              </div>
            </div>
          </div>

          <div className="mdb-gender-box">
            <div className="mdb-gender-bar-container">
              <div className="mdb-gender-dual-track">
                <div
                  className="mdb-gender-bar-male"
                  style={{ width: `${genderStats.malePct}%` }}
                  title={`ชาย ${genderStats.male} คน (${genderStats.malePct}%)`}
                />
                <div
                  className="mdb-gender-bar-female"
                  style={{ width: `${genderStats.femalePct}%` }}
                  title={`หญิง ${genderStats.female} คน (${genderStats.femalePct}%)`}
                />
                {genderStats.otherPct > 0 && (
                  <div
                    className="mdb-gender-bar-other"
                    style={{ width: `${genderStats.otherPct}%` }}
                    title={`ไม่ระบุ ${genderStats.other} คน (${genderStats.otherPct}%)`}
                  />
                )}
              </div>
            </div>

            <div className="mdb-gender-stat-grid">
              <div className="mdb-gender-stat-card mdb-gender-stat-male">
                <div className="mdb-gender-stat-icon">👨</div>
                <div className="mdb-gender-stat-info">
                  <span className="mdb-gender-stat-label">พนักงานชาย</span>
                  <span className="mdb-gender-stat-val">{genderStats.male} คน</span>
                  <span className="mdb-gender-stat-pct">{genderStats.malePct}% ของทั้งหมด</span>
                </div>
              </div>

              <div className="mdb-gender-stat-card mdb-gender-stat-female">
                <div className="mdb-gender-stat-icon">👩</div>
                <div className="mdb-gender-stat-info">
                  <span className="mdb-gender-stat-label">พนักงานหญิง</span>
                  <span className="mdb-gender-stat-val">{genderStats.female} คน</span>
                  <span className="mdb-gender-stat-pct">{genderStats.femalePct}% ของทั้งหมด</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Document Type Breakdown with SVG Donut Ring */}
        <div className="mdb-panel">
          <div className="mdb-panel-header">
            <div className="mdb-panel-title">
              <div className="mdb-panel-title-icon">
                <FileText size={18} />
              </div>
              <div>
                <h2>ประเภทเอกสาร</h2>
                <p>สัดส่วนเอกสารทั้งหมดที่ใช้งาน</p>
              </div>
            </div>
          </div>

          <div className="mdb-donut-container">
            <div className="mdb-donut-graphic">
              <svg viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#f1f5f9" strokeWidth="5" />
                {(() => {
                  let accumulated = 0;
                  return docTypeStats.map((item) => {
                    const strokeDasharray = `${item.pct} ${100 - item.pct}`;
                    const strokeDashoffset = -accumulated;
                    accumulated += item.pct;
                    return (
                      <circle
                        key={item.type}
                        cx="21"
                        cy="21"
                        r="15.91549430918954"
                        fill="transparent"
                        stroke={item.color}
                        strokeWidth="5"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        style={{ transition: "stroke-dasharray 0.5s ease" }}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="mdb-donut-center">
                <span className="mdb-donut-center-val">{activeDocs.length}</span>
                <span className="mdb-donut-center-label">ฉบับ</span>
              </div>
            </div>

            <div className="mdb-donut-list">
              {docTypeStats.map((item) => (
                <div key={item.type} className="mdb-donut-item">
                  <div className="mdb-donut-item-meta">
                    <span className="mdb-donut-item-name">
                      <span className="mdb-donut-dot" style={{ background: item.color }} />
                      <span>{item.label}</span>
                    </span>
                    <span className="mdb-donut-item-val">{item.count} ฉบับ ({item.pct}%)</span>
                  </div>
                  <div className="mdb-donut-item-track">
                    <div
                      className="mdb-donut-item-bar"
                      style={{ width: `${item.pct}%`, background: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 3: Department Rankings */}
        <div className="mdb-panel">
          <div className="mdb-panel-header">
            <div className="mdb-panel-title">
              <div className="mdb-panel-title-icon">
                <Building2 size={18} />
              </div>
              <div>
                <h2>พนักงานตามแผนก</h2>
                <p>จำนวนแรงงานต่างด้าวแยกตามแผนก</p>
              </div>
            </div>
          </div>

          <div className="mdb-dept-list">
            {deptStats.length === 0 ? (
              <div className="mdb-empty-state">ไม่มีข้อมูลแผนก</div>
            ) : (
              deptStats.map((item, idx) => {
                const fillPct = Math.round((item.count / item.max) * 100);
                return (
                  <div key={item.name} className="mdb-dept-row">
                    <span className={`mdb-dept-rank ${idx < 3 ? "mdb-dept-rank-top" : ""}`}>
                      #{idx + 1}
                    </span>
                    <span className="mdb-dept-badge">{item.name}</span>
                    <div className="mdb-dept-bar-wrap">
                      <div className="mdb-dept-bar-fill" style={{ width: `${fillPct}%` }} />
                    </div>
                    <span className="mdb-dept-count">{item.count} คน</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panel 4: Nationality Distribution */}
        <div className="mdb-panel">
          <div className="mdb-panel-header">
            <div className="mdb-panel-title">
              <div className="mdb-panel-title-icon">
                <Globe2 size={18} />
              </div>
              <div>
                <h2>สัญชาติแรงงาน</h2>
                <p>สัดส่วนตามสัญชาติต่างด้าว</p>
              </div>
            </div>
          </div>

          <div className="mdb-nat-grid">
            {natStats.length === 0 ? (
              <div className="mdb-empty-state">ไม่มีข้อมูลสัญชาติ</div>
            ) : (
              natStats.map((item) => (
                <div key={item.name} className="mdb-nat-card">
                  <div className="mdb-nat-name">
                    <span className="mdb-nat-pill" style={{ background: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <div className="mdb-nat-stats">
                    <span className="mdb-nat-count">{item.count}</span>
                    <span className="mdb-nat-pct">({item.pct}%)</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Expiry Watchlist Section */}
      <section className="mdb-watchlist-card">
        <div className="mdb-watchlist-header">
          <div className="mdb-watchlist-title">
            <div className="mdb-watchlist-title-icon">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2>ศูนย์ติดตามและต่ออายุเอกสารเร่งด่วน</h2>
              <p>เรียงตามวันครบกำหนดที่ใกล้ที่สุด เพื่อให้ดำเนินการต่ออายุได้ทันเวลา</p>
            </div>
          </div>

          <div className="mdb-tabs">
            <button
              type="button"
              className={`mdb-tab-btn ${activeTab === "urgent" ? "active" : ""}`}
              onClick={() => setActiveTab("urgent")}
            >
              <span>เร่งด่วนทั้งหมด (≤ 30 วัน)</span>
              <span className="mdb-tab-badge">{expired.length + due30.length}</span>
            </button>
            <button
              type="button"
              className={`mdb-tab-btn ${activeTab === "expired" ? "active" : ""}`}
              onClick={() => setActiveTab("expired")}
            >
              <span>หมดอายุแล้ว</span>
              <span
                className="mdb-tab-badge"
                style={{
                  background: activeTab === "expired" ? undefined : "#fee2e2",
                  color: activeTab === "expired" ? undefined : "#dc2626",
                }}
              >
                {expired.length}
              </span>
            </button>
            <button
              type="button"
              className={`mdb-tab-btn ${activeTab === "due" ? "active" : ""}`}
              onClick={() => setActiveTab("due")}
            >
              <span>ใกล้ครบกำหนด (1-30 วัน)</span>
              <span className="mdb-tab-badge">{due30.length}</span>
            </button>
            <button
              type="button"
              className={`mdb-tab-btn ${activeTab === "caution" ? "active" : ""}`}
              onClick={() => setActiveTab("caution")}
            >
              <span>31 - 90 วัน</span>
              <span className="mdb-tab-badge">{due90.length}</span>
            </button>
            <button
              type="button"
              className={`mdb-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              <span>ทั้งหมด</span>
              <span className="mdb-tab-badge">{expiryRows.length}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar with Gender Filter */}
        <div className="mdb-controls-bar">
          <div className="mdb-search-box">
            <Search size={16} className="mdb-search-icon" />
            <input
              type="text"
              placeholder="ค้นหาชื่อพนักงาน, รหัส, แผนก หรือเลขเอกสาร..."
              className="mdb-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Building2 size={15} color="#64748b" />
            <select
              className="mdb-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="all">ทุกแผนก ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  แผนก {d}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={15} color="#64748b" />
            <select
              className="mdb-select"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
            >
              <option value="all">ทุกเพศ (ชาย/หญิง)</option>
              <option value="MALE">👨 เฉพาะชาย ({genderStats.male})</option>
              <option value="FEMALE">👩 เฉพาะหญิง ({genderStats.female})</option>
            </select>
          </div>

          <div style={{ fontSize: "0.8rem", color: "#64748b", marginLeft: "auto" }}>
            แสดงผล <b>{filteredRows.length}</b> รายการ
          </div>
        </div>

        {/* Watchlist Table */}
        <div className="mdb-table-wrap">
          {loading ? (
            <div className="mdb-loading-wrap">
              <RefreshCw size={24} className="spin" color="#175cd3" />
              <span>กำลังโหลดข้อมูลเอกสาร...</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="mdb-empty-state">
              <div className="mdb-empty-icon">
                <CheckCircle2 size={28} />
              </div>
              <span className="mdb-empty-title">ไม่พบรายการเอกสารในเงื่อนไขนี้</span>
              <span className="mdb-empty-desc">
                {activeTab === "expired"
                  ? "ยินดีด้วย! ไม่มีเอกสารที่หมดอายุในขณะนี้"
                  : "ไม่มีรายการที่ตรงกับคำค้นหาหรือตัวกรองที่เลือก"}
              </span>
            </div>
          ) : (
            <table className="mdb-table">
              <thead>
                <tr>
                  <th>พนักงาน</th>
                  <th>เพศ</th>
                  <th>แผนก</th>
                  <th>ประเภทเอกสาร</th>
                  <th>รายการที่ต้องต่ออายุ</th>
                  <th>วันครบกำหนด</th>
                  <th>ระยะเวลาคงเหลือ</th>
                  <th style={{ textAlign: "right" }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const isExp = r.days < 0;
                  const isDue30 = r.days >= 0 && r.days <= 30;
                  const isDue90 = r.days > 30 && r.days <= 90;
                  const initial = r.worker.fullName.trim() ? r.worker.fullName.trim()[0] : "W";
                  const gender = getWorkerGender(r.worker);

                  let statusClass = "mdb-status-pill-normal";
                  let statusText = `อีก ${formatDays(r.days)}`;
                  if (isExp) {
                    statusClass = "mdb-status-pill-expired";
                    statusText = `เกิน ${formatDays(Math.abs(r.days))}`;
                  } else if (r.days === 0) {
                    statusClass = "mdb-status-pill-due";
                    statusText = "ครบกำหนดวันนี้!";
                  } else if (isDue30) {
                    statusClass = "mdb-status-pill-due";
                    statusText = `อีก ${formatDays(r.days)}`;
                  } else if (isDue90) {
                    statusClass = "mdb-status-pill-caution";
                    statusText = `อีก ${formatDays(r.days)}`;
                  }

                  return (
                    <tr
                      key={`${r.doc.id}-${r.field}`}
                      className={isExp ? "mdb-row-expired-highlight" : ""}
                    >
                      <td>
                        <div className="mdb-worker-cell">
                          <div className="mdb-avatar">{initial}</div>
                          <div className="mdb-worker-info">
                            <span className="mdb-worker-name">{r.worker.fullName}</span>
                            <span className="mdb-worker-sub">
                              <span>รหัส: {r.worker.employeeCode}</span>
                              {r.worker.nationality && <span>• {r.worker.nationality}</span>}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        {gender === "MALE" ? (
                          <span className="mwp-gender-badge mwp-gender-male">👨 ชาย</span>
                        ) : gender === "FEMALE" ? (
                          <span className="mwp-gender-badge mwp-gender-female">👩 หญิง</span>
                        ) : (
                          <span className="mwp-gender-badge mwp-gender-unknown">-</span>
                        )}
                      </td>

                      <td>
                        <span className="mdb-dept-pill">{r.worker.department || "-"}</span>
                      </td>

                      <td>
                        <span
                          className="mdb-doc-tag"
                          style={{
                            background: `${DOC_COLORS[r.doc.documentType]}15`,
                            color: DOC_COLORS[r.doc.documentType],
                            border: `1px solid ${DOC_COLORS[r.doc.documentType]}40`,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: DOC_COLORS[r.doc.documentType],
                            }}
                          />
                          {labels[r.doc.documentType]}
                        </span>
                      </td>

                      <td>
                        <span className="mdb-field-tag">{r.field}</span>
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>{thaiDate(r.date)}</span>
                      </td>

                      <td>
                        <span className={`mdb-status-pill ${statusClass}`}>{statusText}</span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="mdb-action-btn"
                          onClick={() => navigate("/migrant-workers")}
                          title="ไปที่หน้าเอกสาร"
                        >
                          <span>จัดการ</span>
                          <ExternalLink size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
