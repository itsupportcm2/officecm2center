import {
  CheckCircle2,
  Clock3,
  Eye,
  PackagePlus,
  Plus,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Empty, Modal, Toast } from "../components/ui";
import { useAuth } from "../store/AuthContext";
import { useIssueRequests } from "../store/IssueRequestContext";
import { useStock } from "../store/StockContext";
import type { IssueRequest, IssueRequestStatus, Item } from "../types";
import { formatThaiDateTime } from "../utils/date";
import { SignaturePad } from "../components/SignaturePad";
import { issueRequestService } from "../services/issueRequestService";

const statusLabel: Record<IssueRequestStatus, string> = {
  PENDING: "รออนุมัติ",
  READY_TO_FULFILL: "อนุมัติแล้ว–รอเบิก",
  FULFILLED: "เบิกของเรียบร้อยแล้ว",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิก",
};
const statusIcon: Record<IssueRequestStatus, typeof Clock3> = {
  PENDING: Clock3,
  READY_TO_FULFILL: Clock3,
  FULFILLED: CheckCircle2,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  CANCELLED: XCircle,
};
type DraftLine = {
  key: string;
  itemId: string;
  locationId: string;
  quantity: number;
  note: string;
};
const blankLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  itemId: "",
  locationId: "",
  quantity: 1,
  note: "",
});

function RequestSignature({
  request,
  approval = false,
}: {
  request: IssueRequest;
  approval?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const path = approval
    ? request.approvalSignaturePath
    : request.signaturePath;
  if (!path) return null;
  const view = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      setUrl(
        approval
          ? await issueRequestService.approvalSignatureUrl(path)
          : await issueRequestService.signatureUrl(path),
      );
    } catch {
      setError("ไม่สามารถเปิดลายเซ็นได้");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="request-signature">
      <div>
        <b>{approval ? "ลายเซ็นผู้อนุมัติ" : "ลายเซ็นหัวหน้าแผนก"}</b>
        <small>{approval ? `ลงนามโดย ${request.reviewedByName ?? "เจ้าหน้าที่"}` : "แนบโดยผู้ส่งคำขอ"}</small>
      </div>
      {url ? (
        <img src={url} alt={`${approval ? "ลายเซ็นผู้อนุมัติ" : "ลายเซ็นหัวหน้าแผนก"}ของคำขอ ${request.requestNo}`} />
      ) : (
        <button
          className="btn compact secondary"
          onClick={() => void view()}
          disabled={loading}
        >
          <Eye size={16} />
          {loading ? "กำลังเปิด..." : "ดูลายเซ็น"}
        </button>
      )}
      {error && <span className="negative">{error}</span>}
    </div>
  );
}

function RequestCard({
  request,
  operator,
  onApprove,
  onReject,
  onCancel,
}: {
  request: IssueRequest;
  operator: boolean;
  onApprove?: (request: IssueRequest) => void;
  onReject?: (request: IssueRequest) => void;
  onCancel?: (request: IssueRequest) => void;
}) {
  const Icon = statusIcon[request.status];
  const short = request.lines.some(
    (line) => line.quantity > line.availableQuantity,
  );
  return (
    <article className="issue-request-card">
      <header>
        <div>
          <span
            className={`issue-request-status ${request.status.toLowerCase()}`}
          >
            <Icon size={15} />
            {statusLabel[request.status]}
          </span>
          <h3>{request.requestNo}</h3>
          <p>
            {formatThaiDateTime(request.createdAt)} · ผู้ขอ{" "}
            {request.requestedByName}
          </p>
        </div>
        {request.status === "PENDING" && operator && (
          <div className="row-actions">
            <button
              className="btn compact secondary"
              onClick={() => onReject?.(request)}
            >
              <XCircle size={16} />
              ไม่อนุมัติ
            </button>
            <button
              className="btn compact primary"
              disabled={short}
              onClick={() => onApprove?.(request)}
            >
              <CheckCircle2 size={16} />
              อนุมัติ
            </button>
          </div>
        )}
        {request.status === "PENDING" && !operator && (
          <button
            className="btn compact secondary"
            onClick={() => onCancel?.(request)}
          >
            ยกเลิกคำขอ
          </button>
        )}
      </header>
      <div className="issue-request-meta">
        <span>
          <b>ผู้รับ:</b> {request.recipientName}
        </span>
        <span>
          <b>แผนก:</b> {request.department}
        </span>
        {request.reviewedByName && (
          <span>
            <b>ผู้ตรวจสอบ:</b> {request.reviewedByName}
          </span>
        )}
      </div>
      <RequestSignature request={request} />
      <RequestSignature request={request} approval />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>สินค้า</th>
              <th>ตำแหน่ง</th>
              <th>จำนวนขอเบิก</th>
              <th>หมายเหตุ</th>
              {request.status === "PENDING" && operator && (
                <th>คงเหลือปัจจุบัน</th>
              )}
            </tr>
          </thead>
          <tbody>
            {request.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <b>{line.itemName}</b>
                  <small className="cell-subtitle">{line.sku}</small>
                </td>
                <td>{line.locationName}</td>
                <td>
                  {line.quantity} {line.unit}
                </td>
                <td>{line.note || "—"}</td>
                {request.status === "PENDING" && operator && (
                  <td
                    className={
                      line.quantity > line.availableQuantity ? "negative" : ""
                    }
                  >
                    {line.availableQuantity} {line.unit}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {short && request.status === "PENDING" && operator && (
        <p className="form-error">
          สต็อกไม่พออย่างน้อยหนึ่งรายการ จึงยังอนุมัติไม่ได้
        </p>
      )}
      {request.note && (
        <p className="issue-request-note">
          <b>หมายเหตุ:</b> {request.note}
        </p>
      )}
      {request.rejectionReason && (
        <p className="issue-request-rejection">
          <b>เหตุผลที่ไม่อนุมัติ:</b> {request.rejectionReason}
        </p>
      )}
    </article>
  );
}

function IssueRequestReview({
  recipientName,
  department,
  lines,
  items,
  getLocationQuantity,
  signaturePreview,
  saving,
  onBack,
  onConfirm,
}: {
  recipientName: string;
  department: string;
  lines: DraftLine[];
  items: Item[];
  getLocationQuantity: (itemId: string, locationId: string) => number;
  signaturePreview: string;
  saving: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title="ตรวจสอบคำขอก่อนส่ง"
      onClose={() => {
        if (!saving) onBack();
      }}
    >
      <div className="modal-body issue-review-body">
        <div className="issue-review-meta">
          <span>
            <small>ชื่อผู้รับสินค้า</small>
            <b>{recipientName.trim()}</b>
          </span>
          <span>
            <small>แผนก</small>
            <b>{department}</b>
          </span>
          <span>
            <small>จำนวนรายการ</small>
            <b>{lines.length} รายการ</b>
          </span>
        </div>
        <div className="table-wrap issue-review-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>สินค้า</th>
                <th>จำนวน</th>
                <th>คงเหลือ</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const item = items.find((row) => row.id === line.itemId);
                const available = getLocationQuantity(
                  line.itemId,
                  line.locationId,
                );
                return (
                  <tr key={line.key}>
                    <td>{index + 1}</td>
                    <td>
                      <b>{item?.name}</b>
                      <small>{item?.sku}</small>
                    </td>
                    <td>
                      {line.quantity} {item?.unit}
                    </td>
                    <td>
                      {available} {item?.unit}
                    </td>
                    <td>{line.note.trim() || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="issue-review-signature">
          <div>
            <small>ลายเซ็นหัวหน้าแผนก</small>
            <p>กรุณาตรวจสอบลายเซ็นก่อนยืนยันส่งคำขอ</p>
          </div>
          {signaturePreview && (
            <img src={signaturePreview} alt="ลายเซ็นหัวหน้าแผนกสำหรับคำขอนี้" />
          )}
        </div>
        <p className="issue-review-notice">
          <Clock3 size={17} />
          เมื่อยืนยันแล้ว คำขอจะถูกส่งให้เจ้าหน้าที่ตรวจสอบ
          แต่สต็อกจะยังไม่ถูกตัดจนกว่าเจ้าหน้าที่เบิกของจะปิดงาน
        </p>
      </div>
      <div className="modal-actions">
        <button className="btn secondary" disabled={saving} onClick={onBack}>
          กลับไปแก้ไข
        </button>
        <button className="btn primary" disabled={saving} onClick={onConfirm}>
          <Send size={17} />
          {saving ? "กำลังส่ง..." : "ยืนยันส่งคำขอ"}
        </button>
      </div>
    </Modal>
  );
}

export function IssueRequestsPage({
  view = "create",
}: {
  view?: "create" | "history";
}) {
  const { user } = useAuth();
  const operator = user?.role === "admin" || user?.role === "staff";
  const { items, locations, getLocationQuantity } = useStock();
  const { requests, pending, loading, create, review, cancel } =
    useIssueRequests();
  const [recipientName, setRecipientName] = useState(user?.name ?? "");
  const department = user?.department ?? "";
  const [signature, setSignature] = useState<Blob | null>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState("");
  const [approveRequest, setApproveRequest] = useState<IssueRequest | null>(
    null,
  );
  const [approvalSignature, setApprovalSignature] = useState<Blob | null>(null);
  const [approvalSignatureKey, setApprovalSignatureKey] = useState(0);
  const [rejectRequest, setRejectRequest] = useState<IssueRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const activeItems = items.filter(
    (item) => item.isActive && item.quantity > 0,
  );
  const history = requests.filter((row) =>
    operator
      ? !["PENDING", "READY_TO_FULFILL"].includes(row.status)
      : row.status !== "PENDING",
  );
  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };
  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  const selectItem = (line: DraftLine, itemId: string) => {
    const item = items.find((row) => row.id === itemId);
    const available = locations
      .filter((location) => getLocationQuantity(itemId, location.id) > 0)
      .sort(
        (left, right) =>
          getLocationQuantity(itemId, right.id) -
            getLocationQuantity(itemId, left.id) ||
          (left.id === item?.locationId
            ? -1
            : right.id === item?.locationId
              ? 1
              : 0),
      );
    updateLine(line.key, {
      itemId,
      locationId: available[0]?.id ?? "",
      quantity: 1,
    });
  };
  const valid = Boolean(
    recipientName.trim() &&
      department &&
      signature &&
      lines.length &&
      lines.every(
        (line) =>
          line.itemId &&
          line.locationId &&
          line.quantity > 0 &&
          line.quantity <= getLocationQuantity(line.itemId, line.locationId),
      ) &&
      new Set(lines.map((line) => `${line.itemId}:${line.locationId}`)).size ===
        lines.length,
  );
  const submit = async () => {
    if (!valid || saving || !signature) return;
    setSaving(true);
    try {
      await create({
        recipientName: recipientName.trim(),
        department,
        signature,
        lines: lines.map(({ itemId, locationId, quantity, note }) => ({
          itemId,
          locationId,
          quantity,
          note: note.trim(),
        })),
      });
      setReviewOpen(false);
      setLines([blankLine()]);
      setSignature(null);
      setSignatureKey((value) => value + 1);
      flash("ส่งคำขอเบิกให้เจ้าหน้าที่แล้ว");
    } catch (error) {
      flash(error instanceof Error ? error.message : "ส่งคำขอไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const approve = async () => {
    if (!approveRequest || !approvalSignature || saving) return;
    setSaving(true);
    try {
      await review(approveRequest.id, "APPROVED", undefined, approvalSignature);
      setApproveRequest(null);
      setApprovalSignature(null);
      flash("อนุมัติคำขอแล้ว และส่งไปรอเบิกเรียบร้อย");
    } catch (error) {
      flash(error instanceof Error ? error.message : "อนุมัติไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const reject = async () => {
    if (!rejectRequest || !rejectReason.trim() || saving) return;
    setSaving(true);
    try {
      await review(rejectRequest.id, "REJECTED", rejectReason.trim());
      setRejectRequest(null);
      setRejectReason("");
      flash("บันทึกการไม่อนุมัติแล้ว");
    } catch (error) {
      flash(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const requestSummary = useMemo(
    () =>
      lines
        .map((line) => {
          const item = items.find((row) => row.id === line.itemId);
          const available = getLocationQuantity(line.itemId, line.locationId);
          return item
            ? `${item.name} ${line.quantity} ${item.unit}\nคงเหลือในสต็อก ${available} ${item.unit}`
            : "";
        })
        .filter(Boolean)
        .join("\n\n"),
    [lines, items, getLocationQuantity],
  );
  useEffect(() => {
    if (!reviewOpen || !signature) {
      setSignaturePreview("");
      return;
    }
    const url = URL.createObjectURL(signature);
    setSignaturePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [reviewOpen, signature]);

  if (operator)
    return (
      <div className="page-stack issue-requests-page">
        <div className="page-actions">
          <div>
            <h2>คำขอเบิกที่รออนุมัติ</h2>
            <p className="page-intro">
              ตรวจสอบและลงลายเซ็นก่อนอนุมัติ จากนั้นรายการจะถูกส่งไปรอเบิกโดยยังไม่ตัดสต็อก
            </p>
          </div>
          <span className="request-count-badge">{pending.length} รายการรอ</span>
        </div>
        {loading && !requests.length ? (
          <div className="card empty">กำลังโหลดคำขอ...</div>
        ) : pending.length ? (
          pending.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              operator
              onApprove={(request) => {
                setApproveRequest(request);
                setApprovalSignature(null);
                setApprovalSignatureKey((value) => value + 1);
              }}
              onReject={(request) => {
                setRejectRequest(request);
                setRejectReason("");
              }}
            />
          ))
        ) : (
          <section className="card">
            <Empty text="ไม่มีคำขอที่รออนุมัติ" />
          </section>
        )}
        <div className="section-heading">
          <h2>ประวัติการพิจารณา</h2>
          <span>{history.length} รายการ</span>
        </div>
        {history.length ? (
          history.map((request) => (
            <RequestCard key={request.id} request={request} operator />
          ))
        ) : (
          <section className="card">
            <Empty text="ยังไม่มีประวัติคำขอเบิก" />
          </section>
        )}
        {approveRequest && (
          <Modal
            title="ลงลายเซ็นเพื่ออนุมัติคำขอ"
            onClose={() => {
              if (!saving) setApproveRequest(null);
            }}
          >
            <div className="modal-body">
              <p className="page-intro">
                {approveRequest.requestNo} — ตรวจสอบแล้วลงลายเซ็นผู้อนุมัติ
                จากนั้นคำขอจะถูกส่งไปยังหน้าคำรอเบิก
              </p>
              <SignaturePad
                onChange={setApprovalSignature}
                resetKey={approvalSignatureKey}
                title="ลายเซ็นผู้อนุมัติ *"
                instruction="เจ้าหน้าที่ผู้ตรวจสอบลงลายเซ็นในกรอบด้านล่าง"
                disclaimer="ลายเซ็นนี้จะผูกกับคำขอและไม่สามารถแก้ไขได้หลังอนุมัติ"
                ariaLabel="พื้นที่วาดลายเซ็นผู้อนุมัติ"
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn secondary"
                disabled={saving}
                onClick={() => setApproveRequest(null)}
              >
                กลับไปตรวจสอบ
              </button>
              <button
                className="btn primary"
                disabled={!approvalSignature || saving}
                onClick={() => void approve()}
              >
                <CheckCircle2 size={17} />
                {saving ? "กำลังอนุมัติ..." : "ยืนยันอนุมัติ"}
              </button>
            </div>
          </Modal>
        )}{" "}
        {rejectRequest && (
          <Modal title="ไม่อนุมัติคำขอ" onClose={() => setRejectRequest(null)}>
            <div className="modal-body">
              <label>
                เหตุผลที่ไม่อนุมัติ *
                <textarea
                  autoFocus
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="ระบุเหตุผลเพื่อแจ้งผู้ขอเบิก"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="btn secondary"
                onClick={() => setRejectRequest(null)}
              >
                ยกเลิก
              </button>
              <button
                className="btn danger"
                disabled={!rejectReason.trim() || saving}
                onClick={() => void reject()}
              >
                ยืนยันไม่อนุมัติ
              </button>
            </div>
          </Modal>
        )}
        {toast && <Toast message={toast} />}
      </div>
    );

  if (view === "history")
    return (
      <div className="page-stack issue-requests-page">
        <div>
          <h2>คำขอของฉัน</h2>
          <p className="page-intro">ติดตามสถานะคำขอเบิกและผลการพิจารณา</p>
        </div>
        {loading && !requests.length ? (
          <div className="card empty">กำลังโหลดคำขอ...</div>
        ) : requests.length ? (
          requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              operator={false}
              onCancel={async (request) => {
                try {
                  await cancel(request.id);
                  flash("ยกเลิกคำขอแล้ว");
                } catch (error) {
                  flash(
                    error instanceof Error ? error.message : "ยกเลิกไม่สำเร็จ",
                  );
                }
              }}
            />
          ))
        ) : (
          <section className="card">
            <Empty text="ยังไม่มีคำขอเบิก" />
          </section>
        )}
        {toast && <Toast message={toast} />}
      </div>
    );

  return (
    <div className="issue-request-create-layout">
      <section className="card issue-request-form">
        <div className="stock-title">
          <div className="red">
            <PackagePlus />
          </div>
          <div>
            <h2>ขอเบิกสินค้า</h2>
            <p>ส่งคำขอให้เจ้าหน้าที่ตรวจสอบ โดยยังไม่ตัดสต็อก</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            ชื่อผู้รับสินค้า *
            <input
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              placeholder="ชื่อ–นามสกุลผู้รับ"
            />
          </label>
          <label>
            แผนกตามบัญชีผู้ใช้
            <input
              value={department}
              readOnly
              aria-readonly="true"
              placeholder="ยังไม่ได้กำหนดแผนก"
            />
            <small>แก้ไขได้จากหน้าจัดการผู้ใช้งานโดยผู้ดูแลระบบ</small>
          </label>
        </div>
        {!department && (
          <p className="form-error">
            บัญชีนี้ยังไม่ได้กำหนดแผนก กรุณาติดต่อผู้ดูแลระบบก่อนส่งคำขอ
          </p>
        )}
        <div className="issue-lines-heading">
          <div>
            <h3>รายการสินค้า</h3>
            <p>เพิ่มได้หลายรายการในคำขอเดียว</p>
          </div>
          <button
            className="btn compact secondary"
            onClick={() => setLines((current) => [...current, blankLine()])}
          >
            <Plus size={16} />
            เพิ่มรายการ
          </button>
        </div>
        <div className="issue-line-list">
          {lines.map((line, index) => {
            const item = items.find((row) => row.id === line.itemId);
            const available = getLocationQuantity(line.itemId, line.locationId);
            return (
              <div className="issue-line" key={line.key}>
                <span className="issue-line-number">{index + 1}</span>
                <label>
                  สินค้า
                  <select
                    value={line.itemId}
                    onChange={(event) => selectItem(line, event.target.value)}
                  >
                    <option value="">เลือกสินค้า</option>
                    {activeItems.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.sku} — {row.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  จำนวน
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={available || undefined}
                    value={line.quantity || ""}
                    onChange={(event) =>
                      updateLine(line.key, {
                        quantity: Number(event.target.value),
                      })
                    }
                  />
                  <small>
                    คงเหลือ {available} {item?.unit ?? ""}
                  </small>
                </label>
                <label>
                  หมายเหตุ (ไม่บังคับ)
                  <input
                    maxLength={500}
                    value={line.note}
                    onChange={(event) =>
                      updateLine(line.key, { note: event.target.value })
                    }
                    placeholder="เช่น ใช้กับเครื่องจักร A"
                  />
                </label>
                <button
                  className="icon-btn issue-line-remove"
                  aria-label="ลบรายการ"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((current) =>
                      current.filter((row) => row.key !== line.key),
                    )
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>
        {!activeItems.length && (
          <p className="form-error">
            ยังไม่มีสินค้าที่มียอดคงเหลือ กรุณาติดต่อเจ้าหน้าที่พัสดุ
          </p>
        )}
        <SignaturePad onChange={setSignature} resetKey={signatureKey} />
        <button
          className="btn primary submit-btn"
          disabled={!valid || saving}
          onClick={() => setReviewOpen(true)}
        >
          <Eye size={18} />
          ตรวจสอบคำขอ
        </button>
      </section>
      <aside className="stock-preview issue-request-preview">
        <span>สรุปคำขอ</span>
        <strong>{lines.filter((line) => line.itemId).length} รายการ</strong>
        <p>{requestSummary || "เลือกรายการสินค้าที่ต้องการเบิก"}</p>
        <div className="safety-note">
          <Clock3 size={18} />
          สต็อกจะยังไม่เปลี่ยนจนกว่าเจ้าหน้าที่เบิกของจะปิดงาน
        </div>
      </aside>
      {reviewOpen && (
        <IssueRequestReview
          recipientName={recipientName}
          department={department}
          lines={lines}
          items={items}
          getLocationQuantity={getLocationQuantity}
          signaturePreview={signaturePreview}
          saving={saving}
          onBack={() => setReviewOpen(false)}
          onConfirm={() => void submit()}
        />
      )}
      {toast && <Toast message={toast} />}
    </div>
  );
}
