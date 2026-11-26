import { FileText, Trash2, Users } from "lucide-react";
import { DEPARTMENTS } from "../../constants/departments";
import type { InitialDocItem } from "../../pages/MigrantWorkerDocumentsPage";
import {
  formatNationalId,
  type ForeignWorker,
  type MigrantDocumentType,
} from "../../services/migrantWorkerService";
import { ThaiDateInput } from "../ThaiDateInput";
import { Modal } from "../ui";

interface MigrantWorkerFormModalProps {
  workerForm: Omit<ForeignWorker, "createdAt" | "updatedAt">;
  setWorkerForm: (next: Omit<ForeignWorker, "createdAt" | "updatedAt">) => void;
  includeDocs: boolean;
  setIncludeDocs: (next: boolean) => void;
  workerDocs: InitialDocItem[];
  updateDocRow: (id: string, updates: Partial<InitialDocItem>) => void;
  labels: Record<MigrantDocumentType, string>;
  titles: string[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onRequestDelete: (target: { id: string; name: string; code: string }) => void;
}

/** Modal form for creating or editing a migrant worker and optional initial identity document. */
export function MigrantWorkerFormModal({
  workerForm,
  setWorkerForm,
  includeDocs,
  setIncludeDocs,
  workerDocs,
  updateDocRow,
  labels,
  titles,
  saving,
  onClose,
  onSave,
  onRequestDelete,
}: MigrantWorkerFormModalProps) {
  return (
    <Modal
      title={workerForm.id ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่และเอกสาร"}
      onClose={onClose}
    >
      <div className="modal-body form-stack">
        <div>
          <h3 className="section-title">
            <Users size={16} /> ข้อมูลพนักงาน
          </h3>
          <div className="form-grid" style={{ marginTop: "12px" }}>
            <label>
              รหัสบุคลากร *
              <input
                value={workerForm.employeeCode}
                onChange={(e) =>
                  setWorkerForm({
                    ...workerForm,
                    employeeCode: e.target.value,
                  })
                }
                placeholder="เช่น CM-1234 หรือ EMP-001"
              />
            </label>
            <label>
              คำนำหน้า (ระบุเพศ)
              <select
                value={workerForm.title}
                onChange={(e) =>
                  setWorkerForm({ ...workerForm, title: e.target.value })
                }
              >
                <option value="">เลือกคำนำหน้า</option>
                {titles.map((t) => (
                  <option key={t} value={t}>
                    {t} {t === "นาย" || t === "MR." ? "(ชาย)" : "(หญิง)"}
                  </option>
                ))}
                {workerForm.title && !titles.includes(workerForm.title) && (
                  <option value={workerForm.title}>{workerForm.title}</option>
                )}
              </select>
            </label>
            <label>
              ชื่อ-สกุล *
              <input
                value={workerForm.fullName}
                onChange={(e) =>
                  setWorkerForm({ ...workerForm, fullName: e.target.value })
                }
                placeholder="ระบุชื่อและนามสกุล"
              />
            </label>
            <label>
              แผนกในระบบ *
              <select
                value={workerForm.department}
                onChange={(e) =>
                  setWorkerForm({
                    ...workerForm,
                    department: e.target.value,
                  })
                }
              >
                <option value="">เลือกแผนก</option>
                {DEPARTMENTS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label>
              สัญชาติ
              <input
                value={workerForm.nationality}
                onChange={(e) =>
                  setWorkerForm({
                    ...workerForm,
                    nationality: e.target.value,
                  })
                }
                placeholder="เช่น เมียนมา, กัมพูชา, ลาว"
              />
            </label>
            <label>
              วันเกิด
              <ThaiDateInput
                value={workerForm.birthDate ?? ""}
                onChange={(val) =>
                  setWorkerForm({
                    ...workerForm,
                    birthDate: val || null,
                  })
                }
              />
            </label>
            <label>
              เลขประจำตัว / บัตรประชาชน (13 หลัก) *
              <input
                type="text"
                inputMode="numeric"
                maxLength={17}
                required
                value={workerForm.nationalId}
                onChange={(e) =>
                  setWorkerForm({
                    ...workerForm,
                    nationalId: formatNationalId(e.target.value),
                  })
                }
                placeholder="0-0506-51005-43-4"
                style={{
                  fontFamily: "monospace",
                  borderColor:
                    workerForm.nationalId &&
                    workerForm.nationalId.replace(/\D/g, "").length < 13
                      ? "#dc2626"
                      : workerForm.nationalId.replace(/\D/g, "").length === 13
                        ? "#16a34a"
                        : undefined,
                }}
              />
              {workerForm.nationalId ? (
                <span
                  style={{
                    fontSize: "0.75rem",
                    marginTop: "2px",
                    display: "block",
                    color:
                      workerForm.nationalId.replace(/\D/g, "").length === 13
                        ? "#16a34a"
                        : "#dc2626",
                    fontWeight: 600,
                  }}
                >
                  {workerForm.nationalId.replace(/\D/g, "").length === 13
                    ? "✓ ครบ 13 หลักถูกต้องตามรูปแบบ"
                    : `⚠️ ยังไม่ครบ 13 หลัก (กรอกแล้ว ${workerForm.nationalId.replace(/\D/g, "").length}/13 หลัก)`}
                </span>
              ) : (
                <span style={{ fontSize: "0.75rem", marginTop: "2px", display: "block", color: "#64748b" }}>
                  * จำเป็นต้องระบุเลขประจำตัว 13 หลัก (เช่น 0-0506-51005-43-4)
                </span>
              )}
            </label>
            <label>
              เบอร์โทรศัพท์ (ถ้ามี)
              <input
                type="tel"
                value={workerForm.phone ?? ""}
                onChange={(e) =>
                  setWorkerForm({
                    ...workerForm,
                    phone: e.target.value,
                  })
                }
                placeholder="เช่น 081-234-5678 (เว้นว่างได้)"
              />
            </label>
          </div>
        </div>

        {!workerForm.id && (
          <div className="doc-section-wrapper" style={{ marginTop: "16px" }}>
            <div className="section-title-bar">
              <h3 className="section-title">
                <FileText size={16} /> บันทึกเอกสารเริ่มต้นพร้อมกัน
              </h3>
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={includeDocs}
                  onChange={(e) => setIncludeDocs(e.target.checked)}
                />{" "}
                เพิ่มเอกสารพร้อมกัน
              </label>
            </div>

            {includeDocs && (
              <div className="doc-list-container">
                {workerDocs.map((doc) => {
                  const isPassport =
                    doc.documentType === "PASSPORT_RED" ||
                    doc.documentType === "PASSPORT_GREEN";
                  const isArea = doc.documentType === "TEN_YEAR_CARD";
                  return (
                    <div key={doc.id} className="combined-doc-card">
                      <div className="combined-doc-header">
                        <span className="combined-doc-badge">
                          <FileText size={15} /> เอกสารประจำตัวหลัก:{" "}
                          {labels[doc.documentType]}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)" }}>
                          (1 ฉบับหลักต่อพนักงาน 1 คน)
                        </span>
                      </div>
                      <div className="form-grid">
                        <label>
                          ประเภทเอกสาร *
                          <select
                            value={doc.documentType}
                            onChange={(e) =>
                              updateDocRow(doc.id, {
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
                            value={doc.documentNumber}
                            onChange={(e) =>
                              updateDocRow(doc.id, {
                                documentNumber: e.target.value,
                              })
                            }
                            placeholder={
                              isPassport
                                ? "เช่น ME... หรือ CC..."
                                : "ระบุเลขที่เอกสาร"
                            }
                          />
                        </label>
                        <label>
                          {isPassport ? "วันออกเล่มพาสปอร์ต *" : "วันออกบัตร *"}
                          <ThaiDateInput
                            value={doc.issuedOn ?? ""}
                            onChange={(val) =>
                              updateDocRow(doc.id, {
                                issuedOn: val || null,
                              })
                            }
                          />
                        </label>
                        <label>
                          {isPassport ? "วันหมดอายุเล่มพาสปอร์ต *" : "วันหมดอายุบัตร *"}
                          <ThaiDateInput
                            value={doc.expiresOn ?? ""}
                            onChange={(val) =>
                              updateDocRow(doc.id, {
                                expiresOn: val || null,
                              })
                            }
                          />
                        </label>
                        {isPassport && (
                          <>
                            <label>
                              วันออกวีซ่า
                              <ThaiDateInput
                                value={doc.visaIssuedOn ?? ""}
                                onChange={(val) =>
                                  updateDocRow(doc.id, {
                                    visaIssuedOn: val || null,
                                  })
                                }
                              />
                            </label>
                            <label>
                              วันหมดอายุวีซ่า *
                              <ThaiDateInput
                                value={doc.visaExpiresOn ?? ""}
                                onChange={(val) =>
                                  updateDocRow(doc.id, {
                                    visaExpiresOn: val || null,
                                  })
                                }
                              />
                            </label>
                          </>
                        )}
                        {isArea && (
                          <>
                            <label>
                              วันออกใบออกนอกพื้นที่ (ไม่บังคับ)
                              <ThaiDateInput
                                value={doc.areaPermitIssuedOn ?? ""}
                                onChange={(val) =>
                                  updateDocRow(doc.id, {
                                    areaPermitIssuedOn: val || null,
                                  })
                                }
                              />
                            </label>
                            <label>
                              วันหมดอายุใบออกนอกพื้นที่ (ไม่บังคับ)
                              <ThaiDateInput
                                value={doc.areaPermitExpiresOn ?? ""}
                                onChange={(val) =>
                                  updateDocRow(doc.id, {
                                    areaPermitExpiresOn: val || null,
                                  })
                                }
                              />
                            </label>
                          </>
                        )}
                        <label>
                          เลขที่ใบอนุญาตทำงาน
                          <input
                            value={doc.workPermitNumber}
                            onChange={(e) =>
                              updateDocRow(doc.id, {
                                workPermitNumber: e.target.value,
                              })
                            }
                            placeholder="ระบุเลขที่ใบอนุญาตทำงาน (เว้นว่างได้)"
                          />
                        </label>
                        <label>
                          วันออกใบอนุญาตทำงาน
                          <ThaiDateInput
                            value={doc.workPermitIssuedOn ?? ""}
                            onChange={(val) =>
                              updateDocRow(doc.id, {
                                workPermitIssuedOn: val || null,
                              })
                            }
                          />
                        </label>
                        <label>
                          วันหมดอายุใบอนุญาตทำงาน
                          <ThaiDateInput
                            value={doc.workPermitExpiresOn ?? ""}
                            onChange={(val) =>
                              updateDocRow(doc.id, {
                                workPermitExpiresOn: val || null,
                              })
                            }
                          />
                        </label>
                        <label>
                          แจ้งเตือนล่วงหน้า (วัน)
                          <input
                            type="number"
                            min="0"
                            max="365"
                            value={doc.remindDays}
                            onChange={(e) =>
                              updateDocRow(doc.id, {
                                remindDays: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="modal-actions">
        {workerForm.id && (
          <button
            type="button"
            className="btn danger"
            style={{ marginRight: "auto" }}
            onClick={() => {
              onRequestDelete({
                id: workerForm.id,
                name: [workerForm.title, workerForm.fullName].filter(Boolean).join(" "),
                code: workerForm.employeeCode,
              });
            }}
          >
            <Trash2 size={15} />
            <span>ลบข้อมูลพนักงาน</span>
          </button>
        )}
        <button className="btn secondary" onClick={onClose}>
          ยกเลิก
        </button>
        <button
          className="btn primary"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>
      </div>
    </Modal>
  );
}
