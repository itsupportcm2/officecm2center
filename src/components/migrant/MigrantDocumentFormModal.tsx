import { Clock, Trash2 } from "lucide-react";
import type {
  ForeignWorker,
  MigrantDocumentType,
  MigrantWorkerDocument,
} from "../../services/migrantWorkerService";
import { ThaiDateInput } from "../ThaiDateInput";
import { Modal } from "../ui";

type DocumentDateKey =
  | "issuedOn"
  | "expiresOn"
  | "visaIssuedOn"
  | "visaExpiresOn"
  | "areaPermitIssuedOn"
  | "areaPermitExpiresOn"
  | "workPermitIssuedOn"
  | "workPermitExpiresOn";

interface MigrantDocumentFormModalProps {
  docForm: Omit<MigrantWorkerDocument, "createdAt" | "updatedAt">;
  setDocForm: (next: Omit<MigrantWorkerDocument, "createdAt" | "updatedAt">) => void;
  workers: ForeignWorker[];
  workerMap: Map<string, ForeignWorker>;
  documents: MigrantWorkerDocument[];
  labels: Record<MigrantDocumentType, string>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onRequestDelete: (target: {
    id: string;
    docNumber: string;
    docTypeLabel: string;
    workerName: string;
  }) => void;
  onOpenHistory: (doc: MigrantWorkerDocument) => void;
}

/** Modal form for adding, renewing, or editing a migrant worker document. */
export function MigrantDocumentFormModal({
  docForm,
  setDocForm,
  workers,
  workerMap,
  documents,
  labels,
  saving,
  onClose,
  onSave,
  onRequestDelete,
  onOpenHistory,
}: MigrantDocumentFormModalProps) {
  const renderDateField = (key: DocumentDateKey, label: string) => (
    <label>
      {label}
      <ThaiDateInput
        value={docForm[key] ?? ""}
        onChange={(val) => setDocForm({ ...docForm, [key]: val || null })}
      />
    </label>
  );

  return (
    <Modal
      title={docForm.id ? "ต่ออายุหรือแก้ไขเอกสาร" : "เพิ่มเอกสารใหม่"}
      onClose={onClose}
    >
      <div className="modal-body form-grid">
        <label>
          พนักงาน *
          <select
            value={docForm.workerId}
            onChange={(e) => setDocForm({ ...docForm, workerId: e.target.value })}
          >
            <option value="">เลือกพนักงาน</option>
            {workers
              .filter((w) => w.isActive)
              .map((w) => (
                <option value={w.id} key={w.id}>
                  {w.employeeCode} — {w.fullName} ({w.department})
                </option>
              ))}
          </select>
        </label>
        <label>
          ประเภทเอกสาร *
          <select
            value={docForm.documentType}
            onChange={(e) =>
              setDocForm({
                ...docForm,
                documentType: e.target.value as MigrantDocumentType,
              })
            }
          >
            {Object.entries(labels).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          เลขที่เอกสาร *
          <input
            value={docForm.documentNumber}
            onChange={(e) => setDocForm({ ...docForm, documentNumber: e.target.value })}
            placeholder={
              docForm.documentType.includes("PASSPORT")
                ? "เช่น ME... หรือ CC..."
                : "ระบุเลขที่เอกสาร"
            }
          />
        </label>
        <label>
          แจ้งเตือนล่วงหน้า (วัน)
          <input
            type="number"
            min="0"
            max="365"
            value={docForm.remindDays}
            onChange={(e) => setDocForm({ ...docForm, remindDays: Number(e.target.value) })}
          />
        </label>
        {renderDateField(
          "issuedOn",
          docForm.documentType.includes("PASSPORT")
            ? "วันออกเล่มพาสปอร์ต *"
            : "วันออกบัตร *",
        )}
        {renderDateField(
          "expiresOn",
          docForm.documentType.includes("PASSPORT")
            ? "วันหมดอายุเล่มพาสปอร์ต *"
            : "วันหมดอายุบัตร *",
        )}
        {(docForm.documentType === "PASSPORT_RED" ||
          docForm.documentType === "PASSPORT_GREEN") && (
          <>
            {renderDateField("visaIssuedOn", "วันออกวีซ่า")}
            {renderDateField("visaExpiresOn", "วันหมดอายุวีซ่า *")}
          </>
        )}
        {docForm.documentType === "TEN_YEAR_CARD" && (
          <>
            {renderDateField("areaPermitIssuedOn", "วันออกใบออกนอกพื้นที่ (ไม่บังคับ)")}
            {renderDateField("areaPermitExpiresOn", "วันหมดอายุใบออกนอกพื้นที่ (ไม่บังคับ)")}
          </>
        )}
        <label>
          เลขที่ใบอนุญาตทำงาน
          <input
            value={docForm.workPermitNumber}
            onChange={(e) => setDocForm({ ...docForm, workPermitNumber: e.target.value })}
            placeholder="ระบุเลขที่ใบอนุญาตทำงาน (เว้นว่างได้)"
          />
        </label>
        {renderDateField("workPermitIssuedOn", "วันออกใบอนุญาตทำงาน")}
        {renderDateField("workPermitExpiresOn", "วันหมดอายุใบอนุญาตทำงาน")}
        <label style={{ gridColumn: "1 / -1" }}>
          หมายเหตุ
          <textarea
            value={docForm.note}
            onChange={(e) => setDocForm({ ...docForm, note: e.target.value })}
            rows={2}
          />
        </label>
        <label className="checkbox-row" style={{ gridColumn: "1 / -1" }}>
          <input
            type="checkbox"
            checked={docForm.isActive}
            onChange={(e) => setDocForm({ ...docForm, isActive: e.target.checked })}
          />{" "}
          เปิดใช้งานเอกสารนี้
        </label>
      </div>
      <div className="modal-actions">
        {docForm.id && (
          <div style={{ display: "flex", gap: "8px", marginRight: "auto" }}>
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                const owner = workerMap.get(docForm.workerId);
                onRequestDelete({
                  id: docForm.id,
                  docNumber: docForm.documentNumber || "-",
                  docTypeLabel: labels[docForm.documentType],
                  workerName: owner?.fullName ?? "-",
                });
              }}
            >
              <Trash2 size={15} />
              <span>ลบเอกสาร</span>
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                const existing = documents.find((d) => d.id === docForm.id);
                if (existing) onOpenHistory(existing);
              }}
            >
              <Clock size={15} />
              <span>ดูประวัติการแก้ไข</span>
            </button>
          </div>
        )}
        <button className="btn secondary" onClick={onClose}>
          ยกเลิก
        </button>
        <button
          className="btn primary"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? "กำลังบันทึก..." : "บันทึกเอกสาร"}
        </button>
      </div>
    </Modal>
  );
}
