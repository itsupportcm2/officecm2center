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
import { useEffect, useMemo, useState } from "react";
import {
  migrantWorkerService,
  type ForeignWorker,
  type MigrantDocumentType,
  type MigrantWorkerDocument,
} from "../services/migrantWorkerService";

const labels: Record<MigrantDocumentType, string> = {
  PASSPORT_RED: "พาสปอร์ตสีแดง",
  PASSPORT_GREEN: "พาสปอร์ตสีเขียว",
  PINK_CARD: "บัตรชมพู",
  TEN_YEAR_CARD: "บัตร 10 ปี",
};
const DOC_COLORS: Record<MigrantDocumentType, string> = {
  PASSPORT_RED: "#ef4444",
  PASSPORT_GREEN: "#22c55e",
  PINK_CARD: "#ec4899",
  TEN_YEAR_CARD: "#8b5cf6",
};

const daysUntil = (date: string) =>
  Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000,
  );
const thaiDate = (date: string) =>
  new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
const formatDays = (abs: number): string => {
  if (abs < 30) return `${abs} วัน`;
  const years = Math.floor(abs / 365);
  const rem = abs % 365;
  const months = Math.floor(rem / 30);
  const days = rem % 30;
  if (years > 0) return months > 0 ? `${years} ปี ${months} เดือน` : `${years} ปี`;
  return days > 0 ? `${months} เดือน ${days} วัน` : `${months} เดือน`;
};

interface ExpiryRow {
  worker: ForeignWorker;
  doc: MigrantWorkerDocument;
  field: string;
  date: string;
  days: number;
}
function buildExpiryRows(workers: ForeignWorker[], documents: MigrantWorkerDocument[]): ExpiryRow[] {
  const wMap = new Map(workers.map((w) => [w.id, w]));
  const rows: ExpiryRow[] = [];
  for (const d of documents) {
    if (!d.isActive) continue;
    const w = wMap.get(d.workerId);
    if (!w) continue;
    const push = (field: string, date: string | null) => {
      if (!date) return;
      rows.push({ worker: w, doc: d, field, date, days: daysUntil(date) });
    };
    push(d.documentType.includes("PASSPORT") ? "วันหมดอายุเล่มพาสปอร์ต" : "วันหมดอายุบัตร", d.expiresOn);
    push("วันหมดอายุวีซ่า", d.visaExpiresOn);
    push("วันหมดอายุใบออกนอกพื้นที่", d.areaPermitExpiresOn);
    push("วันหมดอายุใบอนุญาตทำงาน", d.workPermitExpiresOn);
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="mdb-bar-chart">
      {data.map((d) => (
        <div key={d.label} className="mdb-bar-row">
          <span className="mdb-bar-label">{d.label}</span>
          <div className="mdb-bar-track">
            <div className="mdb-bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
          </div>
          <span className="mdb-bar-value">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const R = 42;
  const cx = 56;
  const cy = 56;
  const circumference = 2 * Math.PI * R;
  return (
    <div className="mdb-donut-wrap">
      <svg viewBox="0 0 112 112" className="mdb-donut-svg">
        {slices.map((s) => {
          const pct = s.value / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const rotation = offset * 360 - 90;
          offset += pct;
          return (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={14}
              strokeDasharray={`${dash} ${gap}`}
              style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${cx}px ${cy}px` }}
            />
          );
        })}
        <text x={cx} y={cy + 6} textAnchor="middle" className="mdb-donut-total">
          {total}
        </text>
      </svg>
      <div className="mdb-donut-legend">
        {slices.map((s) => (
          <div key={s.label} className="mdb-legend-row">
            <span className="mdb-legend-dot" style={{ background: s.color }} />
            <span className="mdb-legend-label">{s.label}</span>
            <span className="mdb-legend-val">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  variant?: "default" | "danger" | "warning" | "success";
}) {
  return (
    <article className={`mdb-kpi mdb-kpi-${variant}`}>
      <div className="mdb-kpi-icon"><Icon size={22} /></div>
      <div className="mdb-kpi-body">
        <span className="mdb-kpi-label">{label}</span>
        <b className="mdb-kpi-value">{value}</b>
        {sub && <small className="mdb-kpi-sub">{sub}</small>}
      </div>
    </article>
  );
}

export function MigrantDashboardPage() {
  const [workers, setWorkers] = useState<ForeignWorker[]>([]);
  const [documents, setDocuments] = useState<MigrantWorkerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await migrantWorkerService.load();
      setWorkers(data.workers);
      setDocuments(data.documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const activeWorkers = useMemo(() => workers.filter((w) => w.isActive), [workers]);
  const activeDocs = useMemo(() => documents.filter((d) => d.isActive), [documents]);
  const expiryRows = useMemo(() => buildExpiryRows(workers, documents), [workers, documents]);
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
    for (const w of activeWorkers) counts.set(w.department, (counts.get(w.department) ?? 0) + 1);
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
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  }).format(new Date());

  return (
    <section className="page mdb-page">
      <div className="page-heading">
        <div>
          <h1>Dashboard ? ต่อภาษีแรงงานต่างด้าว</h1>
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
        <KpiCard icon={XCircle} label="เอกสารหมดอายุ" value={expired.length} sub="รายการ"
          variant={expired.length > 0 ? "danger" : "default"} />
        <KpiCard icon={AlertTriangle} label="ใกล้ครบกำหนด" value={dueRows.length} sub="รายการ"
          variant={dueRows.length > 0 ? "warning" : "default"} />
        <KpiCard icon={CheckCircle2} label="เอกสารปลอดภัย" value={safeRows.length} sub="รายการ"
          variant="success" />
        <KpiCard icon={TrendingUp} label="รายการแจ้งเตือนทั้งหมด" value={expiryRows.length} sub="รายการ" />
      </div>

      <div className="mdb-charts-row">
        <div className="card mdb-chart-card">
          <div className="card-header">
            <div><h2><FileText size={18} /> ประเภทเอกสาร</h2><p>สัดส่วนเอกสารที่ใช้งานอยู่</p></div>
          </div>
          {loading ? <div className="mdb-loading">กำลังโหลด...</div>
            : docTypeSlices.length === 0 ? <div className="mdb-empty">ยังไม่มีข้อมูล</div>
            : <DonutChart slices={docTypeSlices} />}
        </div>
        <div className="card mdb-chart-card">
          <div className="card-header">
            <div><h2><Building2 size={18} /> แผนก</h2><p>จำนวนพนักงานแต่ละแผนก (สูงสุด 10)</p></div>
          </div>
          {loading ? <div className="mdb-loading">กำลังโหลด...</div>
            : deptData.length === 0 ? <div className="mdb-empty">ยังไม่มีข้อมูล</div>
            : <BarChart data={deptData} />}
        </div>
        <div className="card mdb-chart-card">
          <div className="card-header">
            <div><h2><Users size={18} /> สัญชาติ</h2><p>จำนวนพนักงานแต่ละสัญชาติ</p></div>
          </div>
          {loading ? <div className="mdb-loading">กำลังโหลด...</div>
            : natData.length === 0 ? <div className="mdb-empty">ยังไม่มีข้อมูล</div>
            : <BarChart data={natData} />}
        </div>
      </div>

      {expired.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="mdb-danger-title"><ShieldAlert size={19} /> เอกสารหมดอายุแล้ว ({expired.length} รายการ)</h2>
              <p>ต้องดำเนินการต่ออายุโดยด่วน</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>พนักงาน</th><th>แผนก</th><th>ประเภทเอกสาร</th><th>รายการ</th><th>วันหมดอายุ</th><th>เกินมา</th></tr></thead>
              <tbody>
                {expired.map((r) => (
                  <tr key={`${r.doc.id}-${r.field}`} className="mdb-row-expired">
                    <td><b>{r.worker.fullName}</b><small>{r.worker.employeeCode}</small></td>
                    <td>{r.worker.department}</td>
                    <td>
                      <span className="mdb-doc-badge" style={{ background: DOC_COLORS[r.doc.documentType] }}>
                        {labels[r.doc.documentType]}
                      </span>
                    </td>
                    <td>{r.field}</td>
                    <td>{thaiDate(r.date)}</td>
                    <td><span className="status status-expired">เกิน {formatDays(Math.abs(r.days))}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div><h2><CalendarClock size={19} /> รายการที่จะถึงกำหนด (10 อันดับแรก)</h2><p>เรียงตามวันครบกำหนดจากใกล้สุด</p></div>
        </div>
        <div className="table-wrap">
          {loading ? <div className="mdb-loading">กำลังโหลด...</div>
          : upcomingTop.length === 0 ? <div className="mdb-empty">ไม่มีเอกสารที่จะครบกำหนดในเร็วๆ นี้</div>
          : (
            <table>
              <thead><tr><th>พนักงาน</th><th>แผนก</th><th>ประเภทเอกสาร</th><th>รายการ</th><th>วันครบกำหนด</th><th>คงเหลือ</th></tr></thead>
              <tbody>
                {upcomingTop.map((r) => {
                  const state = r.days <= r.doc.remindDays ? "due" : "normal";
                  return (
                    <tr key={`${r.doc.id}-${r.field}`}>
                      <td><b>{r.worker.fullName}</b><small>{r.worker.employeeCode}</small></td>
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
