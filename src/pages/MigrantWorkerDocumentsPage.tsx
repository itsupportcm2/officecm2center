import {
  AlertTriangle,
  Download,
  Edit3,
  FileDown,
  FilePlus2,
  FileText,
  FileUp,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Toast } from "../components/ui";
import { DEPARTMENTS } from "../constants/departments";
import {
  migrantWorkerService,
  type ForeignWorker,
  type MigrantDocumentType,
  type MigrantWorkerDocument,
} from "../services/migrantWorkerService";
import {
  downloadTemplate,
  exportToCSV,
  exportToExcel,
  parseImportFile,
  type ImportRow,
} from "../utils/migrantWorkerIO";

const labels: Record<MigrantDocumentType, string> = {
  PASSPORT_RED: "พาสปอร์ตสีแดง",
  PASSPORT_GREEN: "พาสปอร์ตสีเขียว",
  PINK_CARD: "บัตรชมพู",
  TEN_YEAR_CARD: "บัตร 10 ปี",
};
const TITLES = ["นาย", "นาง", "นางสาว", "MR.", "MRS.", "MS."];
export interface InitialDocItem {
  id: string;
  documentType: MigrantDocumentType;
  documentNumber: string;
  issuedOn: string | null;
  expiresOn: string | null;
  visaIssuedOn: string | null;
  visaExpiresOn: string | null;
  areaPermitIssuedOn: string | null;
  areaPermitExpiresOn: string | null;
  workPermitNumber: string;
  workPermitIssuedOn: string | null;
  workPermitExpiresOn: string | null;
  remindDays: number;
  note: string;
}
const blankNewDoc = (
  type: MigrantDocumentType = "PASSPORT_RED",
): InitialDocItem => ({
  id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  documentType: type,
  documentNumber: "",
  issuedOn: null,
  expiresOn: null,
  visaIssuedOn: null,
  visaExpiresOn: null,
  areaPermitIssuedOn: null,
  areaPermitExpiresOn: null,
  workPermitNumber: "",
  workPermitIssuedOn: null,
  workPermitExpiresOn: null,
  remindDays: 30,
  note: "",
});
const blankWorker = (): Omit<ForeignWorker, "createdAt" | "updatedAt"> => ({
  id: "",
  employeeCode: "",
  fullName: "",
  nationality: "",
  department: "",
  organizationUnit: "",
  title: "",
  nationalId: "",
  birthDate: null,
  position: "",
  note: "",
  isActive: true,
});
const blankDoc = (
  workerId = "",
): Omit<MigrantWorkerDocument, "createdAt" | "updatedAt"> => ({
  id: "",
  workerId,
  documentType: "PASSPORT_RED",
  documentNumber: "",
  issuedOn: null,
  expiresOn: null,
  visaIssuedOn: null,
  visaExpiresOn: null,
  areaPermitIssuedOn: null,
  areaPermitExpiresOn: null,
  workPermitNumber: "",
  workPermitIssuedOn: null,
  workPermitExpiresOn: null,
  remindDays: 30,
  note: "",
  isActive: true,
});
const daysUntil = (date: string) =>
  Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() -
      new Date(new Date().toDateString()).getTime()) /
      86400000,
  );
const thaiDate = (date: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
const status = (days: number, remind: number) =>
  days < 0 ? "expired" : days <= remind ? "due" : "normal";

export function MigrantWorkerDocumentsPage() {
  const [workers, setWorkers] = useState<ForeignWorker[]>([]);
  const [documents, setDocuments] = useState<MigrantWorkerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState<"all" | "expired" | "due">("all");
  const [workerForm, setWorkerForm] = useState(blankWorker());
  const [docForm, setDocForm] = useState(blankDoc());
  const [workerOpen, setWorkerOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [includeDocs, setIncludeDocs] = useState(true);
  const [workerDocs, setWorkerDocs] = useState<InitialDocItem[]>([
    blankNewDoc("PASSPORT_RED"),
  ]);
  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addDocRow = () => {
    setWorkerDocs([
      ...workerDocs,
      blankNewDoc("PASSPORT_RED"),
    ]);
  };
  const removeDocRow = (id: string) => {
    setWorkerDocs(workerDocs.filter((d) => d.id !== id));
  };
  const updateDocRow = (id: string, updates: Partial<InitialDocItem>) => {
    setWorkerDocs(
      workerDocs.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    );
  };
  const load = async () => {
    setLoading(true);
    try {
      const data = await migrantWorkerService.load();
      setWorkers(data.workers);
      setDocuments(data.documents);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const nameById = useMemo(
    () => new Map(workers.map((w) => [w.id, w])),
    [workers],
  );
  const expiryRows = useMemo(
    () =>
      documents
        .filter((d) => d.isActive)
        .flatMap((d) => {
          const rows: {
            doc: MigrantWorkerDocument;
            field: string;
            date: string;
            days: number;
          }[] = [];
          if (d.expiresOn)
            rows.push({
              doc: d,
              field: d.documentType.includes("PASSPORT")
                ? "วันหมดอายุเล่มพาสปอร์ต"
                : "วันหมดอายุบัตร",
              date: d.expiresOn,
              days: daysUntil(d.expiresOn),
            });
          if (d.visaExpiresOn)
            rows.push({
              doc: d,
              field: "วันหมดอายุวีซ่า",
              date: d.visaExpiresOn,
              days: daysUntil(d.visaExpiresOn),
            });
          if (d.areaPermitExpiresOn)
            rows.push({
              doc: d,
              field: "วันหมดอายุใบออกนอกพื้นที่",
              date: d.areaPermitExpiresOn,
              days: daysUntil(d.areaPermitExpiresOn),
            });
          if (d.workPermitExpiresOn)
            rows.push({
              doc: d,
              field: "วันหมดอายุใบอนุญาตทำงาน",
              date: d.workPermitExpiresOn,
              days: daysUntil(d.workPermitExpiresOn),
            });
          return rows;
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    [documents],
  );
  const shown = expiryRows.filter(
    (row) =>
      filter === "all" || status(row.days, row.doc.remindDays) === filter,
  );
  const expired = expiryRows.filter((r) => r.days < 0).length;
  const due = expiryRows.filter(
    (r) => r.days >= 0 && r.days <= r.doc.remindDays,
  ).length;
  const editDoc = (doc: MigrantWorkerDocument) => {
    setDocForm({ ...doc });
    setDocOpen(true);
  };
  const saveWorker = async () => {
    if (!workerForm.employeeCode.trim() || !workerForm.fullName.trim()) {
      setToast("กรุณากรอกรหัสพนักงานและชื่อ-สกุล");
      return;
    }
    if (!workerForm.department.trim()) {
      setToast("กรุณาเลือกแผนก");
      return;
    }

    if (!workerForm.id && includeDocs && workerDocs.length > 0) {
      for (let i = 0; i < workerDocs.length; i++) {
        const d = workerDocs[i];
        const docLabel = labels[d.documentType];
        if (!d.documentNumber.trim()) {
          setToast(
            `กรุณากรอกเลขที่เอกสารสำหรับ "${docLabel}" (ฉบับที่ ${i + 1})`,
          );
          return;
        }
        if (!d.expiresOn) {
          setToast(
            `กรุณาระบุวันหมดอายุสำหรับ "${docLabel}" (ฉบับที่ ${i + 1})`,
          );
          return;
        }
        if (
          (d.documentType === "PASSPORT_RED" ||
            d.documentType === "PASSPORT_GREEN") &&
          !d.visaExpiresOn
        ) {
          setToast(
            `กรุณาระบุวันหมดอายุวีซ่าสำหรับ "${docLabel}" (ฉบับที่ ${i + 1})`,
          );
          return;
        }
        if (d.documentType === "TEN_YEAR_CARD" && !d.areaPermitExpiresOn) {
          setToast(
            `กรุณาระบุวันหมดอายุใบออกนอกพื้นที่สำหรับ "${docLabel}" (ฉบับที่ ${i + 1})`,
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      const savedWorker = await migrantWorkerService.saveWorker({
        ...workerForm,
        employeeCode: workerForm.employeeCode.trim(),
        fullName: workerForm.fullName.trim(),
        nationalId: workerForm.nationalId.trim(),
        nationality: workerForm.nationality.trim(),
        organizationUnit: (workerForm.organizationUnit ?? "").trim(),
        title: workerForm.title.trim(),
        position: workerForm.position.trim(),
        note: (workerForm.note ?? "").trim(),
      });

      if (!workerForm.id && includeDocs && workerDocs.length > 0) {
        for (const d of workerDocs) {
          const isPassport =
            d.documentType === "PASSPORT_RED" ||
            d.documentType === "PASSPORT_GREEN";
          const isArea = d.documentType === "TEN_YEAR_CARD";
          await migrantWorkerService.saveDocument({
            id: "",
            workerId: savedWorker.id,
            documentType: d.documentType,
            documentNumber: d.documentNumber.trim(),
            issuedOn: d.issuedOn,
            expiresOn: d.expiresOn,
            visaIssuedOn: isPassport ? d.visaIssuedOn : null,
            visaExpiresOn: isPassport ? d.visaExpiresOn : null,
            areaPermitIssuedOn: isArea ? d.areaPermitIssuedOn : null,
            areaPermitExpiresOn: isArea ? d.areaPermitExpiresOn : null,
            workPermitNumber: d.workPermitNumber.trim(),
            workPermitIssuedOn: d.workPermitIssuedOn,
            workPermitExpiresOn: d.workPermitExpiresOn,
            remindDays: d.remindDays,
            note: d.note.trim(),
            isActive: true,
          });
        }
      }

      setToast(
        !workerForm.id && includeDocs && workerDocs.length > 0
          ? `บันทึกข้อมูลพนักงานและเอกสาร ${workerDocs.length} ฉบับเรียบร้อยแล้ว`
          : "บันทึกข้อมูลพนักงานแล้ว",
      );
      setWorkerOpen(false);
      await load();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const saveDoc = async () => {
    if (!docForm.workerId) {
      setToast("กรุณาเลือกพนักงาน");
      return;
    }
    if (!docForm.documentNumber.trim()) {
      setToast("กรุณาระบุเลขที่เอกสาร");
      return;
    }
    setSaving(true);
    try {
      const passport =
        docForm.documentType === "PASSPORT_RED" ||
        docForm.documentType === "PASSPORT_GREEN";
      const area = docForm.documentType === "TEN_YEAR_CARD";
      await migrantWorkerService.saveDocument({
        ...docForm,
        documentNumber: docForm.documentNumber.trim(),
        visaIssuedOn: passport ? docForm.visaIssuedOn : null,
        visaExpiresOn: passport ? docForm.visaExpiresOn : null,
        areaPermitIssuedOn: area ? docForm.areaPermitIssuedOn : null,
        areaPermitExpiresOn: area ? docForm.areaPermitExpiresOn : null,
        workPermitNumber: docForm.workPermitNumber.trim(),
        workPermitIssuedOn: docForm.workPermitIssuedOn,
        workPermitExpiresOn: docForm.workPermitExpiresOn,
        note: docForm.note.trim(),
      });
      setToast("บันทึกเอกสารแล้ว");
      setDocOpen(false);
      await load();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const date = (
    key:
      | "issuedOn"
      | "expiresOn"
      | "visaIssuedOn"
      | "visaExpiresOn"
      | "areaPermitIssuedOn"
      | "areaPermitExpiresOn"
      | "workPermitIssuedOn"
      | "workPermitExpiresOn",
    label: string,
  ) => (
    <label>
      {label}
      <input
        type="date"
        value={docForm[key] ?? ""}
        onChange={(e) =>
          setDocForm({ ...docForm, [key]: e.target.value || null })
        }
      />
    </label>
  );
  // ---- Import handler ----
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseImportFile(file);
      setImportRows(rows);
      setImportDone(false);
      setImportErrors([]);
      setImportSuccessCount(0);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "อ่านไฟล์ไม่สำเร็จ กรุณาตรวจสอบรูปแบบไฟล์");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runImport = async () => {
    const validRows = importRows.filter((r) => r.errors.length === 0);
    if (!validRows.length) {
      setToast("ไม่มีแถวที่ถูกต้องสำหรับนำเข้า กรุณาตรวจสอบข้อผิดพลาดในตารางด้านล่าง");
      return;
    }
    setImporting(true);
    setImportErrors([]);
    let success = 0;
    const errorsList: string[] = [];

    try {
      // Group by employeeCode to avoid duplicate worker creation
      const workerCodeMap = new Map<string, string>(); // code -> id
      // Existing workers
      for (const w of workers) workerCodeMap.set(w.employeeCode, w.id);

      for (const row of validRows) {
        try {
          let workerId = workerCodeMap.get(row.employeeCode);
          if (!workerId) {
            const saved = await migrantWorkerService.saveWorker({
              id: "",
              employeeCode: row.employeeCode,
              title: row.title,
              fullName: row.fullName,
              nationality: row.nationality,
              department: row.department,
              organizationUnit: "",
              nationalId: row.nationalId,
              birthDate: row.birthDate,
              position: "",
              note: "",
              isActive: true,
            });
            workerId = saved.id;
            workerCodeMap.set(row.employeeCode, workerId);
          }

          if (row.documentType) {
            const isPassport =
              row.documentType === "PASSPORT_RED" ||
              row.documentType === "PASSPORT_GREEN";
            const isArea = row.documentType === "TEN_YEAR_CARD";
            await migrantWorkerService.saveDocument({
              id: "",
              workerId,
              documentType: row.documentType,
              documentNumber: row.documentNumber,
              issuedOn: row.issuedOn,
              expiresOn: row.expiresOn,
              visaIssuedOn: isPassport ? row.visaIssuedOn : null,
              visaExpiresOn: isPassport ? row.visaExpiresOn : null,
              areaPermitIssuedOn: isArea ? row.areaPermitIssuedOn : null,
              areaPermitExpiresOn: isArea ? row.areaPermitExpiresOn : null,
              workPermitNumber: row.workPermitNumber,
              workPermitIssuedOn: row.workPermitIssuedOn,
              workPermitExpiresOn: row.workPermitExpiresOn,
              remindDays: row.remindDays,
              note: row.docNote,
              isActive: true,
            });
          }
          success++;
        } catch (rowErr) {
          const msg = rowErr instanceof Error ? rowErr.message : "บันทึกไม่สำเร็จ";
          errorsList.push(`แถวที่ ${row.rowIndex} (${row.employeeCode} - ${row.fullName}): ${msg}`);
        }
      }

      setImportSuccessCount(success);
      setImportErrors(errorsList);
      setImportDone(true);
      if (errorsList.length === 0) {
        setToast(`นำเข้าข้อมูลสำเร็จทั้งหมด ${success} รายการ`);
      } else {
        setToast(`นำเข้าสำเร็จ ${success} รายการ, ผิดพลาด ${errorsList.length} รายการ`);
      }
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "การนำเข้าขัดข้อง");
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="page migrant-documents-page">
      <div className="page-heading">
        <div>
          <h1>เอกสารแรงงานต่างด้าว</h1>
          <p>จัดการข้อมูลพนักงาน เอกสาร และวันครบกำหนดต่ออายุ</p>
        </div>
        <div className="page-actions">
          <button
            className="btn secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={17} /> รีเฟรช
          </button>
          {/* Export buttons */}
          <button
            className="btn secondary"
            onClick={() => exportToExcel(workers, documents)}
            disabled={!workers.length}
            title="ดาวน์โหลดเป็น Excel"
          >
            <FileDown size={17} /> Excel
          </button>
          <button
            className="btn secondary"
            onClick={() => exportToCSV(workers, documents)}
            disabled={!workers.length}
            title="ดาวน์โหลดเป็น CSV"
          >
            <Download size={17} /> CSV
          </button>
          {/* Import button */}
          <button
            className="btn secondary"
            onClick={() => {
              setImportRows([]);
              setImportDone(false);
              setImportOpen(true);
            }}
          >
            <FileUp size={17} /> นำเข้าข้อมูล
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              setWorkerForm(blankWorker());
              setWorkerDocs([blankNewDoc("PASSPORT_RED")]);
              setIncludeDocs(true);
              setWorkerOpen(true);
            }}
          >
            <Users size={17} /> เพิ่มพนักงาน
          </button>
          <button
            className="btn primary"
            onClick={() => {
              setDocForm(blankDoc(workers.find((w) => w.isActive)?.id ?? ""));
              setDocOpen(true);
            }}
            disabled={!workers.length}
          >
            <FilePlus2 size={17} /> เพิ่มเอกสาร
          </button>
        </div>
      </div>
      <div className="summary-grid">
        <article className="summary-card">
          <span>พนักงานที่ใช้งาน</span>
          <b>{workers.filter((w) => w.isActive).length}</b>
          <small>คน</small>
        </article>
        <article className="summary-card danger">
          <span>เอกสารหมดอายุ</span>
          <b>{expired}</b>
          <small>รายการ</small>
        </article>
        <article className="summary-card warning">
          <span>ใกล้ครบกำหนด</span>
          <b>{due}</b>
          <small>รายการ</small>
        </article>
        <article className="summary-card">
          <span>เอกสารที่บันทึก</span>
          <b>{documents.filter((d) => d.isActive).length}</b>
          <small>ฉบับ</small>
        </article>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <h2>
              <AlertTriangle size={20} /> แจ้งเตือนเอกสารใกล้ครบกำหนด
            </h2>
            <p>คำนวณตามจำนวนวันแจ้งเตือนที่กำหนดในแต่ละเอกสาร</p>
          </div>
          <div className="filter-tabs">
            {(["all", "expired", "due"] as const).map((v) => (
              <button
                key={v}
                className={filter === v ? "active" : ""}
                onClick={() => setFilter(v)}
              >
                {v === "all"
                  ? "ทั้งหมด"
                  : v === "expired"
                    ? "หมดอายุ"
                    : "ใกล้ครบกำหนด"}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>พนักงาน</th>
                <th>เอกสาร</th>
                <th>เลขที่</th>
                <th>รายการ</th>
                <th>วันครบกำหนด</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const state = status(row.days, row.doc.remindDays);
                return (
                  <tr key={`${row.doc.id}-${row.field}`}>
                    <td>
                      <b>{nameById.get(row.doc.workerId)?.fullName ?? "-"}</b>
                      <small>
                        {nameById.get(row.doc.workerId)?.employeeCode}
                      </small>
                    </td>
                    <td>{labels[row.doc.documentType] ?? row.doc.documentType}</td>
                    <td className="mono">
                      {row.field === "วันหมดอายุใบอนุญาตทำงาน"
                        ? row.doc.workPermitNumber || "-"
                        : row.doc.documentNumber || "-"}
                    </td>
                    <td>{row.field}</td>
                    <td>{thaiDate(row.date)}</td>
                    <td>
                      <span className={`status status-${state}`}>
                        {row.days < 0
                          ? `เกิน ${Math.abs(row.days)} วัน`
                          : row.days === 0
                            ? "ครบกำหนดวันนี้"
                            : `อีก ${row.days} วัน`}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-action"
                        onClick={() => editDoc(row.doc)}
                      >
                        <Edit3 size={15} /> ต่ออายุ/แก้ไข
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && !shown.length && (
            <div className="empty">ไม่พบรายการตามตัวกรอง</div>
          )}
          {loading && <div className="empty">กำลังโหลดข้อมูล...</div>}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <h2>
              <Users size={20} /> รายชื่อแรงงานต่างด้าว
            </h2>
            <p>กดเพิ่มเอกสารหรือแก้ไขข้อมูลได้จากรายการนี้</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัสพนักงาน</th>
                <th>ชื่อ-นามสกุล</th>
                <th>เลขบัตรประชาชน</th>
                <th>แผนก</th>
                <th>เอกสาร</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => {
                const docs = documents.filter(
                  (d) => d.workerId === w.id && d.isActive,
                );
                return (
                  <tr key={w.id}>
                    <td className="mono">{w.employeeCode}</td>
                    <td>
                      <b>{[w.title, w.fullName].filter(Boolean).join(" ")}</b>
                      {!w.isActive && <small>ระงับการใช้งาน</small>}
                    </td>
                    <td className="mono">{w.nationalId || "-"}</td>
                    <td>{w.department}</td>
                    <td>
                      {docs.length
                        ? docs.map((d) => (
                            <span className="document-chip" key={d.id}>
                              {labels[d.documentType] ?? d.documentType}
                            </span>
                          ))
                        : "-"}
                    </td>
                    <td>
                      <button
                        className="icon-action"
                        onClick={() => {
                          setWorkerForm({ ...w });
                          setIncludeDocs(false);
                          setWorkerOpen(true);
                        }}
                      >
                        <Edit3 size={15} /> แก้ไข
                      </button>
                      <button
                        className="icon-action"
                        onClick={() => {
                          setDocForm(blankDoc(w.id));
                          setDocOpen(true);
                        }}
                      >
                        <Plus size={15} /> เอกสาร
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && !workers.length && (
            <div className="empty">ยังไม่มีข้อมูลพนักงาน</div>
          )}
        </div>
      </div>
      {workerOpen && (
        <Modal
          title={workerForm.id ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานและเอกสาร"}
          onClose={() => setWorkerOpen(false)}
        >
          <div className="modal-body form-stack">
            <div>
              <h3 className="section-title">
                <Users size={16} /> ข้อมูลพนักงาน
              </h3>
              <div className="form-grid" style={{ marginTop: "10px" }}>
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
                    placeholder="เช่น CM-1234"
                  />
                </label>
                <label>
                  คำนำหน้า
                  <select
                    value={workerForm.title}
                    onChange={(e) =>
                      setWorkerForm({ ...workerForm, title: e.target.value })
                    }
                  >
                    <option value="">เลือกคำนำหน้า</option>
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    {workerForm.title && !TITLES.includes(workerForm.title) && (
                      <option value={workerForm.title}>
                        {workerForm.title}
                      </option>
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
                    placeholder="ชื่อและนามสกุล"
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
                      <option key={x}>{x}</option>
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
                  />
                </label>
                <label>
                  วันเกิด
                  <input
                    type="date"
                    value={workerForm.birthDate ?? ""}
                    onChange={(e) =>
                      setWorkerForm({
                        ...workerForm,
                        birthDate: e.target.value || null,
                      })
                    }
                  />
                </label>
                <label>
                  เลขประจำตัว / บัตรประชาชน
                  <input
                    value={workerForm.nationalId}
                    onChange={(e) =>
                      setWorkerForm({
                        ...workerForm,
                        nationalId: e.target.value,
                      })
                    }
                    placeholder="เลข 13 หลัก หรือเลขประจำตัว"
                  />
                </label>
                <label className="checkbox-row full">
                  <input
                    type="checkbox"
                    checked={workerForm.isActive}
                    onChange={(e) =>
                      setWorkerForm({
                        ...workerForm,
                        isActive: e.target.checked,
                      })
                    }
                  />{" "}
                  ใช้งานข้อมูลพนักงานนี้
                </label>
              </div>
            </div>

            {!workerForm.id && (
              <div className="doc-section-wrapper">
                <div className="section-title-bar">
                  <h3 className="section-title">
                    <FileText size={16} /> ข้อมูลเอกสาร
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
                    {workerDocs.map((doc, idx) => {
                      const isPassport =
                        doc.documentType === "PASSPORT_RED" ||
                        doc.documentType === "PASSPORT_GREEN";
                      const isArea = doc.documentType === "TEN_YEAR_CARD";
                      return (
                        <div key={doc.id} className="combined-doc-card">
                          <div className="combined-doc-header">
                            <span className="combined-doc-badge">
                              <FileText size={15} /> ฉบับที่ {idx + 1}:{" "}
                              {labels[doc.documentType]}
                            </span>
                            {workerDocs.length > 1 && (
                              <button
                                type="button"
                                className="icon-action text-danger"
                                onClick={() => removeDocRow(doc.id)}
                                title="ลบเอกสารฉบับนี้"
                              >
                                <Trash2 size={15} /> ลบฉบับนี้
                              </button>
                            )}
                          </div>
                          <div className="form-grid">
                            <label>
                              ประเภทเอกสาร *
                              <select
                                value={doc.documentType}
                                onChange={(e) =>
                                  updateDocRow(doc.id, {
                                    documentType: e.target
                                      .value as MigrantDocumentType,
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
                              {isPassport
                                ? "วันออกเล่มพาสปอร์ต"
                                : "วันออกบัตร"}
                              <input
                                type="date"
                                value={doc.issuedOn ?? ""}
                                onChange={(e) =>
                                  updateDocRow(doc.id, {
                                    issuedOn: e.target.value || null,
                                  })
                                }
                              />
                            </label>
                            <label>
                              {isPassport
                                ? "วันหมดอายุเล่มพาสปอร์ต *"
                                : "วันหมดอายุบัตร *"}
                              <input
                                type="date"
                                value={doc.expiresOn ?? ""}
                                onChange={(e) =>
                                  updateDocRow(doc.id, {
                                    expiresOn: e.target.value || null,
                                  })
                                }
                              />
                            </label>
                            {isPassport && (
                              <>
                                <label>
                                  วันออกวีซ่า
                                  <input
                                    type="date"
                                    value={doc.visaIssuedOn ?? ""}
                                    onChange={(e) =>
                                      updateDocRow(doc.id, {
                                        visaIssuedOn: e.target.value || null,
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  วันหมดอายุวีซ่า *
                                  <input
                                    type="date"
                                    value={doc.visaExpiresOn ?? ""}
                                    onChange={(e) =>
                                      updateDocRow(doc.id, {
                                        visaExpiresOn:
                                          e.target.value || null,
                                      })
                                    }
                                  />
                                </label>
                              </>
                            )}
                            {isArea && (
                              <>
                                <label>
                                  วันออกใบออกนอกพื้นที่ *
                                  <input
                                    type="date"
                                    value={doc.areaPermitIssuedOn ?? ""}
                                    onChange={(e) =>
                                      updateDocRow(doc.id, {
                                        areaPermitIssuedOn:
                                          e.target.value || null,
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  วันหมดอายุใบออกนอกพื้นที่ *
                                  <input
                                    type="date"
                                    value={doc.areaPermitExpiresOn ?? ""}
                                    onChange={(e) =>
                                      updateDocRow(doc.id, {
                                        areaPermitExpiresOn:
                                          e.target.value || null,
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
                              <input
                                type="date"
                                value={doc.workPermitIssuedOn ?? ""}
                                onChange={(e) =>
                                  updateDocRow(doc.id, {
                                    workPermitIssuedOn: e.target.value || null,
                                  })
                                }
                              />
                            </label>
                            <label>
                              วันหมดอายุใบอนุญาตทำงาน
                              <input
                                type="date"
                                value={doc.workPermitExpiresOn ?? ""}
                                onChange={(e) =>
                                  updateDocRow(doc.id, {
                                    workPermitExpiresOn: e.target.value || null,
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

                    <button
                      type="button"
                      className="btn secondary compact add-doc-btn"
                      onClick={addDocRow}
                    >
                      <Plus size={15} /> เพิ่มเอกสารอีกฉบับ
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button
              className="btn secondary"
              onClick={() => setWorkerOpen(false)}
            >
              ยกเลิก
            </button>
            <button
              className="btn primary"
              disabled={saving}
              onClick={() => void saveWorker()}
            >
              {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          </div>
        </Modal>
      )}
      {docOpen && (
        <Modal
          title={docForm.id ? "ต่ออายุหรือแก้ไขเอกสาร" : "เพิ่มเอกสาร"}
          onClose={() => setDocOpen(false)}
        >
          <div className="modal-body form-grid">
            <label>
              พนักงาน *
              <select
                value={docForm.workerId}
                onChange={(e) =>
                  setDocForm({ ...docForm, workerId: e.target.value })
                }
              >
                <option value="">เลือกพนักงาน</option>
                {workers
                  .filter((w) => w.isActive)
                  .map((w) => (
                    <option value={w.id} key={w.id}>
                      {w.employeeCode} — {w.fullName}
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
                onChange={(e) =>
                  setDocForm({ ...docForm, documentNumber: e.target.value })
                }
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
                onChange={(e) =>
                  setDocForm({ ...docForm, remindDays: Number(e.target.value) })
                }
              />
            </label>
            {date(
              "issuedOn",
              docForm.documentType.includes("PASSPORT")
                ? "วันออกเล่มพาสปอร์ต *"
                : "วันออกบัตร *",
            )}
            {date(
              "expiresOn",
              docForm.documentType.includes("PASSPORT")
                ? "วันหมดอายุเล่มพาสปอร์ต *"
                : "วันหมดอายุบัตร *",
            )}
            {(docForm.documentType === "PASSPORT_RED" ||
              docForm.documentType === "PASSPORT_GREEN") && (
              <>
                {date("visaIssuedOn", "วันออกวีซ่า")}
                {date("visaExpiresOn", "วันหมดอายุวีซ่า *")}
              </>
            )}
            {docForm.documentType === "TEN_YEAR_CARD" && (
              <>
                {date("areaPermitIssuedOn", "วันออกใบออกนอกพื้นที่ *")}
                {date("areaPermitExpiresOn", "วันหมดอายุใบออกนอกพื้นที่ *")}
              </>
            )}
            <label>
              เลขที่ใบอนุญาตทำงาน
              <input
                value={docForm.workPermitNumber}
                onChange={(e) =>
                  setDocForm({ ...docForm, workPermitNumber: e.target.value })
                }
                placeholder="ระบุเลขที่ใบอนุญาตทำงาน (เว้นว่างได้)"
              />
            </label>
            {date("workPermitIssuedOn", "วันออกใบอนุญาตทำงาน")}
            {date("workPermitExpiresOn", "วันหมดอายุใบอนุญาตทำงาน")}
            <label>
              หมายเหตุ
              <textarea
                value={docForm.note}
                onChange={(e) =>
                  setDocForm({ ...docForm, note: e.target.value })
                }
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={docForm.isActive}
                onChange={(e) =>
                  setDocForm({ ...docForm, isActive: e.target.checked })
                }
              />{" "}
              ใช้งานเอกสารนี้
            </label>
          </div>
          <div className="modal-actions">
            <button className="btn secondary" onClick={() => setDocOpen(false)}>
              ยกเลิก
            </button>
            <button
              className="btn primary"
              disabled={saving}
              onClick={() => void saveDoc()}
            >
              {saving ? "กำลังบันทึก..." : "บันทึกเอกสาร"}
            </button>
          </div>
        </Modal>
      )}
      {/* Import Modal */}
      {importOpen && (
        <Modal title="นำเข้าข้อมูลจากไฟล์" onClose={() => setImportOpen(false)}>
          <div className="modal-body import-modal-body">
            {/* Step 1: download template */}
            <div className="import-step">
              <h3 className="import-step-title">1. ดาวน์โหลด Template</h3>
              <p className="import-hint">
                ดาวน์โหลดไฟล์ตัวอย่างเพื่อกรอกข้อมูล แล้วอัปโหลดกลับมา
              </p>
              <button
                className="btn secondary compact"
                onClick={downloadTemplate}
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
                  onChange={(e) => void handleImportFile(e)}
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
                  3. ตรวจสอบข้อมูล ({importRows.length} แถว /{" "}
                  {importRows.filter((r) => r.errors.length === 0).length}{" "}
                  แถวถูกต้อง)
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
                          <td className="mono">{row.expiresOn ?? "-"}</td>
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
              onClick={() => setImportOpen(false)}
            >
              ปิด
            </button>
            <button
              className="btn primary"
              disabled={
                importing ||
                importDone ||
                !importRows.filter((r) => r.errors.length === 0).length
              }
              onClick={() => void runImport()}
            >
              {importing
                ? "กำลังนำเข้า..."
                : `นำเข้า ${
                    importRows.filter((r) => r.errors.length === 0).length
                  } แถว`}
            </button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} />}
    </section>
  );
}
