import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import {
  migrantWorkerService,
  type ForeignWorker,
  type MigrantDocumentType,
  type MigrantWorkerDocument,
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
  const [workers, setWorkers] = useState<ForeignWorker[]>([]);
  const [docs, setDocs] = useState<MigrantWorkerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const expiryRows = useMemo(() => {
    const list: ExpiryRow[] = [];
    const fields: Array<{ key: keyof MigrantWorkerDocument; label: string }> = [
      { key: "expiresOn", label: "วันหมดอายุเอกสาร/พาสปอร์ต" },
      { key: "visaExpiresOn", label: "วันหมดอายุ Visa" },
      { key: "workPermitExpiresOn", label: "วันหมดอายุใบอนุญาตทำงาน" },
      { key: "areaPermitExpiresOn", label: "วันหมดอายุใบอนุญาตพื้นที่/รายงานตัว" },
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

  const expired = useMemo(() => expiryRows.filter((r) => r.days < 0), [expiryRows]);
  const dueRows = useMemo(() => expiryRows.filter((r) => r.days >= 0 && r.days <= r.doc.remindDays), [expiryRows]);
  const safeRows = useMemo(() => expiryRows.filter((r) => r.days > r.doc.remindDays), [expiryRows]);

  const docTypeSlices = useMemo(() => {
    const counts = new Map<MigrantDocumentType, number>();
    for (const d of activeDocs) counts.set(d.documentType, (counts.get(d.documentType) ?? 0) + 1);
    return (Object.keys(labels) as MigrantDocumentType[])
      .map((t) => ({ label: labels[t], value: counts.get(t) ?? 0, color: DOC_COLORS[t] }))
      .filter((s) => s.value > 0);
  }, [activeDocs]);

  const deptData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of activeWorkers) {
      const dept = w.department || "ไม่ระบุ";
      counts.set(dept, (counts.get(dept) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value], i) => ({ label, value, color: `hsl(${(i * 37 + 200) % 360},70%,55%)` }));
  }, [activeWorkers]);

  const natData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of activeWorkers) {
      const nat = w.nationality || "ไม่ระบุ";
      counts.set(nat, (counts.get(nat) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({ label, value, color: `hsl(${(i * 50 + 20) % 360},65%,55%)` }));
  }, [activeWorkers]);

  const upcomingTop = useMemo(() => [...dueRows, ...safeRows].slice(0, 10), [dueRows, safeRows]);

  const now = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <section className="page mdb-page">
      <div className="page-heading">
        <div>
          <h1>Dashboard ภาพรวมแรงงานต่างด้าว</h1>
          <p className="mdb-subtitle">{now}</p>
        </div>
        <button className="btn secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? "spin" : ""} /> รีเฟรช
        </button>
      </div>

      {error && <div className="mdb-error">{error}</div>}

      <div className="mdb-kpi-grid">
        <KpiCard icon={Users} label="พนักงานที่ใช้งาน" value={activeWorkers.length} sub="คน" />
        <KpiCard icon={FileText} label="เอกสารทั้งหมด" value={activeDocs.length} sub="ฉบับ" />
        <KpiCard
          icon={XCircle}
          label="เอกสารหมดอายุ"
          value={expired.length}
          sub="รายการ"
          variant={expired.length > 0 ? "danger" : "default"}
        />
        <KpiCard
          icon={AlertTriangle}
          label="ใกล้ครบกำหนด"
          value={dueRows.length}
          sub="รายการ"
          variant={dueRows.length > 0 ? "warning" : "default"}
        />
        <KpiCard icon={CheckCircle2} label="เอกสารปลอดภัย" value={safeRows.length} sub="รายการ" variant="success" />
        <KpiCard icon={TrendingUp} label="รายการแจ้งเตือนทั้งหมด" value={expiryRows.length} sub="รายการ" />
      </div>

      <div className="mdb-charts-row">
        <div className="card mdb-chart-card">
          <div className="card-header">
            <div>
              <h2><FileText size={18} /> ประเภทเอกสาร</h2>
              <p>สัดส่วนเอกสารที่ใช้งานอยู่</p>
            </div>
          </div>
          {loading ? (
            <div className="mdb-loading">กำลังโหลด...</div>
          ) : docTypeSlices.length === 0 ? (
            <div className="mdb-empty">ยังไม่มีข้อมูล</div>
          ) : (
            <DonutChart slices={docTypeSlices} />
          )}
        </div>
        <div className="card mdb-chart-card">
          <div className="card-header">
            <div>
              <h2><Building2 size={18} /> แผนก</h2>
              <p>จำนวนพนักงานตามแผนก (สูงสุด 10)</p>
            </div>
          </div>
          {loading ? (
            <div className="mdb-loading">กำลังโหลด...</div>
          ) : deptData.length === 0 ? (
            <div className="mdb-empty">ยังไม่มีข้อมูล</div>
          ) : (
            <BarChart data={deptData} />
          )}
        </div>
        <div className="card mdb-chart-card">
          <div className="card-header">
            <div>
              <h2><Users size={18} /> สัญชาติ</h2>
              <p>จำนวนพนักงานตามสัญชาติ</p>
            </div>
          </div>
          {loading ? (
            <div className="mdb-loading">กำลังโหลด...</div>
          ) : natData.length === 0 ? (
            <div className="mdb-empty">ยังไม่มีข้อมูล</div>
          ) : (
            <BarChart data={natData} />
          )}
        </div>
      </div>

      {expired.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="mdb-danger-title">
                <ShieldAlert size={19} /> เอกสารหมดอายุแล้ว ({expired.length} รายการ)
              </h2>
              <p>ต้องดำเนินการต่ออายุโดยด่วน</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>พนักงาน</th>
                  <th>แผนก</th>
                  <th>ประเภทเอกสาร</th>
                  <th>รายการ</th>
                  <th>วันที่หมดอายุ</th>
                  <th>เกินไป</th>
                </tr>
              </thead>
              <tbody>
                {expired.map((r) => (
                  <tr key={`${r.doc.id}-${r.field}`} className="mdb-row-expired">
                    <td>
                      <b>{r.worker.fullName}</b>
                      <small>{r.worker.employeeCode}</small>
                    </td>
                    <td>{r.worker.department}</td>
                    <td>
                      <span className="mdb-doc-badge" style={{ background: DOC_COLORS[r.doc.documentType] }}>
                        {labels[r.doc.documentType]}
                      </span>
                    </td>
                    <td>{r.field}</td>
                    <td>{thaiDate(r.date)}</td>
                    <td>
                      <span className="status status-expired">เกิน {formatDays(Math.abs(r.days))}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h2><CalendarClock size={19} /> รายการที่จะถึงกำหนด (10 อันดับแรก)</h2>
            <p>เรียงตามวันครบกำหนดที่ใกล้ที่สุด</p>
          </div>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="mdb-loading">กำลังโหลด...</div>
          ) : upcomingTop.length === 0 ? (
            <div className="mdb-empty">ไม่มีเอกสารที่จะครบกำหนดเร็วๆ นี้</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>พนักงาน</th>
                  <th>แผนก</th>
                  <th>ประเภทเอกสาร</th>
                  <th>รายการ</th>
                  <th>วันครบกำหนด</th>
                  <th>ระยะเวลา</th>
                </tr>
              </thead>
              <tbody>
                {upcomingTop.map((r) => {
                  const state = r.days <= r.doc.remindDays ? "due" : "normal";
                  return (
                    <tr key={`${r.doc.id}-${r.field}`}>
                      <td>
                        <b>{r.worker.fullName}</b>
                        <small>{r.worker.employeeCode}</small>
                      </td>
                      <td>{r.worker.department}</td>
                      <td>
                        <span className="mdb-doc-badge" style={{ background: DOC_COLORS[r.doc.documentType] }}>
                          {labels[r.doc.documentType]}
                        </span>
                      </td>
                      <td>{r.field}</td>
                      <td>{thaiDate(r.date)}</td>
                      <td>
                        <span className={`status status-${state}`}>
                          {r.days === 0 ? "ครบกำหนดวันนี้" : `อีก ${formatDays(r.days)}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  variant = "default",
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  sub: string;
  variant?: "default" | "danger" | "warning" | "success";
}) {
  return (
    <div className={`card mdb-kpi-card mdb-kpi-${variant}`}>
      <div className="mdb-kpi-header">
        <span className="mdb-kpi-label">{label}</span>
        <div className="mdb-kpi-icon-wrap">
          <Icon size={18} />
        </div>
      </div>
      <div className="mdb-kpi-value">
        {value.toLocaleString("th-TH")} <span className="mdb-kpi-sub">{sub}</span>
      </div>
    </div>
  );
}

function BarChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="mdb-bar-chart">
      {data.map((d) => (
        <div key={d.label} className="mdb-bar-item">
          <div className="mdb-bar-label">
            <span>{d.label}</span>
            <b>{d.value}</b>
          </div>
          <div className="mdb-bar-track">
            <div
              className="mdb-bar-fill"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ slices }: { slices: Array<{ label: string; value: number; color: string }> }) {
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  if (total === 0) return null;

  let acc = 0;
  const gradientParts = slices.map((s) => {
    const start = (acc / total) * 100;
    acc += s.value;
    const end = (acc / total) * 100;
    return `${s.color} ${start}% ${end}%`;
  });
  const conic = `conic-gradient(${gradientParts.join(", ")})`;

  return (
    <div className="mdb-donut-wrap">
      <div className="mdb-donut" style={{ background: conic }}>
        <div className="mdb-donut-hole">
          <b>{total}</b>
          <small>ฉบับ</small>
        </div>
      </div>
      <div className="mdb-donut-legend">
        {slices.map((s) => (
          <div key={s.label} className="mdb-donut-legend-item">
            <span className="mdb-donut-dot" style={{ background: s.color }} />
            <span className="mdb-donut-legend-label">{s.label}</span>
            <b>{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
