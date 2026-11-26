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
  Rows3,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MigrantDocHistoryModal } from "../components/migrant/MigrantDocHistoryModal";
import { MigrantDocumentFormModal } from "../components/migrant/MigrantDocumentFormModal";
import { MigrantImportModal } from "../components/migrant/MigrantImportModal";
import { MigrantPrintSheet } from "../components/migrant/MigrantPrintSheet";
import { MigrantWorkerFormModal } from "../components/migrant/MigrantWorkerFormModal";
import { Confirm, TableSkeleton, Toast } from "../components/ui";
import {
  migrantWorkerService,
  getWorkerGender,
  getWorkerAge,
  validateMigrantDocument,
  type ForeignWorker,
  type MigrantDocumentHistory,
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

/** Compare employee codes in ascending natural numeric order. */
function compareEmployeeCode(a?: string | null, b?: string | null): number {
  return (a ?? "").trim().localeCompare((b ?? "").trim(), undefined, {
    numeric: true,
    sensitivity: "base",
  });
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

const getExpiryStatusClass = (days: number, remind: number) =>
  days < 0 ? "mwp-status-pill-expired" : days <= remind ? "mwp-status-pill-due" : "mwp-status-pill-normal";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [workers, setWorkers] = useState<ForeignWorker[]>([]);
  const [documents, setDocuments] = useState<MigrantWorkerDocument[]>([]);
  const [history, setHistory] = useState<MigrantDocumentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Navigation & View tabs
  const [viewMode, setViewMode] = useState<"workers" | "expiry" | "documents">("workers");
  const [expirySubFilter, setExpirySubFilter] = useState<"all" | "expired" | "due" | "caution" | "safe">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [tableDensity, setTableDensity] = useState<"comfortable" | "compact">(() => {
    try {
      return localStorage.getItem("office_table_density") === "compact"
        ? "compact"
        : "comfortable";
    } catch {
      return "comfortable";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("office_table_density", tableDensity);
    } catch {
      // Ignore storage errors in private mode
    }
  }, [tableDensity]);

  // Filter toolbar
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
  const [deleteDocTarget, setDeleteDocTarget] = useState<{
    id: string;
    docNumber: string;
    docTypeLabel: string;
    workerName: string;
  } | null>(null);
  const [historyDoc, setHistoryDoc] = useState<MigrantWorkerDocument | null>(null);

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [importDone, setImportDone] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateDocRow = (id: string, updates: Partial<InitialDocItem>) => {
    setWorkerDocs(
      workerDocs.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    );
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = async (force = false) => {
    setLoading(true);
    try {
      const data = await migrantWorkerService.load(force);
      setWorkers(data.workers);
      setDocuments(data.documents);
      setHistory(data.history);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
  }, []);

  // Keyboard shortcut: press '/' outside inputs to focus page search box
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Support deep-link navigation from MigrantDashboardPage (?worker=...&doc=...)
  useEffect(() => {
    if (loading) return;
    const workerCode = searchParams.get("worker");
    const docId = searchParams.get("doc");
    if (!workerCode && !docId) return;

    if (workerCode) {
      setViewMode("workers");
      setSearchQuery(workerCode);
      const matchedWorker = workers.find(
        (w) => w.employeeCode.toLowerCase() === workerCode.toLowerCase(),
      );
      if (matchedWorker) {
        setExpandedWorkerId(matchedWorker.id);
      }
    }
    if (docId) {
      const matchedDoc = documents.find((d) => d.id === docId);
      if (matchedDoc) {
        editDoc(matchedDoc);
      }
    }
    setSearchParams({}, { replace: true });
  }, [loading, workers, documents, searchParams, setSearchParams]);

  const workerMap = useMemo(
    () => new Map(workers.map((w) => [w.id, w])),
    [workers],
  );

  const activeDocsByWorkerId = useMemo(() => {
    const map = new Map<string, MigrantWorkerDocument[]>();
    for (const d of documents) {
      if (!d.isActive) continue;
      const list = map.get(d.workerId);
      if (list) list.push(d);
      else map.set(d.workerId, [d]);
    }
    return map;
  }, [documents]);

  // Expiry calculation across all active documents of active workers
  const expiryRows = useMemo(() => {
    return documents
      .filter((d) => d.isActive && Boolean(workerMap.get(d.workerId)?.isActive))
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
      .sort(
        (a, b) =>
          a.days - b.days ||
          compareEmployeeCode(
            workerMap.get(a.doc.workerId)?.employeeCode,
            workerMap.get(b.doc.workerId)?.employeeCode,
          ),
      );
  }, [documents, workerMap]);

  // Overall counts for summary
  const totalActiveWorkers = useMemo(() => workers.filter((w) => w.isActive).length, [workers]);
  const totalActiveDocs = useMemo(
    () => documents.filter((d) => d.isActive && Boolean(workerMap.get(d.workerId)?.isActive)).length,
    [documents, workerMap],
  );
  const expiredCount = useMemo(() => expiryRows.filter((r) => r.days < 0).length, [expiryRows]);
  const dueCount = useMemo(
    () => expiryRows.filter((r) => r.days >= 0 && r.days <= (r.doc.remindDays ?? 30)).length,
    [expiryRows],
  );
  const cautionCount = useMemo(
    () =>
      expiryRows.filter((r) => {
        const remind = r.doc.remindDays ?? 30;
        return r.days > remind && r.days <= Math.max(90, remind);
      }).length,
    [expiryRows],
  );
  const safeCount = useMemo(
    () => expiryRows.filter((r) => r.days > Math.max(90, r.doc.remindDays ?? 30)).length,
    [expiryRows],
  );

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
    return workers
      .filter((w) => {
        if (deptFilter !== "all" && w.department !== deptFilter) return false;
        if (genderFilter !== "all" && getWorkerGender(w) !== genderFilter) return false;
        const wDocs = activeDocsByWorkerId.get(w.id) ?? [];
        if (docTypeFilter !== "all") {
          if (!wDocs.some((d) => d.documentType === docTypeFilter)) return false;
        }
        if (deferredSearchQuery.trim()) {
          const q = deferredSearchQuery.toLowerCase().trim();
          const matchDoc = wDocs.some(
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
      })
      .sort((a, b) => compareEmployeeCode(a.employeeCode, b.employeeCode));
  }, [workers, activeDocsByWorkerId, deptFilter, genderFilter, docTypeFilter, deferredSearchQuery]);

  // Filtered Expiry Rows
  const filteredExpiryRows = useMemo(() => {
    return expiryRows.filter((row) => {
      const worker = workerMap.get(row.doc.workerId);
      if (!worker) return false;

      const remind = row.doc.remindDays ?? 30;
      if (expirySubFilter === "expired" && row.days >= 0) return false;
      if (expirySubFilter === "due" && (row.days < 0 || row.days > remind)) return false;
      if (expirySubFilter === "caution" && (row.days <= remind || row.days > Math.max(90, remind))) return false;
      if (expirySubFilter === "safe" && row.days <= Math.max(90, remind)) return false;

      if (deptFilter !== "all" && worker.department !== deptFilter) return false;
      if (genderFilter !== "all" && getWorkerGender(worker) !== genderFilter) return false;
      if (docTypeFilter !== "all" && row.doc.documentType !== docTypeFilter) return false;

      if (deferredSearchQuery.trim()) {
        const q = deferredSearchQuery.toLowerCase().trim();
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
  }, [expiryRows, workerMap, expirySubFilter, deptFilter, genderFilter, docTypeFilter, deferredSearchQuery]);

  // Filtered All Documents list
  const filteredAllDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        const worker = workerMap.get(doc.workerId);
        if (!worker) return false;

        if (deptFilter !== "all" && worker.department !== deptFilter) return false;
        if (genderFilter !== "all" && getWorkerGender(worker) !== genderFilter) return false;
        if (docTypeFilter !== "all" && doc.documentType !== docTypeFilter) return false;

        if (deferredSearchQuery.trim()) {
          const q = deferredSearchQuery.toLowerCase().trim();
          const match =
            worker.fullName.toLowerCase().includes(q) ||
            worker.employeeCode.toLowerCase().includes(q) ||
            worker.department.toLowerCase().includes(q) ||
            doc.documentNumber.toLowerCase().includes(q) ||
            doc.workPermitNumber.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) =>
        compareEmployeeCode(
          workerMap.get(a.workerId)?.employeeCode,
          workerMap.get(b.workerId)?.employeeCode,
        ),
      );
  }, [documents, workerMap, deptFilter, genderFilter, docTypeFilter, deferredSearchQuery]);

  useEffect(() => {
    setPage(1);
  }, [viewMode, expirySubFilter, searchQuery, deptFilter, genderFilter, docTypeFilter, pageSize]);

  const activeListLength =
    viewMode === "workers"
      ? filteredWorkers.length
      : viewMode === "expiry"
        ? filteredExpiryRows.length
        : filteredAllDocs.length;
  const totalPages = Math.max(1, Math.ceil(activeListLength / pageSize));
  const pagedWorkers = useMemo(
    () => filteredWorkers.slice((page - 1) * pageSize, page * pageSize),
    [filteredWorkers, page, pageSize],
  );
  const pagedExpiryRows = useMemo(
    () => filteredExpiryRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredExpiryRows, page, pageSize],
  );
  const pagedAllDocs = useMemo(
    () => filteredAllDocs.slice((page - 1) * pageSize, page * pageSize),
    [filteredAllDocs, page, pageSize],
  );

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

    const cleanNationalId = (workerForm.nationalId || "").replace(/\D/g, "");
    if (!cleanNationalId) {
      setToast("กรุณากรอกเลขประจำตัวประชาชน (13 หลัก)");
      return;
    }
    if (cleanNationalId.length !== 13) {
      setToast(
        `เลขประจำตัวประชาชนต้องครบ 13 หลักตามรูปแบบ (ขณะนี้กรอก ${cleanNationalId.length}/13 หลัก)`
      );
      return;
    }

    if (!workerForm.id && includeDocs && workerDocs.length > 0) {
      for (let i = 0; i < workerDocs.length; i++) {
        const d = workerDocs[i];
        const docErrors = validateMigrantDocument(d);
        if (docErrors.length > 0) {
          const docLabel = labels[d.documentType];
          setToast(`${docLabel}: ${docErrors[0]}`);
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
      await load(true);
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
      await load(true);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "ลบข้อมูลพนักงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteDocTarget) return;
    setSaving(true);
    try {
      await migrantWorkerService.deleteDocument(deleteDocTarget.id);
      setToast(
        `ลบเอกสาร "${deleteDocTarget.docTypeLabel} (${deleteDocTarget.docNumber})" เรียบร้อยแล้ว`,
      );
      setDeleteDocTarget(null);
      setDocOpen(false);
      await load(true);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "ลบเอกสารไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const saveDoc = async () => {
    if (!docForm.workerId) {
      setToast("กรุณาเลือกพนักงาน");
      return;
    }
    const docErrors = validateMigrantDocument(docForm);
    if (docErrors.length > 0) {
      setToast(docErrors[0]);
      return;
    }
    if (
      docForm.isActive &&
      documents.some(
        (d) => d.workerId === docForm.workerId && d.isActive && d.id !== docForm.id,
      )
    ) {
      setToast(
        "พนักงานคนนี้มีเอกสารหลักที่ใช้งานอยู่แล้ว 1 ฉบับ กรุณาแก้ไขเอกสารเดิม หรือปิดใช้งานเอกสารเดิมก่อนเพิ่มฉบับใหม่",
      );
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
      await load(true);
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
    setImportProgress({ done: 0, total: validRows.length });
    setImportErrors([]);
    let success = 0;
    let processed = 0;
    const errorsList: string[] = [];

    try {
      const existingWorkerByCode = new Map(workers.map((w) => [w.employeeCode, w]));
      const activeDocByWorkerId = new Map(
        documents.filter((d) => d.isActive).map((d) => [d.workerId, d]),
      );

      // Group rows by employeeCode so distinct employees can run in parallel batches safely
      const groupsMap = new Map<string, ImportRow[]>();
      for (const row of validRows) {
        const list = groupsMap.get(row.employeeCode);
        if (list) list.push(row);
        else groupsMap.set(row.employeeCode, [row]);
      }
      const employeeGroups = Array.from(groupsMap.values());
      const BATCH_SIZE = 5;

      for (let start = 0; start < employeeGroups.length; start += BATCH_SIZE) {
        const chunk = employeeGroups.slice(start, start + BATCH_SIZE);
        await Promise.all(
          chunk.map(async (group) => {
            for (const row of group) {
              try {
                const existingWorker = existingWorkerByCode.get(row.employeeCode);
                const saved = await migrantWorkerService.saveWorker({
                  id: existingWorker?.id ?? "",
                  employeeCode: row.employeeCode,
                  title: row.title || existingWorker?.title || "",
                  fullName: row.fullName || existingWorker?.fullName || "",
                  phone: row.phone || existingWorker?.phone || "",
                  nationality: row.nationality || existingWorker?.nationality || "",
                  department: row.department || existingWorker?.department || "",
                  organizationUnit: existingWorker?.organizationUnit ?? "",
                  nationalId: row.nationalId || existingWorker?.nationalId || "",
                  birthDate: row.birthDate ?? existingWorker?.birthDate ?? null,
                  position: existingWorker?.position ?? "",
                  note: existingWorker?.note ?? "",
                  isActive: existingWorker?.isActive ?? true,
                });
                const workerId = saved.id;
                existingWorkerByCode.set(row.employeeCode, saved);

                if (row.documentType) {
                  const existingDoc = activeDocByWorkerId.get(workerId);
                  const isPassport =
                    row.documentType === "PASSPORT_RED" || row.documentType === "PASSPORT_GREEN";
                  const isArea = row.documentType === "TEN_YEAR_CARD";
                  await migrantWorkerService.saveDocument({
                    id: existingDoc?.id ?? "",
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
              } finally {
                processed++;
                setImportProgress({ done: processed, total: validRows.length });
              }
            }
          }),
        );
      }

      setImportSuccessCount(success);
      setImportErrors(errorsList);
      setImportDone(true);
      if (errorsList.length === 0) {
        setToast(`นำเข้าข้อมูลสำเร็จทั้งหมด ${success} รายการ`);
      } else {
        setToast(`นำเข้าสำเร็จ ${success} รายการ, ผิดพลาด ${errorsList.length} รายการ`);
      }
      await load(true);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "การนำเข้าขัดข้อง");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

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
            onClick={() => void exportToExcel(workers, documents)}
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
            onClick={() => void load(true)}
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
            <span className="mwp-stat-title">จำนวนพนักงานทั้งหมด</span>
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
            <span className="mwp-stat-title">ใกล้ครบกำหนด</span>
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
            <span>ตามระยะแจ้งเตือนแต่ละฉบับ</span>
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
                ใกล้ครบกำหนด ({dueCount})
              </button>
              <button
                type="button"
                className={`mwp-sub-pill ${expirySubFilter === "caution" ? "active" : ""}`}
                onClick={() => setExpirySubFilter("caution")}
              >
                เฝ้าระวัง ≤ 90 วัน ({cautionCount})
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
              ref={searchInputRef}
              type="text"
              placeholder="ค้นหาชื่อ-สกุล, รหัสบุคลากร, แผนก, สัญชาติ หรือเลขที่เอกสาร... (กด / เพื่อค้นหา)"
              className="mwp-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchQuery("");
                  e.currentTarget.blur();
                }
              }}
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

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto", flexWrap: "wrap" }}>
            {(searchQuery.trim() !== "" ||
              deptFilter !== "all" ||
              genderFilter !== "all" ||
              docTypeFilter !== "all" ||
              expirySubFilter !== "all") && (
              <button
                type="button"
                className="mwp-clear-btn"
                onClick={() => {
                  setSearchQuery("");
                  setDeptFilter("all");
                  setGenderFilter("all");
                  setDocTypeFilter("all");
                  setExpirySubFilter("all");
                }}
              >
                <X size={14} />
                <span>ล้างตัวกรอง</span>
              </button>
            )}
            <span className="mwp-result-pill">
              {viewMode === "workers" && `แสดง ${filteredWorkers.length} คน`}
              {viewMode === "expiry" && `แสดง ${filteredExpiryRows.length} รายการ`}
              {viewMode === "documents" && `แสดง ${filteredAllDocs.length} ฉบับ`}
            </span>
            <button
              type="button"
              className={`mwp-density-btn${tableDensity === "compact" ? " is-active" : ""}`}
              onClick={() =>
                setTableDensity((prev) => (prev === "compact" ? "comfortable" : "compact"))
              }
              title="สลับความหนาแน่นของแถวตาราง (ปกติ / กะทัดรัด)"
            >
              <Rows3 size={14} />
              <span>{tableDensity === "compact" ? "มุมมอง: กะทัดรัด" : "มุมมอง: ปกติ"}</span>
            </button>
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
            <table className={`mwp-table${tableDensity === "compact" ? " is-compact" : ""}`}>
              <thead>
                <tr>
                  <th>พนักงาน</th>
                  <th>เพศ / อายุ</th>
                  <th>เลขบัตรประชาชน / ID</th>
                  <th>แผนก</th>
                  <th>เอกสารที่บันทึกไว้</th>
                  <th style={{ textAlign: "right" }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={6} columns={6} />
                ) : filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px" }}>
                      <div style={{ fontWeight: 600 }} className="mwp-muted-text">ไม่พบรายชื่อพนักงานที่ตรงกับเงื่อนไข</div>
                    </td>
                  </tr>
                ) : (
                  pagedWorkers.map((w) => {
                    const workerDocsList = activeDocsByWorkerId.get(w.id) ?? [];
                    const isExpanded = expandedWorkerId === w.id;
                    const initial = w.fullName.trim() ? w.fullName.trim()[0] : "W";
                    const gender = getWorkerGender(w);
                    const age = getWorkerAge(w.birthDate);

                    // Check all 4 expiry fields (including area permit) against document's remindDays
                    const getDocDates = (d: MigrantWorkerDocument) =>
                      [
                        d.expiresOn,
                        d.visaExpiresOn,
                        d.areaPermitExpiresOn,
                        d.workPermitExpiresOn,
                      ].filter((dt): dt is string => Boolean(dt));

                    const hasExpiredDoc = workerDocsList.some((d) =>
                      getDocDates(d).some((dt) => daysUntil(dt) < 0),
                    );
                    const hasDueDoc =
                      !hasExpiredDoc &&
                      workerDocsList.some((d) => {
                        const remind = d.remindDays ?? 30;
                        return getDocDates(d).some((dt) => daysUntil(dt) <= remind);
                      });

                    return (
                      <Fragment key={w.id}>
                        <tr className={isExpanded ? "mwp-row-expanded" : undefined}>
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
                            <div style={{ display: "inline-flex", flexDirection: "column", gap: "2px", alignItems: "flex-start" }}>
                              {gender === "MALE" ? (
                                <span className="mwp-gender-badge mwp-gender-male">👨 ชาย</span>
                              ) : gender === "FEMALE" ? (
                                <span className="mwp-gender-badge mwp-gender-female">👩 หญิง</span>
                              ) : (
                                <span className="mwp-gender-badge mwp-gender-unknown">-</span>
                              )}
                              {age !== null && (
                                <span style={{ fontSize: "0.78rem", color: "var(--text-muted, #64748b)", fontWeight: 600 }}>
                                  อายุ {age} ปี
                                </span>
                              )}
                            </div>
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
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
                              {workerDocsList.length === 0 ? (
                                <span style={{ fontSize: "0.82rem" }} className="mwp-muted-text">ไม่มีเอกสาร</span>
                              ) : (
                                workerDocsList.map((d) => (
                                  <div
                                    key={d.id}
                                    style={{
                                      display: "inline-flex",
                                      flexDirection: "column",
                                      gap: "3px",
                                      alignItems: "flex-start",
                                    }}
                                  >
                                    <span
                                      className="mono"
                                      style={{
                                        fontWeight: 700,
                                        fontSize: "0.84rem",
                                        color: "var(--text-primary, #0f172a)",
                                        lineHeight: 1.2,
                                      }}
                                    >
                                      {d.documentNumber || "-"}
                                    </span>
                                    <span
                                      className="mwp-doc-pill"
                                      style={{
                                        background: `${DOC_COLORS[d.documentType]}12`,
                                        color: DOC_COLORS[d.documentType],
                                        border: `1px solid ${DOC_COLORS[d.documentType]}35`,
                                        fontSize: "0.72rem",
                                        padding: "1px 6px",
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      {labels[d.documentType]}
                                    </span>
                                  </div>
                                ))
                              )}
                              {hasExpiredDoc && (
                                <span
                                  className="mwp-status-pill mwp-status-pill-expired"
                                  title="มีเอกสารหมดอายุแล้ว"
                                  style={{ alignSelf: "center" }}
                                >
                                  🚨 หมดอายุ
                                </span>
                              )}
                              {hasDueDoc && (
                                <span
                                  className="mwp-status-pill mwp-status-pill-due"
                                  style={{ alignSelf: "center" }}
                                  title="มีเอกสารใกล้ครบกำหนดตามระยะแจ้งเตือน"
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
                                    const remind = doc.remindDays ?? 30;
                                    const miniDateItems = [
                                      doc.expiresOn
                                        ? {
                                            label: doc.documentType.includes("PASSPORT")
                                              ? "หมดอายุพาสปอร์ต:"
                                              : "หมดอายุบัตร:",
                                            date: doc.expiresOn,
                                          }
                                        : null,
                                      doc.visaExpiresOn
                                        ? { label: "หมดอายุวีซ่า:", date: doc.visaExpiresOn }
                                        : null,
                                      doc.areaPermitExpiresOn
                                        ? {
                                            label: "หมดอายุใบออกนอกพื้นที่:",
                                            date: doc.areaPermitExpiresOn,
                                          }
                                        : null,
                                      doc.workPermitExpiresOn
                                        ? {
                                            label: "หมดอายุ Work Permit:",
                                            date: doc.workPermitExpiresOn,
                                          }
                                        : null,
                                    ].filter((item): item is { label: string; date: string } => item !== null);

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
                                            <div style={{ fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                                              เลขที่: {doc.documentNumber || "-"}
                                            </div>
                                            {doc.workPermitNumber && (
                                              <div style={{ fontSize: "0.78rem", color: "var(--text-muted, #64748b)" }}>
                                                ใบอนุญาตทำงาน: {doc.workPermitNumber}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="mwp-doc-mini-dates">
                                          {miniDateItems.map((item) => {
                                            const expDays = daysUntil(item.date);
                                            return (
                                              <div key={item.label}>
                                                <span style={{ color: "var(--text-muted, #64748b)", fontSize: "0.72rem" }}>
                                                  {item.label}
                                                </span>
                                                <div style={{ fontWeight: 600 }}>{thaiDate(item.date)}</div>
                                                <span className={`mwp-status-pill ${getExpiryStatusClass(expDays, remind)}`}>
                                                  {expDays < 0
                                                    ? `เกิน ${formatDays(Math.abs(expDays))}`
                                                    : `อีก ${formatDays(expDays)}`}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>

                                        <div className="mwp-action-group">
                                          <button
                                            type="button"
                                            className="mwp-btn-action"
                                            onClick={() => setHistoryDoc(doc)}
                                            title="ดูประวัติการต่ออายุและแก้ไข"
                                          >
                                            <Clock size={13} />
                                            <span>ประวัติ</span>
                                          </button>

                                          <button
                                            type="button"
                                            className="mwp-btn-action"
                                            onClick={() => editDoc(doc)}
                                          >
                                            <Edit3 size={13} />
                                            <span>ต่ออายุ/แก้ไข</span>
                                          </button>

                                          <button
                                            type="button"
                                            className="mwp-btn-action mwp-btn-action-danger"
                                            onClick={() =>
                                              setDeleteDocTarget({
                                                id: doc.id,
                                                docNumber: doc.documentNumber || "-",
                                                docTypeLabel: labels[doc.documentType],
                                                workerName: w.fullName,
                                              })
                                            }
                                            title="ลบเอกสารฉบับนี้"
                                          >
                                            <Trash2 size={13} />
                                            <span>ลบ</span>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
            <table className={`mwp-table${tableDensity === "compact" ? " is-compact" : ""}`}>
              <thead>
                <tr>
                  <th>พนักงาน</th>
                  <th>เพศ / อายุ</th>
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
                  <TableSkeleton rows={6} columns={9} />
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
                  pagedExpiryRows.map((row) => {
                    const worker = workerMap.get(row.doc.workerId);
                    if (!worker) return null;
                    const initial = worker.fullName.trim() ? worker.fullName.trim()[0] : "W";
                    const remind = row.doc.remindDays ?? 30;
                    const isExp = row.days < 0;
                    const isDue = row.days >= 0 && row.days <= remind;
                    const isCaution = row.days > remind && row.days <= Math.max(90, remind);
                    const gender = getWorkerGender(worker);
                    const workerAge = getWorkerAge(worker.birthDate);

                    let statusClass = "mwp-status-pill-normal";
                    let statusText = `อีก ${formatDays(row.days)}`;
                    if (isExp) {
                      statusClass = "mwp-status-pill-expired";
                      statusText = `เกิน ${formatDays(Math.abs(row.days))}`;
                    } else if (row.days === 0) {
                      statusClass = "mwp-status-pill-due";
                      statusText = "ครบกำหนดวันนี้!";
                    } else if (isDue) {
                      statusClass = "mwp-status-pill-due";
                      statusText = `อีก ${formatDays(row.days)}`;
                    } else if (isCaution) {
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
                          <div style={{ display: "inline-flex", flexDirection: "column", gap: "2px", alignItems: "flex-start" }}>
                            {gender === "MALE" ? (
                              <span className="mwp-gender-badge mwp-gender-male">👨 ชาย</span>
                            ) : gender === "FEMALE" ? (
                              <span className="mwp-gender-badge mwp-gender-female">👩 หญิง</span>
                            ) : (
                              <span className="mwp-gender-badge mwp-gender-unknown">-</span>
                            )}
                            {workerAge !== null && (
                              <span style={{ fontSize: "0.76rem", color: "var(--text-muted, #64748b)", fontWeight: 600 }}>
                                อายุ {workerAge} ปี
                              </span>
                            )}
                          </div>
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
                          <span style={{ fontWeight: 600, color: "var(--text-secondary, #334155)" }}>{row.field}</span>
                        </td>

                        <td>
                          <span style={{ fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>{thaiDate(row.date)}</span>
                        </td>

                        <td>
                          <span className={`mwp-status-pill ${statusClass}`}>{statusText}</span>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div className="mwp-action-group">
                            <button
                              type="button"
                              className="mwp-btn-action"
                              onClick={() => setHistoryDoc(row.doc)}
                              title="ดูประวัติการต่ออายุและแก้ไข"
                            >
                              <Clock size={13} />
                              <span>ประวัติ</span>
                            </button>
                            <button
                              type="button"
                              className="mwp-btn-action"
                              onClick={() => editDoc(row.doc)}
                              title="ต่ออายุหรือแก้ไขเอกสารนี้"
                            >
                              <Edit3 size={13} />
                              <span>ต่ออายุ/แก้ไข</span>
                            </button>
                          </div>
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
            <table className={`mwp-table${tableDensity === "compact" ? " is-compact" : ""}`}>
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
                  <TableSkeleton rows={6} columns={10} />
                ) : filteredAllDocs.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "40px" }}>
                      <div style={{ color: "#64748b", fontWeight: 600 }}>ไม่พบเอกสารตามเงื่อนไขที่ค้นหา</div>
                    </td>
                  </tr>
                ) : (
                  pagedAllDocs.map((doc) => {
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
                                  className={`mwp-status-pill ${getExpiryStatusClass(daysLeft, doc.remindDays ?? 30)}`}
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
                          <div className="mwp-action-group">
                            <button
                              type="button"
                              className="mwp-btn-action"
                              onClick={() => setHistoryDoc(doc)}
                              title="ดูประวัติการต่ออายุและแก้ไข"
                            >
                              <Clock size={13} />
                              <span>ประวัติ</span>
                            </button>
                            <button
                              type="button"
                              className="mwp-btn-action"
                              onClick={() => editDoc(doc)}
                              title="แก้ไขเอกสาร"
                            >
                              <Edit3 size={13} />
                              <span>แก้ไข</span>
                            </button>
                            <button
                              type="button"
                              className="mwp-btn-action mwp-btn-action-danger"
                              onClick={() =>
                                setDeleteDocTarget({
                                  id: doc.id,
                                  docNumber: doc.documentNumber || "-",
                                  docTypeLabel: labels[doc.documentType],
                                  workerName: worker?.fullName ?? "-",
                                })
                              }
                              title="ลบเอกสาร"
                            >
                              <Trash2 size={13} />
                              <span>ลบ</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && activeListLength > 0 && (
          <div className="pagination">
            <label className="page-size-control">
              แสดง
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              รายการ/หน้า
            </label>
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ก่อนหน้า
            </button>
            <span className="tabular-nums">
              หน้า {page} / {totalPages} ({activeListLength.toLocaleString("th-TH")} รายการ)
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              ถัดไป
            </button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Worker Modal (Add / Edit Worker + Initial Documents)         */}
      {/* ============================================================ */}
      {workerOpen && (
        <MigrantWorkerFormModal
          workerForm={workerForm}
          setWorkerForm={setWorkerForm}
          includeDocs={includeDocs}
          setIncludeDocs={setIncludeDocs}
          workerDocs={workerDocs}
          updateDocRow={updateDocRow}
          labels={labels}
          titles={TITLES}
          saving={saving}
          onClose={() => setWorkerOpen(false)}
          onSave={() => void saveWorker()}
          onRequestDelete={(target) => setDeleteTarget(target)}
        />
      )}

      {/* ============================================================ */}
      {/* Document Modal (Add / Edit Document)                         */}
      {/* ============================================================ */}
      {docOpen && (
        <MigrantDocumentFormModal
          docForm={docForm}
          setDocForm={setDocForm}
          workers={workers}
          workerMap={workerMap}
          documents={documents}
          labels={labels}
          saving={saving}
          onClose={() => setDocOpen(false)}
          onSave={() => void saveDoc()}
          onRequestDelete={(target) => setDeleteDocTarget(target)}
          onOpenHistory={(doc) => setHistoryDoc(doc)}
        />
      )}

      {/* ============================================================ */}
      {/* Import Modal                                                 */}
      {/* ============================================================ */}
      {importOpen && (
        <MigrantImportModal
          fileInputRef={fileInputRef}
          importRows={importRows}
          importing={importing}
          importProgress={importProgress}
          importDone={importDone}
          importSuccessCount={importSuccessCount}
          importErrors={importErrors}
          onClose={() => setImportOpen(false)}
          onDownloadTemplate={() => void downloadTemplate()}
          onImportFile={(e) => void handleImportFile(e)}
          onRunImport={() => void runImport()}
        />
      )}

      {/* ======================================================== */}
      {/* PRINT-ONLY REPORT SHEET (A4 Landscape Formatted Report)   */}
      {/* ======================================================== */}
      <MigrantPrintSheet
        viewMode={viewMode}
        deptFilter={deptFilter}
        genderFilter={genderFilter}
        docTypeFilter={docTypeFilter}
        expirySubFilter={expirySubFilter}
        searchQuery={searchQuery}
        filteredWorkers={filteredWorkers}
        filteredExpiryRows={filteredExpiryRows}
        filteredAllDocs={filteredAllDocs}
        documents={documents}
        workerMap={workerMap}
        labels={labels}
        thaiDate={thaiDate}
        formatDays={formatDays}
      />

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

      {deleteDocTarget && (
        <Confirm
          title="ยืนยันการลบเอกสาร"
          detail={`คุณต้องการลบเอกสาร "${deleteDocTarget.docTypeLabel} (เลขที่: ${deleteDocTarget.docNumber})" ของพนักงาน ${deleteDocTarget.workerName} ใช่หรือไม่?\n\nคำเตือน: ประวัติการต่ออายุของเอกสารฉบับนี้จะถูกลบออกด้วย และไม่สามารถกู้คืนได้`}
          confirmLabel={saving ? "กำลังลบ..." : "ลบเอกสาร"}
          cancelLabel="ยกเลิก"
          danger
          onCancel={() => setDeleteDocTarget(null)}
          onConfirm={() => {
            void handleDeleteDocument();
          }}
        />
      )}

      {historyDoc && (() => {
        const owner = workerMap.get(historyDoc.workerId);
        return (
          <MigrantDocHistoryModal
            doc={historyDoc}
            workerName={owner?.fullName ?? "-"}
            employeeCode={owner?.employeeCode ?? "-"}
            docLabel={labels[historyDoc.documentType]}
            history={history}
            onClose={() => setHistoryDoc(null)}
          />
        );
      })()}

      {toast && <Toast message={toast} />}
    </div>
  );
}
