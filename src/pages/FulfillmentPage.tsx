import { CheckCircle2, Clock3, PackageCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Confirm, Empty, Toast } from "../components/ui";
import { useIssueRequests } from "../store/IssueRequestContext";
import type { IssueRequest } from "../types";
import { formatThaiDateTime } from "../utils/date";

export function FulfillmentPage() {
  const { requests, ready, loading, fulfill } = useIssueRequests();
  const [selected, setSelected] = useState<IssueRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const completed = useMemo(
    () => requests.filter((request) => request.status === "FULFILLED"),
    [requests],
  );

  const complete = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      await fulfill(selected.id);
      setSelected(null);
      setToast("บันทึกการเบิกของเรียบร้อยและตัดสต็อกแล้ว");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "ไม่สามารถบันทึกได้");
    } finally {
      setSaving(false);
    }
  };

  const card = (request: IssueRequest, actionable: boolean) => (
    <article className="issue-request-card" key={request.id}>
      <header>
        <div>
          <span className={`issue-request-status ${actionable ? "ready-to-fulfill" : "fulfilled"}`}>
            {actionable ? <Clock3 size={15} /> : <CheckCircle2 size={15} />}
            {actionable ? "รอเบิกของ" : "เบิกของเรียบร้อยแล้ว"}
          </span>
          <h3>{request.requestNo}</h3>
          <p>{formatThaiDateTime(request.createdAt)} · ผู้ขอ {request.requestedByName}</p>
        </div>
        {actionable && (
          <button className="btn primary" onClick={() => setSelected(request)}>
            <PackageCheck size={17} /> เบิกของเรียบร้อยแล้ว
          </button>
        )}
      </header>
      <div className="issue-request-meta">
        <span><b>ชื่อผู้รับสินค้า:</b> {request.recipientName}</span>
        <span><b>แผนก:</b> {request.department}</span>
        <span><b>ผู้อนุมัติ:</b> {request.reviewedByName ?? "-"}</span>
        {request.fulfilledByName && <span><b>ผู้เบิกของ:</b> {request.fulfilledByName}</span>}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>สินค้า</th><th>จำนวน</th><th>ตำแหน่ง</th><th>หมายเหตุ</th></tr></thead>
          <tbody>{request.lines.map((line) => <tr key={line.id}>
            <td><b>{line.itemName}</b><small className="cell-subtitle">{line.sku}</small></td>
            <td>{line.quantity} {line.unit}</td><td>{line.locationName}</td><td>{line.note || "-"}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </article>
  );

  return <div className="page-stack issue-requests-page">
    <div className="page-header"><div><h1>คำรอเบิก</h1><p>รายการที่อนุมัติแล้วและรอจัดเตรียมสินค้า</p></div><span className="request-count-badge">รอดำเนินการ {ready.length}</span></div>
    {loading && !requests.length ? <div className="route-loading">กำลังโหลดคำรอเบิก...</div> : ready.length ? ready.map((request) => card(request, true)) : <Empty text="ไม่มีคำรอเบิก เมื่อคำขอได้รับอนุมัติ รายการจะปรากฏที่หน้านี้" />}
    <div className="section-heading"><div><h2>ประวัติที่ฉันดำเนินการ</h2><span>{completed.length} รายการ</span></div></div>
    {completed.slice(0, 20).map((request) => card(request, false))}
    {selected && <Confirm title="ยืนยันว่าเบิกของเรียบร้อยแล้ว" detail={`ระบบจะตัดสต็อก ${selected.lines.length} รายการของ ${selected.requestNo} ทันที`} onConfirm={() => void complete()} onCancel={() => !saving && setSelected(null)} />}
    {error && <Toast message={error} />}
    {toast && <Toast message={toast} />}
  </div>;
}
