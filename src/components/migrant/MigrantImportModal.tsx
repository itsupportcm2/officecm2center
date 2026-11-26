import { Download, FileUp } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";
import type { ImportRow } from "../../utils/migrantWorkerIO";
import { isoToThaiDisplay } from "../../utils/thaiDateInput";
import { Modal } from "../ui";

interface MigrantImportModalProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  importRows: ImportRow[];
  importing: boolean;
  importProgress: { done: number; total: number } | null;
  importDone: boolean;
  importSuccessCount: number;
  importErrors: string[];
  onClose: () => void;
  onDownloadTemplate: () => void;
  onImportFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onRunImport: () => void;
}

/** Modal for downloading Excel templates, uploading sheets, previewing validation, and running batch imports. */
export function MigrantImportModal({
  fileInputRef,
  importRows,
  importing,
  importProgress,
  importDone,
  importSuccessCount,
  importErrors,
  onClose,
  onDownloadTemplate,
  onImportFile,
  onRunImport,
}: MigrantImportModalProps) {
  const validCount = importRows.filter((r) => r.errors.length === 0).length;

  return (
    <Modal title="นำเข้าข้อมูลจากไฟล์" onClose={onClose}>
      <div className="modal-body import-modal-body">
        {/* Step 1: download template */}
        <div className="import-step">
          <h3 className="import-step-title">1. ดาวน์โหลด Template</h3>
          <p className="import-hint">
            ดาวน์โหลดไฟล์ตัวอย่างเพื่อกรอกข้อมูล แล้วอัปโหลดกลับมา (รองรับวันที่ทั้งแบบ วว/ดด/พ.ศ. เช่น 15/03/2569 และ ค.ศ. ระบบแปลงปีให้อัตโนมัติ)
          </p>
          <button
            className="btn secondary compact"
            onClick={onDownloadTemplate}
            type="button"
            disabled={importing}
          >
            <Download size={15} /> ดาวน์โหลด Template (.xlsx)
          </button>
        </div>

        {/* Step 2: upload file */}
        <div className="import-step">
          <h3 className="import-step-title">2. อัปโหลดไฟล์ข้อมูล</h3>
          <div className="import-upload-area">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              id="import-file-input"
              style={{ display: "none" }}
              onChange={onImportFile}
            />
            <label
              htmlFor="import-file-input"
              className="import-upload-label"
            >
              <FileUp size={28} />
              <span>คลิกเพื่อเลือกไฟล์ .xlsx, .xls หรือ .csv</span>
            </label>
          </div>
        </div>

        {/* Step 3: preview */}
        {importRows.length > 0 && (
          <div className="import-step">
            <h3 className="import-step-title">
              3. ตรวจสอบข้อมูล ({importRows.length} แถว / {validCount} แถวถูกต้อง)
            </h3>
            <div className="table-wrap import-preview-table">
              <table>
                <thead>
                  <tr>
                    <th>แถว</th>
                    <th>รหัส</th>
                    <th>ชื่อ-สกุล</th>
                    <th>แผนก</th>
                    <th>ประเภทเอกสาร</th>
                    <th>วันหมดอายุ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row) => (
                    <tr
                      key={row.rowIndex}
                      className={row.errors.length ? "import-row-error" : "import-row-ok"}
                    >
                      <td className="mono">{row.rowIndex}</td>
                      <td className="mono">{row.employeeCode}</td>
                      <td>{row.fullName || <em className="text-muted">-</em>}</td>
                      <td>{row.department || <em className="text-muted">-</em>}</td>
                      <td>{row.documentType ?? <em className="text-muted">ไม่มีเอกสาร</em>}</td>
                      <td className="mono">{isoToThaiDisplay(row.expiresOn) || "-"}</td>
                      <td>
                        {row.errors.length ? (
                          <span className="status status-expired" title={row.errors.join(", ")}>
                            ⚠ {row.errors.join(", ")}
                          </span>
                        ) : (
                          <span className="status status-normal">✓ ถูกต้อง</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importing && importProgress && (
          <div className="import-progress-wrap">
            <div className="import-progress-head">
              <span>
                กำลังนำเข้าข้อมูล... {importProgress.done.toLocaleString("th-TH")} /{" "}
                {importProgress.total.toLocaleString("th-TH")} แถว
              </span>
              <span className="tabular-nums">
                {Math.round((importProgress.done / Math.max(1, importProgress.total)) * 100)}%
              </span>
            </div>
            <div className="import-progress-track">
              <div
                className="import-progress-fill"
                style={{
                  width: `${Math.round((importProgress.done / Math.max(1, importProgress.total)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {importDone && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {importSuccessCount > 0 && (
              <p className="import-success">
                ✅ นำเข้าข้อมูลสำเร็จ {importSuccessCount} รายการ
              </p>
            )}
            {importErrors.length > 0 && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  color: "#991b1b",
                  fontSize: "0.85rem",
                  maxHeight: "150px",
                  overflowY: "auto",
                }}
              >
                <b>⚠️ พบข้อผิดพลาด {importErrors.length} รายการ:</b>
                <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                  {importErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="modal-actions">
        <button
          className="btn secondary"
          onClick={onClose}
          type="button"
        >
          ปิด
        </button>
        <button
          className="btn primary"
          type="button"
          disabled={importing || importDone || validCount === 0}
          onClick={onRunImport}
        >
          {importing ? "กำลังนำเข้า..." : `นำเข้า ${validCount} แถว`}
        </button>
      </div>
    </Modal>
  );
}
