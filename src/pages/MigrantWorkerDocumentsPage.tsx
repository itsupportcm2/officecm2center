import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileDown,
  FilePlus2,
  FileText,
  FileUp,
  Filter,
  Globe2,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Confirm, Modal, Toast } from "../components/ui";
import { DEPARTMENTS } from "../constants/departments";
import {
  migrantWorkerService,
  getWorkerGender,
  type ForeignWorker,
  type MigrantDocumentType,
  type MigrantWorkerDocument,
  type WorkerGender,
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

const DOC_COLORS: Record<MigrantDocumentType, string> = {
  PASSPORT_RED: "#ef4444",
  PASSPORT_GREEN: "#10b981",
  PINK_CARD: "#ec4899",
  TEN_YEAR_CARD: "#8b5cf6",
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
  phone: "",
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

/** แปลงจำนวนวันเป็น "X วัน / X เดือน Y วัน / X ปี Y เดือน" */
const formatDays = (absDays: number): string => {
  if (absDays < 30) return `${absDays} วัน`;
  const years = Math.floor(absDays / 365);
  const rem = absDays % 365;
  const months = Math.floor(rem / 30);
  const days = rem % 30;
  if (years > 0) {
    return months > 0 ? `${years} ปี ${months} เดือน` : `${years} ปี`;
  }
  return days > 0 ? `${months} เดือน ${days} วัน` : `${months} เดือน`;
};

export function MigrantWorkerDocumentsPage() {
  const [workers, setWorkers] = useState<ForeignWorker[]>([]);
  const [documents, setDocuments] = useState<MigrantWorkerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Navigation & View tabs
  const [viewMode, setViewMode] = useState<"workers" | "expiry" | "documents">("workers");
  const [expirySubFilter, setExpirySubFilter] = useState<"all" | "expired" | "due" | "caution" | "safe">("all");

  // Filter toolbar
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "MALE" | "FEMALE">("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all");

  // Worker detail accordion
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);

  // Forms and Modals
  const [workerForm, setWorkerForm] = useState(blankWorker());
  const [docForm, setDocForm] = useState(blankDoc());
  const [workerOpen, setWorkerOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [includeDocs, setIncludeDocs] = useState(true);
  const [workerDocs, setWorkerDocs] = useState<InitialDocItem[]>([
    blankNewDoc("PASSPORT_RED"),
  ]);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addDocRow = () => {
    setWorkerDocs([...workerDocs, blankNewDoc("PASSPORT_RED")]);
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

  const workerMap = useMemo(
    () => new Map(workers.map((w) => [w.id, w])),
    [workers],
  );

  // Expiry calculation across all active documents
  const expiryRows = useMemo(() => {
    return documents
      .filter((d) => d.isActive && workerMap.has(d.workerId))
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
      .sort((a, b) => a.days - b.days);
  }, [documents, workerMap]);

  // Overall counts for summary
  const totalActiveWorkers = useMemo(() => workers.filter((w) => w.isActive).length, [workers]);
  const totalActiveDocs = useMemo(() => documents.filter((d) => d.isActive).length, [documents]);
  const expiredCount = useMemo(() => expiryRows.filter((r) => r.days < 0).length, [expiryRows]);
  const dueCount = useMemo(() => expiryRows.filter((r) => r.days >= 0 && r.days <= 30).length, [expiryRows]);
  const cautionCount = useMemo(() => expiryRows.filter((r) => r.days > 30 && r.days <= 90).length, [expiryRows]);
  const safeCount = useMemo(() => expiryRows.filter((r) => r.days > 90).length, [expiryRows]);

  // Gender counts
  const genderStats = useMemo(() => {
    let male = 0;
    let female = 0;
    let other = 0;
    for (const w of workers) {
      if (!w.isActive) continue;
      const g = getWorkerGender(w);
      if (g === "MALE") male++;
      else if (g === "FEMALE") female++;
      else other++;
    }
    return { male, female, other };
  }, [workers]);

  // Department list for filters
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    for (const w of workers) if (w.department) set.add(w.department);
    return Array.from(set).sort();
  }, [workers]);

  // Filtered Workers list
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      if (deptFilter !== "all" && w.department !== deptFilter) return false;
      if (genderFilter !== "all" && getWorkerGender(w) !== genderFilter) return false;
      if (docTypeFilter !== "all") {
        const workerDocTypes = documents
          .filter((d) => d.workerId === w.id && d.isActive)
          .map((d) => d.documentType);
        if (!workerDocTypes.includes(docTypeFilter as MigrantDocumentType)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const docs = documents.filter((d) => d.workerId === w.id && d.isActive);
        const matchDoc = docs.some(
          (d) =>
            d.documentNumber.toLowerCase().includes(q) ||
            d.workPermitNumber.toLowerCase().includes(q),
        );
        const matchWorker =
          w.fullName.toLowerCase().includes(q) ||
          w.employeeCode.toLowerCase().includes(q) ||
          w.department.toLowerCase().includes(q) ||
          (w.phone && w.phone.toLowerCase().includes(q)) ||
          (w.nationalId && w.nationalId.toLowerCase().includes(q)) ||
          (w.nationality && w.nationality.toLowerCase().includes(q));
        if (!matchDoc && !matchWorker) return false;
      }
      return true;
    });
  }, [workers, documents, deptFilter, genderFilter, docTypeFilter, searchQuery]);

  // Filtered Expiry Rows
  const filteredExpiryRows = useMemo(() => {
    return expiryRows.filter((row) => {
      const worker = workerMap.get(row.doc.workerId);
      if (!worker) return false;

      if (expirySubFilter === "expired" && row.days >= 0) return false;
      if (expirySubFilter === "due" && (row.days < 0 || row.days > 30)) return false;
      if (expirySubFilter === "caution" && (row.days <= 30 || row.days > 90)) return false;
      if (expirySubFilter === "safe" && row.days <= 90) return false;

      if (deptFilter !== "all" && worker.department !== deptFilter) return false;
      if (genderFilter !== "all" && getWorkerGender(worker) !== genderFilter) return false;
      if (docTypeFilter !== "all" && row.doc.documentType !== docTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          worker.fullName.toLowerCase().includes(q) ||
          worker.employeeCode.toLowerCase().includes(q) ||
          worker.department.toLowerCase().includes(q) ||
          (worker.phone && worker.phone.toLowerCase().includes(q)) ||
          row.doc.documentNumber.toLowerCase().includes(q) ||
          row.doc.workPermitNumber.toLowerCase().includes(q) ||
          row.field.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [expiryRows, workerMap, expirySubFilter, deptFilter, genderFilter, docTypeFilter, searchQuery]);

  // Filtered All Documents list
  const filteredAllDocs = useMemo(() => {
    return documents.filter((doc) => {
      const worker = workerMap.get(doc.workerId);
      if (!worker) return false;

      if (deptFilter !== "all" && worker.department !== deptFilter) return false;
      if (genderFilter !== "all" && getWorkerGender(worker) !== genderFilter) return false;
      if (docTypeFilter !== "all" && doc.documentType !== docTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          worker.fullName.toLowerCase().includes(q) ||
          worker.employeeCode.toLowerCase().includes(q) ||
          worker.department.toLowerCase().includes(q) ||
          doc.documentNumber.toLowerCase().includes(q) ||
          doc.workPermitNumber.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [documents, workerMap, deptFilter, genderFilter, docTypeFilter, searchQuery]);

  const editDoc = (doc: MigrantWorkerDocument) => {
    setDocForm({ ...doc });
    setDocOpen(true);
  };

  const openAddDocForWorker = (workerId: string) => {
    setDocForm(blankDoc(workerId));
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
          setToast(`กรุณากรอกเลขที่เอกสารสำหรับ "${docLabel}" (ฉบับที่ ${i + 1})`);
          return;
        }
        if (!d.expiresOn) {
          setToast(`กรุณาระบุวันหมดอายุสำหรับ "${docLabel}" (ฉบับที่ ${i + 1})`);
          return;
        }
        if (
          (d.documentType === "PASSPORT_RED" || d.documentType === "PASSPORT_GREEN") &&
          !d.visaExpiresOn
        ) {
          setToast(`กรุณาระบุวันหมดอายุวีซ่าสำหรับ "${docLabel}" (ฉบับที่ ${i + 1})`);
          return;
        }
        if (d.documentType === "TEN_YEAR_CARD" && !d.areaPermitExpiresOn) {
          setToast(`กรุณาระบุวันหมดอายุใบออกนอกพื้นที่สำหรับ "${docLabel}" (ฉบับที่ ${i + 1})`);
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
        phone: (workerForm.phone ?? "").trim(),
        nationalId: workerForm.nationalId.trim(),
        nationality: workerForm.nationality.trim(),
        organizationUnit: (workerForm.organizationUnit ?? "").trim(),
        title: workerForm.title.trim(),
        position: workerForm.position.trim(),
        note: (workerForm.note ?? "").trim(),
        isActive: true,
      });

      if (!workerForm.id && includeDocs && workerDocs.length > 0) {
        for (const d of workerDocs) {
          const isPassport =
            d.documentType === "PASSPORT_RED" || d.documentType === "PASSPORT_GREEN";
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

  const handleDeleteWorker = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await migrantWorkerService.deleteWorker(deleteTarget.id);
      setToast(`ลบข้อมูลพนักงาน "${deleteTarget.name}" เรียบร้อยแล้ว`);
      setDeleteTarget(null);
      setWorkerOpen(false);
      await load();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "ลบข้อมูลพนักงานไม่สำเร็จ");
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
        docForm.documentType === "PASSPORT_RED" || docForm.documentType === "PASSPORT_GREEN";
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
      const workerCodeMap = new Map<string, string>();
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
              phone: row.phone || "",
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
              row.documentType === "PASSPORT_RED" || row.documentType === "PASSPORT_GREEN";
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

  const renderDateField = (
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
        onChange={(e) => setDocForm({ ...docForm, [key]: e.target.value || null })}
      />
    </label>
  );

  return (
    <div className="mwp-container">
      {/* Hero Header */}
      <section className="mwp-hero">
        <div className="mwp-hero-content">
          <div className="mwp-hero-badge">
            <ShieldCheck size={14} />
            <span>ระบบบริหารจัดการข้อมูลแรงงานและเอกสารสำคัญ</span>
          </div>
          <h1>เอกสารแรงงานต่างด้าว</h1>
          <p className="mwp-hero-desc">
            บันทึกประวัติพนักงาน ตรวจสอบวันหมดอายุพาสปอร์ต วีซ่า และใบอนุญาตทำงาน พร้อมระบบแจ้งเตือนเชิงรุก
          </p>
        </div>

        <div className="mwp-hero-actions">
          <button
            type="button"
            className="mwp-btn-hero-primary"
            onClick={() => {
              setWorkerForm(blankWorker());
              setWorkerDocs([blankNewDoc("PASSPORT_RED")]);
              setIncludeDocs(true);
              setWorkerOpen(true);
            }}
          >
            <UserPlus size={17} />
            <span>เพิ่มพนักงานใหม่</span>
          </button>

          <button
            type="button"
            className="mwp-btn-hero-glass"
            onClick={() => {
              setDocForm(blankDoc(workers.find((w) => w.isActive)?.id ?? ""));
              setDocOpen(true);
            }}
            disabled={!workers.length}
          >
            <FilePlus2 size={16} />
            <span>เพิ่มเอกสาร</span>
          </button>

          <button
            type="button"
            className="mwp-btn-hero-glass"
            onClick={() => {
              setImportRows([]);
              setImportDone(false);
              setImportOpen(true);
            }}
          >
            <FileUp size={16} />
            <span>นำเข้าไฟล์</span>
          </button>

          <button
            type="button"
            className="mwp-btn-hero-glass"
            onClick={() => exportToExcel(workers, documents)}
            disabled={!workers.length}
            title="ดาวน์โหลด Excel"
          >
            <FileDown size={16} />
            <span>Excel</span>
          </button>

          <button
            type="button"
            className="mwp-btn-hero-glass"
            onClick={() => exportToCSV(workers, documents)}
            disabled={!workers.length}
            title="ดาวน์โหลด CSV"
          >
            <Download size={16} />
            <span>CSV</span>
          </button>

          <button
            type="button"
            className="mwp-btn-hero-glass"
            onClick={() => window.print()}
            title="พิมพ์รายงานตามตัวกรองที่เลือก (A4 Landscape / Save PDF)"
          >
            <Printer size={16} />
            <span>พิมพ์รายงาน</span>
          </button>
          <button
            type="button"
            className="mwp-btn-hero-glass"
            onClick={() => void load()}
            disabled={loading}
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
        </div>
      </section>

      {/* 4 Clickable Quick-Filter Summary Cards with Gender display */}
      <section className="mwp-stats-grid">
        <div
          className={`mwp-stat-card mwp-stat-blue ${viewMode === "workers" ? "active" : ""}`}
          onClick={() => {
            setViewMode("workers");
            setDeptFilter("all");
            setGenderFilter("all");
            setDocTypeFilter("all");
          }}
          title="คลิกเพื่อดูรายชื่อพนักงานทั้งหมด"
        >
          <div className="mwp-stat-top">
            <span className="mwp-stat-title">พนักงานที่ใช้งาน</span>
            <div className="mwp-stat-icon">
              <Users size={18} />
            </div>
          </div>
          <div className="mwp-stat-val-row">
            <span className="mwp-stat-val">{totalActiveWorkers.toLocaleString("th-TH")}</span>
            <span className="mwp-stat-unit">คน</span>
          </div>
          <div className="mwp-stat-hint mwp-stat-hint-active">
            <span>👨 ชาย {genderStats.male}</span>
            <span style={{ color: "#cbd5e1" }}>•</span>
            <span>👩 หญิง {genderStats.female}</span>
          </div>
        </div>

        <div
          className={`mwp-stat-card mwp-stat-teal ${viewMode === "documents" ? "active" : ""}`}
          onClick={() => {
            setViewMode("documents");
            setDeptFilter("all");
            setGenderFilter("all");
            setDocTypeFilter("all");
          }}
          title="คลิกเพื่อดูเอกสารทั้งหมดในระบบ"
        >
          <div className="mwp-stat-top">
            <span className="mwp-stat-title">เอกสารในระบบ</span>
            <div className="mwp-stat-icon">
              <FileText size={18} />
            </div>
          </div>
          <div className="mwp-stat-val-row">
            <span className="mwp-stat-val">{totalActiveDocs.toLocaleString("th-TH")}</span>
            <span className="mwp-stat-unit">ฉบับ</span>
          </div>
          <div className="mwp-stat-hint">
            <span>คลิกเพื่อดูเอกสารทุกฉบับ</span>
          </div>
        </div>

        <div
          className={`mwp-stat-card mwp-stat-red ${viewMode === "expiry" && expirySubFilter === "expired" ? "active" : ""}`}
          onClick={() => {
            setViewMode("expiry");
            setExpirySubFilter("expired");
          }}
          title="คลิกเพื่อดูรายการที่หมดอายุแล้ว"
        >
          <div className="mwp-stat-top">
            <span className="mwp-stat-title">เอกสารหมดอายุ</span>
            <div className="mwp-stat-icon">
              <AlertOctagon size={18} />
            </div>
          </div>
          <div className="mwp-stat-val-row">
            <span className="mwp-stat-val">{expiredCount.toLocaleString("th-TH")}</span>
            <span className="mwp-stat-unit">รายการ</span>
          </div>
          <div className="mwp-stat-hint" style={{ color: "#dc2626", fontWeight: 600 }}>
            <AlertTriangle size={12} />
            <span>ต้องดำเนินการต่ออายุด่วน</span>
          </div>
        </div>

        <div
          className={`mwp-stat-card mwp-stat-orange ${viewMode === "expiry" && expirySubFilter === "due" ? "active" : ""}`}
          onClick={() => {
            setViewMode("expiry");
            setExpirySubFilter("due");
          }}
          title="คลิกเพื่อดูรายการที่ใกล้ครบกำหนด"
        >
          <div className="mwp-stat-top">
            <span className="mwp-stat-title">ใกล้ครบกำหนด (≤ 30 วัน)</span>
            <div className="mwp-stat-icon">
              <CalendarClock size={18} />
            </div>
          </div>
          <div className="mwp-stat-val-row">
            <span className="mwp-stat-val">{dueCount.toLocaleString("th-TH")}</span>
            <span className="mwp-stat-unit">รายการ</span>
          </div>
          <div className="mwp-stat-hint" style={{ color: "#ea580c", fontWeight: 600 }}>
            <Clock size={12} />
            <span>ระยะเตรียมเอกสารล่วงหน้า</span>
          </div>
        </div>
      </section>

      {/* Main Container Card */}
      <div className="mwp-main-card">
        {/* Navigation Tabs Header */}
        <div className="mwp-view-nav">
          <div className="mwp-view-tabs">
            <button
              type="button"
              className={`mwp-view-tab-btn ${viewMode === "workers" ? "active" : ""}`}
              onClick={() => setViewMode("workers")}
            >
              <Users size={16} />
              <span>รายชื่อพนักงานและเอกสาร</span>
              <span className="mwp-view-tab-badge">{filteredWorkers.length}</span>
            </button>

            <button
              type="button"
              className={`mwp-view-tab-btn ${viewMode === "expiry" ? "active" : ""}`}
              onClick={() => setViewMode("expiry")}
            >
              <AlertTriangle size={16} />
              <span>ติดตามวันครบกำหนด</span>
              <span
                className="mwp-view-tab-badge"
                style={{
                  background: expiredCount > 0 ? "#fee2e2" : undefined,
                  color: expiredCount > 0 ? "#dc2626" : undefined,
                }}
              >
                {expiredCount + dueCount}
              </span>
            </button>

            <button
              type="button"
              className={`mwp-view-tab-btn ${viewMode === "documents" ? "active" : ""}`}
              onClick={() => setViewMode("documents")}
            >
              <FileText size={16} />
              <span>เอกสารทั้งหมดในระบบ</span>
              <span className="mwp-view-tab-badge">{filteredAllDocs.length}</span>
            </button>
          </div>

          {/* Sub-filter pills (only for expiry view) */}
          {viewMode === "expiry" && (
            <div className="mwp-sub-pills">
              <button
                type="button"
                className={`mwp-sub-pill ${expirySubFilter === "all" ? "active" : ""}`}
                onClick={() => setExpirySubFilter("all")}
              >
                ทั้งหมด ({expiryRows.length})
              </button>
              <button
                type="button"
                className={`mwp-sub-pill ${expirySubFilter === "expired" ? "active" : ""}`}
                style={{ color: expirySubFilter !== "expired" && expiredCount > 0 ? "#dc2626" : undefined }}
                onClick={() => setExpirySubFilter("expired")}
              >
                หมดอายุแล้ว ({expiredCount})
              </button>
              <button
                type="button"
                className={`mwp-sub-pill ${expirySubFilter === "due" ? "active" : ""}`}
                onClick={() => setExpirySubFilter("due")}
              >
                ใกล้ครบ ≤ 30 วัน ({dueCount})
              </button>
              <button
                type="button"
                className={`mwp-sub-pill ${expirySubFilter === "caution" ? "active" : ""}`}
                onClick={() => setExpirySubFilter("caution")}
              >
                31 - 90 วัน ({cautionCount})
              </button>
              <button
                type="button"
                className={`mwp-sub-pill ${expirySubFilter === "safe" ? "active" : ""}`}
                onClick={() => setExpirySubFilter("safe")}
              >
                ปลอดภัย &gt; 90 วัน ({safeCount})
              </button>
            </div>
          )}
        </div>

        {/* Unified Search & Filter Toolbar with Gender filter */}
        <div className="mwp-toolbar">
          <div className="mwp-search-wrap">
            <Search size={16} className="mwp-search-icon" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ-สกุล, รหัสบุคลากร, แผนก, สัญชาติ หรือเลขที่เอกสาร..."
              className="mwp-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={15} color="#64748b" />
            <select
              className="mwp-select"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
            >
              <option value="all">ทุกเพศ (ชาย/หญิง)</option>
              <option value="MALE">👨 เฉพาะชาย ({genderStats.male})</option>
              <option value="FEMALE">👩 เฉพาะหญิง ({genderStats.female})</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Building2 size={15} color="#64748b" />
            <select
              className="mwp-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="all">ทุกแผนก ({departmentsList.length})</option>
              {departmentsList.map((d) => (
                <option key={d} value={d}>
                  แผนก {d}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Filter size={15} color="#64748b" />
            <select
              className="mwp-select"
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
            >
              <option value="all">ทุกประเภทเอกสาร</option>
              {Object.entries(labels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600 }} className="mwp-count-text">
              {viewMode === "workers" && `พบ ${filteredWorkers.length} คน`}
              {viewMode === "expiry" && `พบ ${filteredExpiryRows.length} รายการ`}
              {viewMode === "documents" && `พบ ${filteredAllDocs.length} ฉบับ`}
            </span>
            <button
              type="button"
              className="mwp-btn-print"
              onClick={() => window.print()}
              title="พิมพ์รายงานข้อมูลที่กรองอยู่ (A4 Landscape / บันทึก PDF)"
            >
              <Printer size={15} />
              <span>พิมพ์รายงาน</span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* VIEW 1: Worker Directory with Expandable Document Drawer     */}
        {/* ============================================================ */}
        {viewMode === "workers" && (
          <div className="mwp-table-wrap">
            <table className="mwp-table">
              <thead>
                <tr>
                  <th>พนักงาน</th>
                  <th>เพศ</th>
                  <th>เลขบัตรประชาชน / ID</th>
                  <th>แผนก</th>
                  <th>เอกสารที่บันทึกไว้</th>
                  <th style={{ textAlign: "right" }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px" }}>
                      <RefreshCw size={22} className="spin" color="#175cd3" />
                      <div style={{ marginTop: "8px" }} className="mwp-muted-text">กำลังโหลดข้อมูลพนักงาน...</div>
                    </td>
                  </tr>
                ) : filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px" }}>
                      <div style={{ fontWeight: 600 }} className="mwp-muted-text">ไม่พบรายชื่อพนักงานที่ตรงกับเงื่อนไข</div>
                    </td>
                  </tr>
                ) : (
                  filteredWorkers.map((w) => {
                    const workerDocsList = documents.filter(
                      (d) => d.workerId === w.id && d.isActive,
                    );
                    const isExpanded = expandedWorkerId === w.id;
                    const initial = w.fullName.trim() ? w.fullName.trim()[0] : "W";
                    const gender = getWorkerGender(w);

                    // Check if any document has expired or is due
                    const hasExpiredDoc = workerDocsList.some((d) => {
                      if (d.expiresOn && daysUntil(d.expiresOn) < 0) return true;
                      if (d.visaExpiresOn && daysUntil(d.visaExpiresOn) < 0) return true;
                      if (d.workPermitExpiresOn && daysUntil(d.workPermitExpiresOn) < 0) return true;
                      return false;
                    });
                    const hasDueDoc = !hasExpiredDoc && workerDocsList.some((d) => {
                      if (d.expiresOn && daysUntil(d.expiresOn) <= 30) return true;
                      if (d.visaExpiresOn && daysUntil(d.visaExpiresOn) <= 30) return true;
                      if (d.workPermitExpiresOn && daysUntil(d.workPermitExpiresOn) <= 30) return true;
                      return false;
                    });

                    return (
                      <>
                        <tr key={w.id} className={isExpanded ? "mwp-row-expanded" : undefined}>
                          <td>
                            <div className="mwp-worker-cell">
                              <div className="mwp-avatar">{initial}</div>
                              <div className="mwp-worker-info">
                                <span className="mwp-worker-name">
                                  {[w.title, w.fullName].filter(Boolean).join(" ")}
                                </span>
                                <span className="mwp-worker-meta">
                                  <span>รหัส: {w.employeeCode}</span>
                                  {w.nationality && <span>• {w.nationality}</span>}
                                  {w.phone && <span>• 📞 {w.phone}</span>}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            {gender === "MALE" ? (
                              <span className="mwp-gender-badge mwp-gender-male">👨 ชาย</span>
                            ) : gender === "FEMALE" ? (
                              <span className="mwp-gender-badge mwp-gender-female">👩 หญิง</span>
                            ) : (
                              <span className="mwp-gender-badge mwp-gender-unknown">-</span>
                            )}
                          </td>

                          <td>
                            <span className="mono" style={{ fontSize: "0.85rem" }}>
                              {w.nationalId || "-"}
                            </span>
                          </td>

                          <td>
                            <span className="mwp-dept-badge">{w.department || "-"}</span>
                          </td>

                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              {workerDocsList.length === 0 ? (
                                <span style={{ fontSize: "0.82rem" }} className="mwp-muted-text">ไม่มีเอกสาร</span>
                              ) : (
                                workerDocsList.map((d) => (
                                  <span
                                    key={d.id}
                                    className="mwp-doc-pill"
                                    style={{
                                      background: `${DOC_COLORS[d.documentType]}12`,
                                      color: DOC_COLORS[d.documentType],
                                      border: `1px solid ${DOC_COLORS[d.documentType]}35`,
                                    }}
                                  >
                                    {labels[d.documentType]}
                                  </span>
                                ))
                              )}
                              {hasExpiredDoc && (
                                <span
                                  className="mwp-status-pill mwp-status-pill-expired"
                                  title="มีเอกสารหมดอายุแล้ว"
                                >
                                  🚨 หมดอายุ
                                </span>
                              )}
                              {hasDueDoc && (
                                <span
                                  className="mwp-status-pill mwp-status-pill-due"
                                  title="มีเอกสารใกล้ครบกำหนด 30 วัน"
                                >
                                  ⚠️ ใกล้ครบ
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ textAlign: "right" }}>
                            <div className="mwp-action-group">
                              <button
                                type="button"
                                className={`mwp-btn-action ${isExpanded ? "mwp-btn-action-primary" : ""}`}
                                onClick={() =>
                                  setExpandedWorkerId(isExpanded ? null : w.id)
                                }
                                title="ดูรายละเอียดเอกสาร"
                              >
                                {isExpanded ? (
                                  <>
                                    <span>ซ่อนเอกสาร</span>
                                    <ChevronUp size={14} />
                                  </>
                                ) : (
                                  <>
                                    <span>เอกสาร ({workerDocsList.length})</span>
                                    <ChevronDown size={14} />
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                className="mwp-btn-action"
                                onClick={() => openAddDocForWorker(w.id)}
                                title="เพิ่มเอกสารให้พนักงานคนนี้"
                              >
                                <Plus size={14} />
                                <span>เพิ่มเอกสาร</span>
                              </button>

                              <button
                                type="button"
                                className="mwp-btn-action"
                                onClick={() => {
                                  setWorkerForm({ ...w });
                                  setIncludeDocs(false);
                                  setWorkerOpen(true);
                                }}
                                title="แก้ไขข้อมูลส่วนตัว"
                              >
                                <Edit3 size={14} />
                                <span>แก้ไข</span>
                              </button>

                              <button
                                type="button"
                                className="mwp-btn-action mwp-btn-action-danger"
                                onClick={() =>
                                  setDeleteTarget({
                                    id: w.id,
                                    name: [w.title, w.fullName].filter(Boolean).join(" "),
                                    code: w.employeeCode,
                                  })
                                }
                                title="ลบข้อมูลพนักงาน"
                              >
                                <Trash2 size={14} />
                                <span>ลบ</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Document Drawer Row */}
                        {isExpanded && (
                          <tr key={`${w.id}-expanded`} className="mwp-expand-row">
                            <td colSpan={6}>
                              <div className="mwp-expand-container">
                                <div className="mwp-expand-header">
                                  <div className="mwp-expand-title">
                                    <FileText size={16} color="#175cd3" />
                                    <span>
                                      เอกสารประจำตัวของ: <b>{w.fullName}</b>
                                      {w.phone && (
                                        <span style={{ marginLeft: "6px", color: "var(--text-muted, #64748b)", fontWeight: 500 }}>
                                          (📞 {w.phone})
                                        </span>
                                      )}{" "}
                                      ({workerDocsList.length} ฉบับ)
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className="mwp-btn-action mwp-btn-action-primary"
                                    onClick={() => openAddDocForWorker(w.id)}
                                  >
                                    <Plus size={14} />
                                    <span>เพิ่มเอกสารฉบับใหม่</span>
                                  </button>
                                </div>

                                {workerDocsList.length === 0 ? (
                                  <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                                    พนักงานคนนี้ยังไม่มีเอกสารในระบบ กดปุ่ม "เพิ่มเอกสารฉบับใหม่" ด้านบนเพื่อเพิ่มข้อมูล
                                  </div>
                                ) : (
                                  workerDocsList.map((doc) => {
                                    const passportExpDays = doc.expiresOn ? daysUntil(doc.expiresOn) : null;
                                    const visaExpDays = doc.visaExpiresOn ? daysUntil(doc.visaExpiresOn) : null;
                                    const workPermitExpDays = doc.workPermitExpiresOn ? daysUntil(doc.workPermitExpiresOn) : null;

                                    return (
                                      <div key={doc.id} className="mwp-doc-mini-card">
                                        <div className="mwp-doc-mini-left">
                                          <span
                                            className="mwp-doc-pill"
                                            style={{
                                              background: `${DOC_COLORS[doc.documentType]}15`,
                                              color: DOC_COLORS[doc.documentType],
                                              border: `1px solid ${DOC_COLORS[doc.documentType]}40`,
                                              fontWeight: 700,
                                            }}
                                          >
                                            {labels[doc.documentType]}
                                          </span>
                                          <div>
                                            <div style={{ fontWeight: 700, color: "#0f172a" }}>
                                              เลขที่: {doc.documentNumber || "-"}
                                            </div>
                                            {doc.workPermitNumber && (
                                              <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                                                ใบอนุญาตทำงาน: {doc.workPermitNumber}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="mwp-doc-mini-dates">
                                          {doc.expiresOn && (
                                            <div>
                                              <span style={{ color: "#64748b", fontSize: "0.72rem" }}>
                                                {doc.documentType.includes("PASSPORT") ? "หมดอายุพาสปอร์ต:" : "หมดอายุบัตร:"}
                                              </span>
                                              <div style={{ fontWeight: 600 }}>{thaiDate(doc.expiresOn)}</div>
                                              {passportExpDays !== null && (
                                                <span
                                                  className={`mwp-status-pill ${
                                                    passportExpDays < 0
                                                      ? "mwp-status-pill-expired"
                                                      : passportExpDays <= 30
                                                        ? "mwp-status-pill-due"
                                                        : "mwp-status-pill-normal"
                                                  }`}
                                                >
                                                  {passportExpDays < 0
                                                    ? `เกิน ${formatDays(Math.abs(passportExpDays))}`
                                                    : `อีก ${formatDays(passportExpDays)}`}
                                                </span>
                                              )}
                                            </div>
                                          )}

                                          {doc.visaExpiresOn && (
                                            <div>
                                              <span style={{ color: "#64748b", fontSize: "0.72rem" }}>หมดอายุวีซ่า:</span>
                                              <div style={{ fontWeight: 600 }}>{thaiDate(doc.visaExpiresOn)}</div>
                                              {visaExpDays !== null && (
                                                <span
                                                  className={`mwp-status-pill ${
                                                    visaExpDays < 0
                                                      ? "mwp-status-pill-expired"
                                                      : visaExpDays <= 30
                                                        ? "mwp-status-pill-due"
                                                        : "mwp-status-pill-normal"
                                                  }`}
                                                >
                                                  {visaExpDays < 0
                                                    ? `เกิน ${formatDays(Math.abs(visaExpDays))}`
                                                    : `อีก ${formatDays(visaExpDays)}`}
                                                </span>
                                              )}
                                            </div>
                                          )}

                                          {doc.workPermitExpiresOn && (
                                            <div>
                                              <span style={{ color: "#64748b", fontSize: "0.72rem" }}>หมดอายุ Work Permit:</span>
                                              <div style={{ fontWeight: 600 }}>{thaiDate(doc.workPermitExpiresOn)}</div>
                                              {workPermitExpDays !== null && (
                                                <span
                                                  className={`mwp-status-pill ${
                                                    workPermitExpDays < 0
                                                      ? "mwp-status-pill-expired"
                                                      : workPermitExpDays <= 30
                                                        ? "mwp-status-pill-due"
                                                        : "mwp-status-pill-normal"
                                                  }`}
                                                >
                                                  {workPermitExpDays < 0
                                                    ? `เกิน ${formatDays(Math.abs(workPermitExpDays))}`
                                                    : `อีก ${formatDays(workPermitExpDays)}`}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        <button
                                          type="button"
                                          className="mwp-btn-action"
                                          onClick={() => editDoc(doc)}
                                        >
                                          <Edit3 size={13} />
                                          <span>ต่ออายุ/แก้ไข</span>
                                        </button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: Expiry & Renewals Timeline Watchlist                */}
        {/* ============================================================ */}
        {viewMode === "expiry" && (
          <div className="mwp-table-wrap">
            <table className="mwp-table">
              <thead>
                <tr>
                  <th>พนักงาน</th>
                  <th>เพศ</th>
                  <th>แผนก</th>
                  <th>ประเภทเอกสาร</th>
                  <th>เลขที่</th>
                  <th>รายการที่ต้องต่ออายุ</th>
                  <th>วันครบกำหนด</th>
                  <th>ระยะเวลาคงเหลือ</th>
                  <th style={{ textAlign: "right" }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "40px" }}>
                      <RefreshCw size={22} className="spin" color="#175cd3" />
                      <div style={{ marginTop: "8px", color: "#64748b" }}>กำลังโหลดข้อมูลวันครบกำหนด...</div>
                    </td>
                  </tr>
                ) : filteredExpiryRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "40px" }}>
                      <div style={{ color: "#16a34a", fontWeight: 700, fontSize: "1rem" }}>
                        ✓ ไม่พบเอกสารในเงื่อนไขการแจ้งเตือนนี้
                      </div>
                      <div style={{ color: "#64748b", fontSize: "0.82rem", marginTop: "4px" }}>
                        ไม่มีรายการที่ต้องเฝ้าระวังหรือตรงกับตัวกรองที่เลือก
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredExpiryRows.map((row) => {
                    const worker = workerMap.get(row.doc.workerId);
                    if (!worker) return null;
                    const initial = worker.fullName.trim() ? worker.fullName.trim()[0] : "W";
                    const isExp = row.days < 0;
                    const isDue30 = row.days >= 0 && row.days <= 30;
                    const isDue90 = row.days > 30 && row.days <= 90;
                    const gender = getWorkerGender(worker);

                    let statusClass = "mwp-status-pill-normal";
                    let statusText = `อีก ${formatDays(row.days)}`;
                    if (isExp) {
                      statusClass = "mwp-status-pill-expired";
                      statusText = `เกิน ${formatDays(Math.abs(row.days))}`;
                    } else if (row.days === 0) {
                      statusClass = "mwp-status-pill-due";
                      statusText = "ครบกำหนดวันนี้!";
                    } else if (isDue30) {
                      statusClass = "mwp-status-pill-due";
                      statusText = `อีก ${formatDays(row.days)}`;
                    } else if (isDue90) {
                      statusClass = "mwp-status-pill-caution";
                      statusText = `อีก ${formatDays(row.days)}`;
                    }

                    return (
                      <tr
                        key={`${row.doc.id}-${row.field}`}
                        className={isExp ? "mdb-row-expired-highlight" : ""}
                      >
                        <td>
                          <div className="mwp-worker-cell">
                            <div className="mwp-avatar">{initial}</div>
                            <div className="mwp-worker-info">
                              <span className="mwp-worker-name">{worker.fullName}</span>
                              <span className="mwp-worker-meta">
                                <span>รหัส: {worker.employeeCode}</span>
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {gender === "MALE" ? (
                            <span className="mwp-gender-badge mwp-gender-male">👨 ชาย</span>
                          ) : gender === "FEMALE" ? (
                            <span className="mwp-gender-badge mwp-gender-female">👩 หญิง</span>
                          ) : (
                            <span className="mwp-gender-badge mwp-gender-unknown">-</span>
                          )}
                        </td>

                        <td>
                          <span className="mwp-dept-badge">{worker.department || "-"}</span>
                        </td>

                        <td>
                          <span
                            className="mwp-doc-pill"
                            style={{
                              background: `${DOC_COLORS[row.doc.documentType]}12`,
                              color: DOC_COLORS[row.doc.documentType],
                              border: `1px solid ${DOC_COLORS[row.doc.documentType]}35`,
                              fontWeight: 700,
                            }}
                          >
                            {labels[row.doc.documentType]}
                          </span>
                        </td>

                        <td className="mono" style={{ fontSize: "0.85rem" }}>
                          {row.field === "วันหมดอายุใบอนุญาตทำงาน"
                            ? row.doc.workPermitNumber || "-"
                            : row.doc.documentNumber || "-"}
                        </td>

                        <td>
                          <span style={{ fontWeight: 600, color: "#334155" }}>{row.field}</span>
                        </td>

                        <td>
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>{thaiDate(row.date)}</span>
                        </td>

                        <td>
                          <span className={`mwp-status-pill ${statusClass}`}>{statusText}</span>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="mwp-btn-action"
                            onClick={() => editDoc(row.doc)}
                            title="ต่ออายุหรือแก้ไขเอกสารนี้"
                          >
                            <Edit3 size={13} />
                            <span>ต่ออายุ/แก้ไข</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: All Documents Table                                */}
        {/* ============================================================ */}
        {viewMode === "documents" && (
          <div className="mwp-table-wrap">
            <table className="mwp-table">
              <thead>
                <tr>
                  <th>ประเภทเอกสาร</th>
                  <th>เลขที่เอกสาร</th>
                  <th>ผู้ถือครอง (พนักงาน)</th>
                  <th>เพศ</th>
                  <th>แผนก</th>
                  <th>วันออกเอกสาร</th>
                  <th>วันหมดอายุเอกสาร</th>
                  <th>Work Permit</th>
                  <th>วันหมดอายุ Work Permit</th>
                  <th style={{ textAlign: "right" }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "40px" }}>
                      <RefreshCw size={22} className="spin" color="#175cd3" />
                      <div style={{ marginTop: "8px", color: "#64748b" }}>กำลังโหลดเอกสาร...</div>
                    </td>
                  </tr>
                ) : filteredAllDocs.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "40px" }}>
                      <div style={{ color: "#64748b", fontWeight: 600 }}>ไม่พบเอกสารตามเงื่อนไขที่ค้นหา</div>
                    </td>
                  </tr>
                ) : (
                  filteredAllDocs.map((doc) => {
                    const worker = workerMap.get(doc.workerId);
                    const daysLeft = doc.expiresOn ? daysUntil(doc.expiresOn) : null;
                    const gender = worker ? getWorkerGender(worker) : "UNKNOWN";

                    return (
                      <tr key={doc.id}>
                        <td>
                          <span
                            className="mwp-doc-pill"
                            style={{
                              background: `${DOC_COLORS[doc.documentType]}12`,
                              color: DOC_COLORS[doc.documentType],
                              border: `1px solid ${DOC_COLORS[doc.documentType]}35`,
                              fontWeight: 700,
                            }}
                          >
                            {labels[doc.documentType]}
                          </span>
                        </td>

                        <td className="mono" style={{ fontWeight: 700 }}>
                          {doc.documentNumber || "-"}
                        </td>

                        <td>
                          <b>{worker?.fullName ?? "-"}</b>
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            รหัส: {worker?.employeeCode ?? "-"}
                          </div>
                        </td>

                        <td>
                          {gender === "MALE" ? (
                            <span className="mwp-gender-badge mwp-gender-male">👨 ชาย</span>
                          ) : gender === "FEMALE" ? (
                            <span className="mwp-gender-badge mwp-gender-female">👩 หญิง</span>
                          ) : (
                            <span className="mwp-gender-badge mwp-gender-unknown">-</span>
                          )}
                        </td>

                        <td>
                          <span className="mwp-dept-badge">{worker?.department || "-"}</span>
                        </td>

                        <td>{doc.issuedOn ? thaiDate(doc.issuedOn) : "-"}</td>

                        <td>
                          {doc.expiresOn ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>{thaiDate(doc.expiresOn)}</div>
                              {daysLeft !== null && (
                                <span
                                  className={`mwp-status-pill ${
                                    daysLeft < 0
                                      ? "mwp-status-pill-expired"
                                      : daysLeft <= 30
                                        ? "mwp-status-pill-due"
                                        : "mwp-status-pill-normal"
                                  }`}
                                  style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                                >
                                  {daysLeft < 0
                                    ? `เกิน ${formatDays(Math.abs(daysLeft))}`
                                    : `อีก ${formatDays(daysLeft)}`}
                                </span>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td className="mono">{doc.workPermitNumber || "-"}</td>

                        <td>{doc.workPermitExpiresOn ? thaiDate(doc.workPermitExpiresOn) : "-"}</td>

                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="mwp-btn-action"
                            onClick={() => editDoc(doc)}
                            title="แก้ไขเอกสาร"
                          >
                            <Edit3 size={13} />
                            <span>แก้ไข</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Worker Modal (Add / Edit Worker + Initial Documents)         */}
      {/* ============================================================ */}
      {workerOpen && (
        <Modal
          title={workerForm.id ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่และเอกสาร"}
          onClose={() => setWorkerOpen(false)}
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
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t} {t === "นาย" || t === "MR." ? "(ชาย)" : "(หญิง)"}
                      </option>
                    ))}
                    {workerForm.title && !TITLES.includes(workerForm.title) && (
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
                    placeholder="เลขประจำตัว 13 หลัก หรือเลขบัตรชมพู"
                  />
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
                              {isPassport ? "วันออกเล่มพาสปอร์ต" : "วันออกบัตร"}
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
                              {isPassport ? "วันหมดอายุเล่มพาสปอร์ต *" : "วันหมดอายุบัตร *"}
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
                                        visaExpiresOn: e.target.value || null,
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
                                        areaPermitIssuedOn: e.target.value || null,
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
                                        areaPermitExpiresOn: e.target.value || null,
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
            {workerForm.id && (
              <button
                type="button"
                className="btn danger"
                style={{ marginRight: "auto" }}
                onClick={() => {
                  setDeleteTarget({
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
            <button className="btn secondary" onClick={() => setWorkerOpen(false)}>
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

      {/* ============================================================ */}
      {/* Document Modal (Add / Edit Document)                         */}
      {/* ============================================================ */}
      {docOpen && (
        <Modal
          title={docForm.id ? "ต่ออายุหรือแก้ไขเอกสาร" : "เพิ่มเอกสารใหม่"}
          onClose={() => setDocOpen(false)}
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
                ? "วันออกเล่มพาสปอร์ต"
                : "วันออกบัตร",
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
                {renderDateField("areaPermitIssuedOn", "วันออกใบออกนอกพื้นที่ *")}
                {renderDateField("areaPermitExpiresOn", "วันหมดอายุใบออกนอกพื้นที่ *")}
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

      {/* ============================================================ */}
      {/* Import Modal                                                 */}
      {/* ============================================================ */}
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
                type="button"
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
              type="button"
            >
              ปิด
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={
                importing ||
                importDone ||
                !importRows.filter((r) => r.errors.length === 0).length
              }
              onClick={() => void runImport()}
            >
              {importing
                ? "กำลังนำเข้า..."
                : `นำเข้า ${importRows.filter((r) => r.errors.length === 0).length} แถว`}
            </button>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* PRINT-ONLY REPORT SHEET (A4 Landscape Formatted Report)   */}
      {/* ======================================================== */}
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
                <div className="mwp-print-dept">ฝ่ายบริหารทรัพยากรบุคคลและเอกสารแรงงานต่างด้าว (HR & Migrant Worker Management)</div>
              </div>
            </div>
            <div className="mwp-print-date">
              <div>วันที่พิมพ์รายงาน: {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}</div>
              <div>เวลา: {new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</div>
            </div>
          </div>
          <h2 className="mwp-print-title">
            {viewMode === "expiry" && "📋 รายงานติดตามวันหมดอายุเอกสารแรงงานต่างด้าว (Expiration & Renewal Watchlist)"}
            {viewMode === "workers" && "📋 รายงานประวัติพนักงานและสถานะเอกสารแรงงานต่างด้าว (Foreign Worker Directory)"}
            {viewMode === "documents" && "📋 ทะเบียนเอกสารแรงงานต่างด้าวทั้งหมด (Migrant Worker Document Registry)"}
          </h2>
        </header>

        {/* Filter Criteria & Count Summary Bar */}
        <div className="mwp-print-meta-grid">
          <div className="mwp-print-criteria-list">
            <div className="mwp-print-criterion">
              <span className="mwp-print-criterion-label">แผนก:</span>
              <span className="mwp-print-criterion-val">{deptFilter === "all" ? "ทุกแผนก" : `แผนก ${deptFilter}`}</span>
            </div>
            <div className="mwp-print-criterion">
              <span className="mwp-print-criterion-label">เพศ:</span>
              <span className="mwp-print-criterion-val">{genderFilter === "all" ? "ทุกเพศ" : genderFilter === "MALE" ? "ชาย" : "หญิง"}</span>
            </div>
            <div className="mwp-print-criterion">
              <span className="mwp-print-criterion-label">ประเภทเอกสาร:</span>
              <span className="mwp-print-criterion-val">{docTypeFilter === "all" ? "ทุกประเภท" : labels[docTypeFilter as MigrantDocumentType] || docTypeFilter}</span>
            </div>
            {viewMode === "expiry" && (
              <div className="mwp-print-criterion">
                <span className="mwp-print-criterion-label">สถานะวันครบกำหนด:</span>
                <span className="mwp-print-criterion-val">
                  {expirySubFilter === "all" && "ทั้งหมด"}
                  {expirySubFilter === "expired" && "หมดอายุแล้ว"}
                  {expirySubFilter === "due" && "ใกล้ครบกำหนด (≤ 30 วัน)"}
                  {expirySubFilter === "caution" && "เตือนล่วงหน้า (31-90 วัน)"}
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
                รวม {filteredWorkers.length} คน (ชาย {filteredWorkers.filter((w) => getWorkerGender(w) === "MALE").length} คน / หญิง {filteredWorkers.filter((w) => getWorkerGender(w) === "FEMALE").length} คน)
              </>
            )}
            {viewMode === "expiry" && (
              <>
                รวม {filteredExpiryRows.length} รายการ ({(() => {
                  const ws = new Set(filteredExpiryRows.map((r) => r.doc.workerId));
                  return `พนักงาน ${ws.size} คน`;
                })()})
              </>
            )}
            {viewMode === "documents" && (
              <>
                รวม {filteredAllDocs.length} ฉบับ
              </>
            )}
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
                  <td colSpan={11} style={{ textAlign: "center", padding: "16px" }}>
                    ไม่พบรายการเอกสารที่ตรงตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredExpiryRows.map((row, idx) => {
                  const worker = workerMap.get(row.doc.workerId);
                  const gender = worker ? getWorkerGender(worker) : "UNKNOWN";
                  return (
                    <tr
                      key={`print-exp-${row.doc.id}-${row.field}-${idx}`}
                      className={row.days < 0 ? "print-row-expired" : row.days <= 30 ? "print-row-due" : ""}
                    >
                      <td style={{ textAlign: "center" }}>{idx + 1}</td>
                      <td><b>{worker?.employeeCode || "-"}</b></td>
                      <td>{worker?.fullName || "-"}</td>
                      <td style={{ textAlign: "center" }}>{gender === "MALE" ? "ชาย" : gender === "FEMALE" ? "หญิง" : "-"}</td>
                      <td>{worker?.nationality || "-"}</td>
                      <td>{worker?.department || "-"}</td>
                      <td><b>{row.field}</b></td>
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
                        ) : row.days <= 30 ? (
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
                <th style={{ width: "75px" }}>รหัส</th>
                <th>ชื่อ-นามสกุล</th>
                <th style={{ width: "45px", textAlign: "center" }}>เพศ</th>
                <th style={{ width: "55px" }}>สัญชาติ</th>
                <th style={{ width: "65px" }}>แผนก</th>
                <th>เอกสารประจำตัว (เลขที่)</th>
                <th style={{ width: "85px", textAlign: "center" }}>วันหมดอายุเล่ม</th>
                <th style={{ width: "85px", textAlign: "center" }}>วันหมดอายุวีซ่า</th>
                <th>เลขที่ใบอนุญาตทำงาน</th>
                <th style={{ width: "85px", textAlign: "center" }}>วันหมดอายุใบงาน</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: "16px" }}>
                    ไม่พบรายชื่อพนักงานที่ตรงตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((w, idx) => {
                  const docs = documents.filter((d) => d.workerId === w.id && d.isActive);
                  const primaryDoc = docs[0];
                  const gender = getWorkerGender(w);
                  return (
                    <tr key={`print-w-${w.id}`}>
                      <td style={{ textAlign: "center" }}>{idx + 1}</td>
                      <td><b>{w.employeeCode}</b></td>
                      <td>
                        {w.fullName}
                        {w.phone ? (
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>
                            โทร: {w.phone}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ textAlign: "center" }}>{gender === "MALE" ? "ชาย" : gender === "FEMALE" ? "หญิง" : "-"}</td>
                      <td>{w.nationality || "-"}</td>
                      <td>{w.department}</td>
                      <td>{primaryDoc ? `${labels[primaryDoc.documentType] || primaryDoc.documentType} (${primaryDoc.documentNumber})` : "ไม่มีเอกสาร"}</td>
                      <td style={{ textAlign: "center" }}>{primaryDoc?.expiresOn ? thaiDate(primaryDoc.expiresOn) : "-"}</td>
                      <td style={{ textAlign: "center" }}>{primaryDoc?.visaExpiresOn ? thaiDate(primaryDoc.visaExpiresOn) : "-"}</td>
                      <td>{primaryDoc?.workPermitNumber || "-"}</td>
                      <td style={{ textAlign: "center" }}>{primaryDoc?.workPermitExpiresOn ? thaiDate(primaryDoc.workPermitExpiresOn) : "-"}</td>
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
                  <td colSpan={11} style={{ textAlign: "center", padding: "16px" }}>
                    ไม่พบเอกสารที่ตรงตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredAllDocs.map((doc, idx) => {
                  const worker = workerMap.get(doc.workerId);
                  const gender = worker ? getWorkerGender(worker) : "UNKNOWN";
                  return (
                    <tr key={`print-doc-${doc.id}`}>
                      <td style={{ textAlign: "center" }}>{idx + 1}</td>
                      <td><b>{worker?.employeeCode || "-"}</b></td>
                      <td>{worker?.fullName || "-"}</td>
                      <td style={{ textAlign: "center" }}>{gender === "MALE" ? "ชาย" : gender === "FEMALE" ? "หญิง" : "-"}</td>
                      <td>{worker?.department || "-"}</td>
                      <td>{labels[doc.documentType] || doc.documentType}</td>
                      <td>{doc.documentNumber}</td>
                      <td style={{ textAlign: "center" }}>{doc.expiresOn ? thaiDate(doc.expiresOn) : "-"}</td>
                      <td style={{ textAlign: "center" }}>{doc.visaExpiresOn ? thaiDate(doc.visaExpiresOn) : "-"}</td>
                      <td>{doc.workPermitNumber || "-"}</td>
                      <td style={{ textAlign: "center" }}>{doc.workPermitExpiresOn ? thaiDate(doc.workPermitExpiresOn) : "-"}</td>
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
            <div className="mwp-print-sign-line">ลงชื่อ ................................................................</div>
            <div className="mwp-print-sign-name">( ................................................................ )</div>
            <div className="mwp-print-sign-role">ผู้จัดทำรายงาน / เจ้าหน้าที่ต่อสัญญาเอกสาร</div>
            <div className="mwp-print-sign-date">วันที่ ........ / ........ / ................</div>
          </div>
          <div className="mwp-print-sign-box">
            <div className="mwp-print-sign-line">ลงชื่อ ................................................................</div>
            <div className="mwp-print-sign-name">( ................................................................ )</div>
            <div className="mwp-print-sign-role">ผู้ตรวจสอบรายงาน / ผู้จัดการฝ่ายทรัพยากรบุคคล</div>
            <div className="mwp-print-sign-date">วันที่ ........ / ........ / ................</div>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <Confirm
          title="ยืนยันการลบข้อมูลพนักงาน"
          detail={`คุณต้องการลบข้อมูลพนักงาน "${deleteTarget.name}" (รหัส: ${deleteTarget.code}) ใช่หรือไม่?\n\nคำเตือน: ข้อมูลเอกสารและประวัติทั้งหมดที่ผูกกับพนักงานคนนี้จะถูกลบออกจากระบบด้วย และไม่สามารถกู้คืนได้`}
          confirmLabel={saving ? "กำลังลบ..." : "ลบข้อมูลพนักงาน"}
          cancelLabel="ยกเลิก"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            void handleDeleteWorker();
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
