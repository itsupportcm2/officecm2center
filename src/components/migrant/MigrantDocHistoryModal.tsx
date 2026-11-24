import { Clock, FileText } from "lucide-react";
import { Modal } from "../ui";
import type {
  MigrantDocumentHistory,
  MigrantWorkerDocument,
} from "../../services/migrantWorkerService";

interface MigrantDocHistoryModalProps {
  doc: MigrantWorkerDocument;
  workerName: string;
  employeeCode: string;
  docLabel: string;
  history: MigrantDocumentHistory[];
  onClose: () => void;
}

const ACTION_META: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  CREATE: {
    label: "สร้างเอกสารใหม่",
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.14)",
    border: "rgba(37, 99, 235, 0.35)",
  },
  RENEW: {
    label: "ต่ออายุเอกสาร",
    color: "#16a34a",
    bg: "rgba(22, 163, 74, 0.14)",
    border: "rgba(22, 163, 74, 0.35)",
  },
  UPDATE: {
    label: "แก้ไขข้อมูล",
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.14)",
    border: "rgba(217, 119, 6, 0.35)",
  },
  DEACTIVATE: {
    label: "ปิดใช้งาน",
    color: "#dc2626",
    bg: "rgba(220, 38, 38, 0.14)",
    border: "rgba(220, 38, 38, 0.35)",
  },
};

const TRACKED_FIELDS: Array<{ key: string; label: string; isDate?: boolean }> = [
  { key: "document_number", label: "เลขที่เอกสาร" },
  { key: "expires_on", label: "วันหมดอายุเล่ม/บัตร", isDate: true },
  { key: "visa_expires_on", label: "วันหมดอายุวีซ่า", isDate: true },
  { key: "area_permit_expires_on", label: "วันหมดอายุใบออกนอกพื้นที่", isDate: true },
  { key: "work_permit_number", label: "เลขที่ใบอนุญาตทำงาน" },
  { key: "work_permit_expires_on", label: "วันหมดอายุใบอนุญาตทำงาน", isDate: true },
];

function formatHistoryValue(val: unknown, isDate?: boolean): string {
  if (val == null || String(val).trim() === "") return "-";
  const raw = String(val).trim();
  if (isDate) {
    const parsed = new Date(`${raw.slice(0, 10)}T00:00:00`);
    if (!isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(parsed);
    }
  }
  return raw;
}

function formatHistoryTimestamp(iso: string): string {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dt);
}

/** Timeline modal displaying audit/renewal history for a single migrant worker document. */
export function MigrantDocHistoryModal({
  doc,
  workerName,
  employeeCode,
  docLabel,
  history,
  onClose,
}: MigrantDocHistoryModalProps) {
  const entries = history
    .filter((h) => h.documentId === doc.id)
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

  return (
    <Modal
      title={`ประวัติการต่ออายุ/แก้ไขเอกสาร — ${doc.documentNumber || docLabel}`}
      onClose={onClose}
    >
      <div className="modal-body form-stack">
        {/* Summary Header Banner */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "12px 14px",
            borderRadius: "10px",
            background: "var(--bg-subtle, #f1f5f9)",
            border: "1px solid var(--border-line, #e2e8f0)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FileText size={18} color="#2563eb" />
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                {workerName} <span style={{ color: "var(--text-muted, #64748b)" }}>({employeeCode})</span>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary, #334155)" }}>
                {docLabel} • เลขที่: <span className="mono">{doc.documentNumber || "-"}</span>
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "999px",
              background: "var(--bg-card, #ffffff)",
              border: "1px solid var(--border-line, #e2e8f0)",
              color: "var(--text-primary, #0f172a)",
            }}
          >
            ทั้งหมด {entries.length} รายการ
          </span>
        </div>

        {/* Timeline List */}
        {entries.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 16px",
              color: "var(--text-muted, #64748b)",
              border: "1px dashed var(--border-line, #e2e8f0)",
              borderRadius: "10px",
            }}
          >
            ยังไม่มีประวัติการแก้ไขสำหรับเอกสารฉบับนี้
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "55vh", overflowY: "auto" }}>
            {entries.map((entry) => {
              const meta = ACTION_META[entry.action] ?? {
                label: entry.action,
                color: "var(--text-secondary, #334155)",
                bg: "var(--bg-subtle, #f1f5f9)",
                border: "var(--border-line, #e2e8f0)",
              };

              const diffs: Array<{ label: string; prev: string | null; next: string }> =
                TRACKED_FIELDS.flatMap((field) => {
                  const nextRaw = entry.newData?.[field.key];
                  const prevRaw = entry.previousData?.[field.key];
                  const nextVal = formatHistoryValue(nextRaw, field.isDate);
                  const prevVal = formatHistoryValue(prevRaw, field.isDate);

                  if (entry.action === "CREATE") {
                    if (nextVal === "-") return [];
                    return [{ label: field.label, prev: null as string | null, next: nextVal }];
                  }
                  if (entry.previousData && nextVal !== prevVal) {
                    return [{ label: field.label, prev: prevVal as string | null, next: nextVal }];
                  }
                  return [];
                });

              return (
                <div
                  key={entry.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "var(--bg-surface, #ffffff)",
                    border: "1px solid var(--border-line, #e2e8f0)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: "999px",
                        color: meta.color,
                        background: meta.bg,
                        border: `1px solid ${meta.border}`,
                      }}
                    >
                      <Clock size={12} />
                      {meta.label}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted, #64748b)" }}>
                      {formatHistoryTimestamp(entry.changedAt)} • โดย {entry.changedByName}
                    </span>
                  </div>

                  {diffs.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        fontSize: "0.82rem",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: "var(--bg-subtle, #f1f5f9)",
                      }}
                    >
                      {diffs.map((d) => (
                        <div key={d.label} style={{ color: "var(--text-secondary, #334155)" }}>
                          <b>{d.label}:</b>{" "}
                          {d.prev !== null ? (
                            <>
                              <span style={{ color: "var(--text-muted, #64748b)" }}>
                                เดิม {d.prev}
                              </span>{" "}
                              <span style={{ color: "var(--text-primary, #0f172a)", fontWeight: 600 }}>
                                → ใหม่ {d.next}
                              </span>
                            </>
                          ) : (
                            <span style={{ color: "var(--text-primary, #0f172a)", fontWeight: 600 }}>
                              {d.next}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {entry.note && (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
                      หมายเหตุ: {entry.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn secondary" onClick={onClose}>
          ปิดหน้าต่าง
        </button>
      </div>
    </Modal>
  );
}
