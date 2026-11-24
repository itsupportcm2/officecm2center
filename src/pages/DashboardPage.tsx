import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useStock } from "../store/StockContext";
import { useAuth } from "../store/AuthContext";
import { formatThaiDate } from "../utils/date";

export function DashboardPage() {
  const { items, locations, transactions } = useStock();
  const { user } = useAuth();
  const activeItems = items.filter((item) => item.isActive);
  const low = activeItems.filter(
    (item) => item.quantity > 0 && item.quantity <= item.minStock,
  );
  const out = activeItems.filter((item) => item.quantity === 0);
  const urgent = [...out, ...low];
  const normal = Math.max(0, activeItems.length - urgent.length);
  const time = (date: string) =>
    new Intl.DateTimeFormat("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  const locationName = (id: string) =>
    locations.find((location) => location.id === id)?.name;

  return (
    <div className="essential-dashboard">
      {/* Modern Corporate Hero Banner */}
      <section className="mwp-hero ops-dashboard-hero">
        <div className="mwp-hero-content">
          <div className="mwp-hero-badge">
            <ShieldCheck size={14} />
            <span>ระบบจัดการวัสดุสำนักงานและคลังพัสดุ • CM Frozen Foods</span>
          </div>
          <h1>สวัสดีคุณ {user?.name ?? "ผู้ใช้งาน"} 👋</h1>
          <p className="mwp-hero-desc">
            ภาพรวมสต็อกวัสดุสำนักงาน คำขอเบิก-จ่าย และรายการเฝ้าระวังประจำวันที่{" "}
            {formatThaiDate(new Date(), {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="mwp-hero-actions">
          {(user?.role === "admin" ||
            user?.role === "staff" ||
            user?.role === "fulfiller") && (
            <>
              <Link to="/stock-in" className="mwp-btn-hero-primary">
                <ArrowDownToLine size={16} />
                <span>รับสินค้าเข้า</span>
              </Link>
              <Link to="/stock-out" className="mwp-btn-hero-glass">
                <ArrowUpFromLine size={16} />
                <span>เบิกสินค้าออก</span>
              </Link>
            </>
          )}
          <Link to="/inventory" className="mwp-btn-hero-glass">
            <Boxes size={16} />
            <span>ดูคลังสินค้า</span>
          </Link>
        </div>
      </section>

      {/* 4-Card KPI Summary Grid */}
      <section className="mwp-stats-grid ops-kpi-grid">
        <Link to="/inventory" className="mwp-stat-card mwp-stat-blue ops-kpi-link">
          <div className="mwp-stat-top">
            <span className="mwp-stat-title">รายการสินค้าทั้งหมด</span>
            <div className="mwp-stat-icon">
              <Boxes size={18} />
            </div>
          </div>
          <div className="mwp-stat-val-row">
            <span className="mwp-stat-val tabular-nums">{activeItems.length.toLocaleString("th-TH")}</span>
            <span className="mwp-stat-unit">รายการ</span>
          </div>
          <div className="mwp-stat-hint">
            <span>คลิกเพื่อเปิดคลังสินค้า</span>
          </div>
        </Link>

        <Link to="/inventory" className="mwp-stat-card mwp-stat-teal ops-kpi-link">
          <div className="mwp-stat-top">
            <span className="mwp-stat-title">สถานะพร้อมเบิกปกติ</span>
            <div className="mwp-stat-icon">
              <PackageCheck size={18} />
            </div>
          </div>
          <div className="mwp-stat-val-row">
            <span className="mwp-stat-val tabular-nums">{normal.toLocaleString("th-TH")}</span>
            <span className="mwp-stat-unit">รายการ</span>
          </div>
          <div className="mwp-stat-hint" style={{ color: "#0d9488", fontWeight: 600 }}>
            <CheckCircle2 size={12} />
            <span>สต็อกเพียงพอต่อการใช้งาน</span>
          </div>
        </Link>

        <Link to="/low-stock" className="mwp-stat-card mwp-stat-orange ops-kpi-link">
          <div className="mwp-stat-top">
            <span className="mwp-stat-title">สินค้าใกล้หมดสต็อก</span>
            <div className="mwp-stat-icon">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mwp-stat-val-row">
            <span className="mwp-stat-val tabular-nums">{low.length.toLocaleString("th-TH")}</span>
            <span className="mwp-stat-unit">รายการ</span>
          </div>
          <div className="mwp-stat-hint" style={{ color: "#ea580c", fontWeight: 600 }}>
            <AlertTriangle size={12} />
            <span>ต่ำกว่าหรือเท่ากับขั้นต่ำ</span>
          </div>
        </Link>

        <Link to="/low-stock" className="mwp-stat-card mwp-stat-red ops-kpi-link">
          <div className="mwp-stat-top">
            <span className="mwp-stat-title">สินค้าหมดสต็อก (ต้องสั่งซื้อ)</span>
            <div className="mwp-stat-icon">
              <AlertOctagon size={18} />
            </div>
          </div>
          <div className="mwp-stat-val-row">
            <span className="mwp-stat-val tabular-nums">{out.length.toLocaleString("th-TH")}</span>
            <span className="mwp-stat-unit">รายการ</span>
          </div>
          <div className="mwp-stat-hint" style={{ color: "#dc2626", fontWeight: 600 }}>
            <AlertOctagon size={12} />
            <span>ควรดำเนินการจัดซื้อทันที</span>
          </div>
        </Link>
      </section>

      <section
        className={`essential-top-grid ${user?.role === "viewer" ? "viewer" : ""}`}
      >
        {(user?.role === "admin" ||
          user?.role === "staff" ||
          user?.role === "fulfiller") && (
          <div className="essential-actions">
            <Link className="essential-action receive" to="/stock-in">
              <span>
                <ArrowDownToLine />
              </span>
              <div>
                <strong>รับสินค้าเข้า</strong>
                <small>บันทึกรับสินค้าเข้าคลัง</small>
              </div>
              <ArrowRight />
            </Link>
            <Link className="essential-action issue" to="/stock-out">
              <span>
                <ArrowUpFromLine />
              </span>
              <div>
                <strong>เบิกสินค้าออก</strong>
                <small>บันทึกการเบิกสินค้า</small>
              </div>
              <ArrowRight />
            </Link>
          </div>
        )}
        <article className="stock-health">
          <header>
            <div>
              <Boxes />
              <h2>สถานะสต็อกโดยรวม</h2>
            </div>
            <small>
              ข้อมูลล่าสุด{" "}
              {formatThaiDate(new Date(), {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </small>
          </header>
          {activeItems.length ? (
            <>
              <div
                className="health-bar"
                aria-label={`ต้องสั่งซื้อ ${out.length} ใกล้หมด ${low.length} ปกติ ${normal}`}
              >
                <i className="out" style={{ flex: out.length || 0.3 }} />
                <i className="low" style={{ flex: low.length || 0.3 }} />
                <i className="normal" style={{ flex: normal || 0.3 }} />
              </div>
              <div className="health-numbers">
                <div className="danger">
                  <span>ต้องสั่งซื้อ</span>
                  <strong>{out.length}</strong>
                  <small>รายการ</small>
                </div>
                <div className="warning">
                  <span>ใกล้หมด</span>
                  <strong>{low.length}</strong>
                  <small>รายการ</small>
                </div>
                <div className="healthy">
                  <span>ปกติ</span>
                  <strong>{normal}</strong>
                  <small>รายการ</small>
                </div>
              </div>
              <p className="health-total">
                ประเมินสถานะเป็นรายสินค้า โดยไม่รวมจำนวนสินค้าที่ต่างหน่วยกัน
              </p>
            </>
          ) : (
            <div className="health-empty">
              <Boxes />
              <div>
                <b>ยังไม่มีข้อมูลสต็อก</b>
                <span>เพิ่มสินค้าและรับสินค้าเข้าเพื่อเริ่มดูภาพรวม</span>
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="essential-content-grid">
        <article className="essential-panel urgent-worklist">
          <header>
            <div className="essential-panel-title">
              <AlertTriangle />
              <div>
                <h2>รายการที่ต้องดำเนินการด่วน</h2>
                <p>สินค้าที่ต่ำกว่าระดับขั้นต่ำ ควรสั่งซื้อโดยเร็ว</p>
              </div>
            </div>
            <Link to="/low-stock">
              ดูสินค้าทั้งหมด <ArrowRight />
            </Link>
          </header>
          <div className="table-wrap">
            <table className="essential-table">
              <thead>
                <tr>
                  <th>สินค้า</th>
                  <th>รหัส</th>
                  <th>คงเหลือ</th>
                  <th>ขั้นต่ำ</th>
                  <th>ตำแหน่งจัดเก็บ</th>
                  <th>การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {urgent.slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.name}</b>
                    </td>
                    <td className="mono">{item.sku}</td>
                    <td>
                      <strong className="negative">
                        {item.quantity} {item.unit}
                      </strong>
                    </td>
                    <td>
                      {item.minStock} {item.unit}
                    </td>
                    <td>{locationName(item.locationId) ?? "-"}</td>
                    <td>
                      {user?.role === "viewer" ? (
                        <Link
                          className="order-btn"
                          to={`/inventory/${item.id}`}
                        >
                          ดูรายละเอียด
                        </Link>
                      ) : (
                        <Link className="order-btn" to="/low-stock">
                          <FileText />
                          สร้างใบขอซื้อ
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {urgent.length === 0 && (
                  <tr>
                    <td className="essential-empty" colSpan={6}>
                      {activeItems.length
                        ? "สต็อกทุกรายการอยู่ในระดับปกติ"
                        : "ยังไม่มีสินค้าในระบบ"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="essential-panel compact-activity">
          <header>
            <div className="essential-panel-title">
              <Clock3 />
              <div>
                <h2>ความเคลื่อนไหวล่าสุด</h2>
                <p>
                  รายการล่าสุดของวันนี้ (
                  {formatThaiDate(new Date(), {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  )
                </p>
              </div>
            </div>
            <Link to="/history">
              ดูทั้งหมด <ArrowRight />
            </Link>
          </header>
          <div className="essential-activity-list">
            {transactions.length ? (
              transactions.slice(0, 5).map((transaction) => {
                const item = items.find(
                  (candidate) => candidate.id === transaction.itemId,
                );
                const incoming = transaction.type === "IN";
                const adjusting = transaction.type === "ADJUST";
                const transferring = transaction.type === "TRANSFER";
                const label = incoming
                  ? "รับสินค้าเข้า"
                  : transaction.type === "OUT"
                    ? "เบิกสินค้าออก"
                    : adjusting
                      ? "ปรับยอดสินค้า"
                      : "โอนย้ายสินค้า";
                return (
                  <div className="essential-activity" key={transaction.id}>
                    <i
                      className={
                        incoming
                          ? "in"
                          : adjusting || transferring
                            ? "edit"
                            : "out"
                      }
                    />
                    <span
                      className={`essential-activity-icon ${incoming ? "in" : adjusting || transferring ? "edit" : "out"}`}
                    >
                      {incoming ? (
                        <ArrowDownToLine />
                      ) : adjusting ? (
                        <ClipboardList />
                      ) : transferring ? (
                        <ArrowRightLeft />
                      ) : (
                        <ArrowUpFromLine />
                      )}
                    </span>
                    <div>
                      <b>{label}</b>
                      <p>
                        {item?.name} {transaction.quantity} {item?.unit}
                      </p>
                      <small>โดย {transaction.user}</small>
                    </div>
                    <time>{time(transaction.createdAt)}</time>
                  </div>
                );
              })
            ) : (
              <div className="essential-activity-empty">
                <Clock3 />
                <span>ยังไม่มีความเคลื่อนไหววันนี้</span>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
