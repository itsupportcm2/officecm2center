import { memo } from "react";
import {
  getWorkerAge,
  getWorkerGender,
  type ForeignWorker,
  type MigrantDocumentType,
  type MigrantWorkerDocument,
} from "../../services/migrantWorkerService";

export interface PrintExpiryRow {
  doc: MigrantWorkerDocument;
  field: string;
  date: string;
  days: number;
}

interface MigrantPrintSheetProps {
  viewMode: "workers" | "expiry" | "documents";
  deptFilter: string;
  genderFilter: "all" | "MALE" | "FEMALE";
  docTypeFilter: string;
  expirySubFilter: "all" | "expired" | "due" | "caution" | "safe";
  searchQuery: string;
  filteredWorkers: ForeignWorker[];
  filteredExpiryRows: PrintExpiryRow[];
  filteredAllDocs: MigrantWorkerDocument[];
  documents: MigrantWorkerDocument[];
  workerMap: Map<string, ForeignWorker>;
  labels: Record<MigrantDocumentType, string>;
  thaiDate: (date: string) => string;
  formatDays: (absDays: number) => string;
}

/** Print-only A4 Landscape report sheet matching current filters and view tab. */
export const MigrantPrintSheet = memo(function MigrantPrintSheet({
  viewMode,
  deptFilter,
  genderFilter,
  docTypeFilter,
  expirySubFilter,
  searchQuery,
  filteredWorkers,
  filteredExpiryRows,
  filteredAllDocs,
  documents,
  workerMap,
  labels,
  thaiDate,
  formatDays,
}: MigrantPrintSheetProps) {
  return (
    <div className="mwp-print-sheet" aria-hidden="true">
      {/* Header */}
      <header className="mwp-print-header">
        <div className="mwp-print-brand-row">
          <div className="mwp-print-brand-left">
            <img
              src="/cm_frozen_logo.png"
              alt="Logo บริษัท เชียงใหม่โฟรเซ่นฟูดส์ จำกัด (มหาชน)"
              className="mwp-print-logo"
            />
            <div>
              <h1 className="mwp-print-company">บริษัท เชียงใหม่โฟรเซ่นฟูดส์ จำกัด (มหาชน)</h1>
              <div className="mwp-print-company-en">CHIANGMAI FROZEN FOODS PUBLIC COMPANY LIMITED</div>
              <div className="mwp-print-dept">
                ฝ่ายบริหารทรัพยากรบุคคลและเอกสารแรงงานต่างด้าว (HR &amp; Migrant Worker Management)
              </div>
            </div>
          </div>
          <div className="mwp-print-date">
            <div>
              วันที่พิมพ์รายงาน:{" "}
              {new Date().toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            <div>
              เวลา:{" "}
              {new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
            </div>
          </div>
        </div>
        <h2 className="mwp-print-title">
          {viewMode === "expiry" &&
            "📋 รายงานติดตามวันหมดอายุเอกสารแรงงานต่างด้าว (Expiration & Renewal Watchlist)"}
          {viewMode === "workers" &&
            "📋 รายงานประวัติพนักงานและสถานะเอกสารแรงงานต่างด้าว (Foreign Worker Directory)"}
          {viewMode === "documents" &&
            "📋 ทะเบียนเอกสารแรงงานต่างด้าวทั้งหมด (Migrant Worker Document Registry)"}
        </h2>
      </header>

      {/* Filter Criteria & Count Summary Bar */}
      <div className="mwp-print-meta-grid">
        <div className="mwp-print-criteria-list">
          <div className="mwp-print-criterion">
            <span className="mwp-print-criterion-label">แผนก:</span>
            <span className="mwp-print-criterion-val">
              {deptFilter === "all" ? "ทุกแผนก" : `แผนก ${deptFilter}`}
            </span>
          </div>
          <div className="mwp-print-criterion">
            <span className="mwp-print-criterion-label">เพศ:</span>
            <span className="mwp-print-criterion-val">
              {genderFilter === "all" ? "ทุกเพศ" : genderFilter === "MALE" ? "ชาย" : "หญิง"}
            </span>
          </div>
          <div className="mwp-print-criterion">
            <span className="mwp-print-criterion-label">ประเภทเอกสาร:</span>
            <span className="mwp-print-criterion-val">
              {docTypeFilter === "all"
                ? "ทุกประเภท"
                : labels[docTypeFilter as MigrantDocumentType] || docTypeFilter}
            </span>
          </div>
          {viewMode === "expiry" && (
            <div className="mwp-print-criterion">
              <span className="mwp-print-criterion-label">สถานะวันครบกำหนด:</span>
              <span className="mwp-print-criterion-val">
                {expirySubFilter === "all" && "ทั้งหมด"}
                {expirySubFilter === "expired" && "หมดอายุแล้ว"}
                {expirySubFilter === "due" && "ใกล้ครบกำหนด (ตามวันแจ้งเตือน)"}
                {expirySubFilter === "caution" && "เฝ้าระวังล่วงหน้า (≤ 90 วัน)"}
                {expirySubFilter === "safe" && "ปกติ (> 90 วัน)"}
              </span>
            </div>
          )}
          {searchQuery.trim() && (
            <div className="mwp-print-criterion">
              <span className="mwp-print-criterion-label">คำค้นหา:</span>
              <span className="mwp-print-criterion-val">"{searchQuery.trim()}"</span>
            </div>
          )}
        </div>
        <div className="mwp-print-counts">
          {viewMode === "workers" && (
            <>
              รวม {filteredWorkers.length} คน (ชาย{" "}
              {filteredWorkers.filter((w) => getWorkerGender(w) === "MALE").length} คน / หญิง{" "}
              {filteredWorkers.filter((w) => getWorkerGender(w) === "FEMALE").length} คน)
            </>
          )}
          {viewMode === "expiry" && (
            <>
              รวม {filteredExpiryRows.length} รายการ (
              {`พนักงาน ${new Set(filteredExpiryRows.map((r) => r.doc.workerId)).size} คน`})
            </>
          )}
          {viewMode === "documents" && <>รวม {filteredAllDocs.length} ฉบับ</>}
        </div>
      </div>

      {/* View 1: EXPIRY REPORT TABLE */}
      {viewMode === "expiry" && (
        <table className="mwp-print-table">
          <thead>
            <tr>
              <th style={{ width: "35px", textAlign: "center" }}>ลำดับ</th>
              <th style={{ width: "75px" }}>รหัสพนักงาน</th>
              <th>ชื่อ-นามสกุล</th>
              <th style={{ width: "50px", textAlign: "center" }}>อายุ</th>
              <th style={{ width: "45px", textAlign: "center" }}>เพศ</th>
              <th style={{ width: "55px" }}>สัญชาติ</th>
              <th style={{ width: "65px" }}>แผนก</th>
              <th>รายการที่ต้องติดตาม</th>
              <th>เลขที่เอกสาร</th>
              <th style={{ width: "90px", textAlign: "center" }}>วันครบกำหนด</th>
              <th style={{ width: "105px", textAlign: "center" }}>ระยะเวลา</th>
              <th style={{ width: "70px", textAlign: "center" }}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpiryRows.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", padding: "16px" }}>
                  ไม่พบรายการเอกสารที่ตรงตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              filteredExpiryRows.map((row, idx) => {
                const worker = workerMap.get(row.doc.workerId);
                const gender = worker ? getWorkerGender(worker) : "UNKNOWN";
                const workerAge = worker ? getWorkerAge(worker.birthDate) : null;
                const remind = row.doc.remindDays ?? 30;
                return (
                  <tr
                    key={`print-exp-${row.doc.id}-${row.field}-${idx}`}
                    className={
                      row.days < 0 ? "print-row-expired" : row.days <= remind ? "print-row-due" : ""
                    }
                  >
                    <td style={{ textAlign: "center" }}>{idx + 1}</td>
                    <td>
                      <b>{worker?.employeeCode || "-"}</b>
                    </td>
                    <td>{worker?.fullName || "-"}</td>
                    <td style={{ textAlign: "center" }}>
                      {workerAge !== null ? `${workerAge} ปี` : "-"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {gender === "MALE" ? "ชาย" : gender === "FEMALE" ? "หญิง" : "-"}
                    </td>
                    <td>{worker?.nationality || "-"}</td>
                    <td>{worker?.department || "-"}</td>
                    <td>
                      <b>{row.field}</b>
                    </td>
                    <td>{row.doc.documentNumber || "-"}</td>
                    <td style={{ textAlign: "center" }}>{thaiDate(row.date)}</td>
                    <td style={{ textAlign: "center" }}>
                      {row.days < 0
                        ? `เกิน ${formatDays(Math.abs(row.days))}`
                        : row.days === 0
                          ? "ครบกำหนดวันนี้"
                          : `อีก ${formatDays(row.days)}`}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.days < 0 ? (
                        <span className="print-badge-danger">หมดอายุ</span>
                      ) : row.days <= remind ? (
                        <span className="print-badge-warning">ใกล้ครบ</span>
                      ) : (
                        <span className="print-badge-normal">ปกติ</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}

      {/* View 2: WORKER DIRECTORY REPORT TABLE */}
      {viewMode === "workers" && (
        <table className="mwp-print-table">
          <thead>
            <tr>
              <th style={{ width: "35px", textAlign: "center" }}>ลำดับ</th>
              <th style={{ width: "65px", textAlign: "center" }}>แผนก</th>
              <th style={{ width: "75px", textAlign: "center" }}>รหัสพนักงาน</th>
              <th style={{ width: "55px", textAlign: "center" }}>คำนำหน้า</th>
              <th>ชื่อ-นามสกุล</th>
              <th style={{ width: "50px", textAlign: "center" }}>อายุ</th>
              <th style={{ width: "60px", textAlign: "center" }}>สัญชาติ</th>
              <th style={{ width: "115px", textAlign: "center" }}>เลขประจำตัวประชาชน</th>
              <th style={{ width: "100px", textAlign: "center" }}>เลขที่เอกสาร</th>
              <th style={{ width: "85px", textAlign: "center" }}>วันหมดอายุเล่ม</th>
              <th style={{ width: "85px", textAlign: "center" }}>วันหมดอายุวีซ่า</th>
              <th style={{ width: "85px", textAlign: "center" }}>วันหมดอายุใบงาน</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkers.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", padding: "16px" }}>
                  ไม่พบรายชื่อพนักงานที่ตรงตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              filteredWorkers.map((w, idx) => {
                const docs = documents.filter((d) => d.workerId === w.id && d.isActive);
                const primaryDoc = docs[0];
                const age = getWorkerAge(w.birthDate);
                return (
                  <tr key={`print-w-${w.id}`}>
                    <td style={{ textAlign: "center" }}>{idx + 1}</td>
                    <td style={{ textAlign: "center" }}>
                      <b>{w.department || "-"}</b>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <b>{w.employeeCode}</b>
                    </td>
                    <td style={{ textAlign: "center" }}>{w.title || "-"}</td>
                    <td>
                      {w.fullName}
                      {w.phone ? (
                        <span style={{ display: "block", fontSize: "0.72rem", color: "#64748b" }}>
                          โทร: {w.phone}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ textAlign: "center" }}>{age !== null ? `${age} ปี` : "-"}</td>
                    <td style={{ textAlign: "center" }}>{w.nationality || "-"}</td>
                    <td style={{ textAlign: "center" }} className="mono">
                      {w.nationalId || "-"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {primaryDoc ? (
                        <>
                          <span>{primaryDoc.documentNumber || "-"}</span>
                          {primaryDoc.documentType && (
                            <span style={{ display: "block", fontSize: "0.70rem", color: "#64748b" }}>
                              ({labels[primaryDoc.documentType] || primaryDoc.documentType})
                            </span>
                          )}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {primaryDoc?.expiresOn ? thaiDate(primaryDoc.expiresOn) : "-"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {primaryDoc?.visaExpiresOn ? thaiDate(primaryDoc.visaExpiresOn) : "-"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {primaryDoc?.workPermitExpiresOn
                        ? thaiDate(primaryDoc.workPermitExpiresOn)
                        : "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}

      {/* View 3: ALL DOCUMENTS REGISTRY TABLE */}
      {viewMode === "documents" && (
        <table className="mwp-print-table">
          <thead>
            <tr>
              <th style={{ width: "35px", textAlign: "center" }}>ลำดับ</th>
              <th style={{ width: "75px" }}>รหัส</th>
              <th>พนักงาน</th>
              <th style={{ width: "50px", textAlign: "center" }}>อายุ</th>
              <th style={{ width: "45px", textAlign: "center" }}>เพศ</th>
              <th style={{ width: "65px" }}>แผนก</th>
              <th>ประเภทเอกสาร</th>
              <th>เลขที่เอกสาร</th>
              <th style={{ width: "85px", textAlign: "center" }}>หมดอายุเล่ม/บัตร</th>
              <th style={{ width: "85px", textAlign: "center" }}>หมดอายุวีซ่า</th>
              <th>เลขที่ใบอนุญาตทำงาน</th>
              <th style={{ width: "85px", textAlign: "center" }}>หมดอายุใบงาน</th>
            </tr>
          </thead>
          <tbody>
            {filteredAllDocs.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", padding: "16px" }}>
                  ไม่พบเอกสารที่ตรงตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              filteredAllDocs.map((doc, idx) => {
                const worker = workerMap.get(doc.workerId);
                const gender = worker ? getWorkerGender(worker) : "UNKNOWN";
                const workerAge = worker ? getWorkerAge(worker.birthDate) : null;
                return (
                  <tr key={`print-doc-${doc.id}`}>
                    <td style={{ textAlign: "center" }}>{idx + 1}</td>
                    <td>
                      <b>{worker?.employeeCode || "-"}</b>
                    </td>
                    <td>{worker?.fullName || "-"}</td>
                    <td style={{ textAlign: "center" }}>
                      {workerAge !== null ? `${workerAge} ปี` : "-"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {gender === "MALE" ? "ชาย" : gender === "FEMALE" ? "หญิง" : "-"}
                    </td>
                    <td>{worker?.department || "-"}</td>
                    <td>{labels[doc.documentType] || doc.documentType}</td>
                    <td>{doc.documentNumber}</td>
                    <td style={{ textAlign: "center" }}>
                      {doc.expiresOn ? thaiDate(doc.expiresOn) : "-"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {doc.visaExpiresOn ? thaiDate(doc.visaExpiresOn) : "-"}
                    </td>
                    <td>{doc.workPermitNumber || "-"}</td>
                    <td style={{ textAlign: "center" }}>
                      {doc.workPermitExpiresOn ? thaiDate(doc.workPermitExpiresOn) : "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}

      {/* Signatures Block */}
      <div className="mwp-print-signatures">
        <div className="mwp-print-sign-box">
          <div className="mwp-print-sign-line">
            ลงชื่อ ................................................................
          </div>
          <div className="mwp-print-sign-name">
            ( ................................................................ )
          </div>
          <div className="mwp-print-sign-role">ผู้จัดทำรายงาน</div>
          <div className="mwp-print-sign-date">วันที่ ........ / ........ / ................</div>
        </div>
        <div className="mwp-print-sign-box">
          <div className="mwp-print-sign-line">
            ลงชื่อ ................................................................
          </div>
          <div className="mwp-print-sign-name">
            ( ................................................................ )
          </div>
          <div className="mwp-print-sign-role">ผู้ตรวจสอบเอกสาร</div>
          <div className="mwp-print-sign-date">วันที่ ........ / ........ / ................</div>
        </div>
      </div>
    </div>
  );
});
