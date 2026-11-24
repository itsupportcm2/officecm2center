import { DEPARTMENTS } from "../constants/departments";
import {
  formatNationalId,
  validateMigrantDocument,
  type ForeignWorker,
  type MigrantDocumentType,
  type MigrantWorkerDocument,
} from "../services/migrantWorkerService";

const loadXlsx = () => import("xlsx");

// ---- Column headers ----
export const EXPORT_HEADERS = [
  "รหัสพนักงาน",
  "คำนำหน้า",
  "ชื่อ-สกุล",
  "เบอร์โทรศัพท์",
  "สัญชาติ",
  "แผนก",
  "เลขบัตรประชาชน",
  "วันเกิด",
  "ประเภทเอกสาร",
  "เลขที่เอกสาร",
  "วันออกเอกสาร",
  "วันหมดอายุเอกสาร",
  "วันออกวีซ่า",
  "วันหมดอายุวีซ่า",
  "วันออกใบออกนอกพื้นที่",
  "วันหมดอายุใบออกนอกพื้นที่",
  "เลขที่ใบอนุญาตทำงาน",
  "วันออกใบอนุญาตทำงาน",
  "วันหมดอายุใบอนุญาตทำงาน",
  "แจ้งเตือนล่วงหน้า(วัน)",
  "หมายเหตุเอกสาร",
];

const DOC_TYPE_MAP: Record<MigrantDocumentType, string> = {
  PASSPORT_RED: "พาสปอร์ตสีแดง",
  PASSPORT_GREEN: "พาสปอร์ตสีเขียว",
  PINK_CARD: "บัตรชมพู",
  TEN_YEAR_CARD: "บัตร 10 ปี",
};

const DOC_TYPE_REVERSE: Record<string, MigrantDocumentType> = Object.fromEntries(
  Object.entries(DOC_TYPE_MAP).map(([k, v]) => [v, k as MigrantDocumentType])
);

// Thai aliases and shorthand to valid uppercase department codes
const DEPT_MAP: Record<string, string> = {
  "ฝ่ายผลิต": "PR", "ผลิต": "PR", "production": "PR", "pr": "PR",
  "ฝ่ายแพ็ค": "PA", "แพ็ค": "PA", "บรรจุ": "PA", "packing": "PA", "pa": "PA",
  "บุคคล": "HR", "ฝ่ายบุคคล": "HR", "hr": "HR",
  "ไอที": "IT", "สารสนเทศ": "IT", "it": "IT",
  "คลัง": "ST", "สโตร์": "ST", "ฝ่ายคลัง": "ST", "store": "ST", "st": "ST",
  "จัดซื้อ": "PC", "ฝ่ายจัดซื้อ": "PC", "purchase": "PC", "pc": "PC",
  "บัญชี": "AC", "ฝ่ายบัญชี": "AC", "account": "AC", "ac": "AC",
  "การเงิน": "AP", "ฝ่ายการเงิน": "AP", "ap": "AP",
  "ช่าง": "MC", "ซ่อมบำรุง": "MC", "mc": "MC",
  "ควบคุมคุณภาพ": "QC", "คิวซี": "QC", "qc": "QC",
  "วิจัย": "R&D", "r&d": "R&D", "rd": "R&D",
  "วัตถุดิบ": "RM", "rm": "RM",
  "บริการ": "SERVICE", "service": "SERVICE",
  "dc": "DC", "lab": "LAB", "ec": "EC", "se": "SE", "o&e": "O&E",
};

function normalizeDepartment(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();
  if (DEPARTMENTS.includes(upper as (typeof DEPARTMENTS)[number])) {
    return upper;
  }
  const lower = trimmed.toLowerCase();
  if (DEPT_MAP[lower]) return DEPT_MAP[lower];
  if (DEPT_MAP[trimmed]) return DEPT_MAP[trimmed];
  return upper;
}

// ---- Export helpers ----
function toRows(
  workers: ForeignWorker[],
  documents: MigrantWorkerDocument[]
): string[][] {
  const workerMap = new Map(workers.map((w) => [w.id, w]));
  const rows: string[][] = [EXPORT_HEADERS];

  // Workers with documents
  const workerIdsWithDocs = new Set(documents.map((d) => d.workerId));

  for (const doc of documents) {
    const w = workerMap.get(doc.workerId);
    if (!w) continue;
    rows.push([
      w.employeeCode,
      w.title,
      w.fullName,
      w.phone ?? "",
      w.nationality,
      w.department,
      w.nationalId,
      w.birthDate ?? "",
      DOC_TYPE_MAP[doc.documentType] ?? doc.documentType,
      doc.documentNumber,
      doc.issuedOn ?? "",
      doc.expiresOn ?? "",
      doc.visaIssuedOn ?? "",
      doc.visaExpiresOn ?? "",
      doc.areaPermitIssuedOn ?? "",
      doc.areaPermitExpiresOn ?? "",
      doc.workPermitNumber ?? "",
      doc.workPermitIssuedOn ?? "",
      doc.workPermitExpiresOn ?? "",
      String(doc.remindDays),
      doc.note,
    ]);
  }

  // Workers without any documents
  for (const w of workers) {
    if (!workerIdsWithDocs.has(w.id)) {
      rows.push([
        w.employeeCode,
        w.title,
        w.fullName,
        w.phone ?? "",
        w.nationality,
        w.department,
        w.nationalId,
        w.birthDate ?? "",
        "", "", "", "", "", "", "", "", "", "", "", "", "",
      ]);
    }
  }

  return rows;
}

export async function exportToExcel(
  workers: ForeignWorker[],
  documents: MigrantWorkerDocument[]
): Promise<void> {
  const XLSX = await loadXlsx();
  const rows = toRows(workers, documents);
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths (21 columns matching EXPORT_HEADERS)
  ws["!cols"] = [
    { wch: 14 }, // รหัสพนักงาน
    { wch: 10 }, // คำนำหน้า
    { wch: 22 }, // ชื่อ-สกุล
    { wch: 15 }, // เบอร์โทรศัพท์
    { wch: 14 }, // สัญชาติ
    { wch: 10 }, // แผนก
    { wch: 20 }, // เลขบัตรประชาชน
    { wch: 13 }, // วันเกิด
    { wch: 18 }, // ประเภทเอกสาร
    { wch: 16 }, // เลขที่เอกสาร
    { wch: 14 }, // วันออกเอกสาร
    { wch: 16 }, // วันหมดอายุเอกสาร
    { wch: 14 }, // วันออกวีซ่า
    { wch: 16 }, // วันหมดอายุวีซ่า
    { wch: 20 }, // วันออกใบออกนอกพื้นที่
    { wch: 22 }, // วันหมดอายุใบออกนอกพื้นที่
    { wch: 18 }, // เลขที่ใบอนุญาตทำงาน
    { wch: 18 }, // วันออกใบอนุญาตทำงาน
    { wch: 20 }, // วันหมดอายุใบอนุญาตทำงาน
    { wch: 18 }, // แจ้งเตือนล่วงหน้า(วัน)
    { wch: 22 }, // หมายเหตุเอกสาร
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "แรงงานต่างด้าว");
  XLSX.writeFile(wb, `migrant_workers_${today()}.xlsx`);
}

export function exportToCSV(
  workers: ForeignWorker[],
  documents: MigrantWorkerDocument[]
): void {
  const rows = toRows(workers, documents);
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\r\n");

  // UTF-8 BOM for Excel compatibility
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `migrant_workers_${today()}.csv`);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Import helpers ----
export interface ImportRow {
  employeeCode: string;
  title: string;
  fullName: string;
  phone: string;
  nationality: string;
  department: string;
  nationalId: string;
  birthDate: string | null;
  documentType: MigrantDocumentType | null;
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
  docNote: string;
  // validation
  rowIndex: number;
  errors: string[];
}

function toGregorianYear(year: number): number {
  return year >= 2400 ? year - 543 : year;
}

function buildValidIsoDate(year: number, month: number, day: number): string | null {
  const gy = toGregorianYear(year);
  if (!Number.isInteger(gy) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (gy < 1900 || gy > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const dt = new Date(Date.UTC(gy, month - 1, day));
  if (
    dt.getUTCFullYear() !== gy ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${gy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

function parseExcelSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  // Account for Excel's 1900 leap-year bug (serials < 60 are shifted by 1 day)
  const days = Math.floor(serial) + (serial < 60 ? 1 : 0);
  const dt = new Date(EXCEL_EPOCH_UTC_MS + days * 86_400_000);
  return buildValidIsoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Parse Excel serial numbers, ISO dates, or Thai B.E. DD/MM/YYYY strings to YYYY-MM-DD. */
export function parseDate(val: unknown): string | null {
  if (val == null || val === "") return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return buildValidIsoDate(val.getFullYear(), val.getMonth() + 1, val.getDate());
  }

  const s = String(val).trim();
  if (!s) return null;

  // YYYY-MM-DD or YYYY/MM/DD (supports Thai B.E. years like 2569-03-15)
  const ymd = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymd) {
    return buildValidIsoDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  // Excel serial number
  if (/^\d+(\.\d+)?$/.test(s)) {
    return parseExcelSerial(Number(s));
  }

  // DD/MM/YYYY or DD-MM-YYYY (supports Thai B.E. years like 15/03/2569)
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return buildValidIsoDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  // Fallback native date string parsing
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return buildValidIsoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  return null;
}

function str(val: unknown): string {
  return val == null ? "" : String(val).trim();
}

export async function parseImportFile(file: File): Promise<ImportRow[]> {
  const XLSX = await loadXlsx();
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  }) as unknown[][];

  if (raw.length < 2) {
    return [];
  }

  // Find header row (first row with รหัสพนักงาน)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    if (raw[i].some((c) => String(c).includes("รหัสพนักงาน"))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    // Fallback to first row
    headerIdx = 0;
  }

  const headers = (raw[headerIdx] as unknown[]).map((h) => String(h).trim());
  const col = (name: string) => headers.indexOf(name);

  const rows: ImportRow[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    const employeeCode = str(r[col("รหัสพนักงาน")]);
    if (!employeeCode) continue; // skip empty rows

    const rawDept = str(r[col("แผนก")]);
    const normalizedDept = normalizeDepartment(rawDept);

    const docTypeLabel = str(r[col("ประเภทเอกสาร")]);
    const docType: MigrantDocumentType | null =
      DOC_TYPE_REVERSE[docTypeLabel] ?? null;

    const docNumber = str(r[col("เลขที่เอกสาร")]);
    const issuedOn = parseDate(r[col("วันออกเอกสาร")]);
    const expiresOn = parseDate(r[col("วันหมดอายุเอกสาร")]);
    const visaIssuedOn = parseDate(r[col("วันออกวีซ่า")]);
    const visaExpiresOn = parseDate(r[col("วันหมดอายุวีซ่า")]);
    const areaPermitIssuedOn = parseDate(r[col("วันออกใบออกนอกพื้นที่")]);
    const areaPermitExpiresOn = parseDate(r[col("วันหมดอายุใบออกนอกพื้นที่")]);
    const workPermitNumber = str(r[col("เลขที่ใบอนุญาตทำงาน")]);
    const workPermitIssuedOn = parseDate(r[col("วันออกใบอนุญาตทำงาน")]);
    const workPermitExpiresOn = parseDate(r[col("วันหมดอายุใบอนุญาตทำงาน")]);

    const rawRemind = str(r[col("แจ้งเตือนล่วงหน้า(วัน)")]);
    const remindDays = rawRemind === "" ? 30 : Number(rawRemind);

    const rawNationalId = str(r[col("เลขบัตรประชาชน")]);
    const idDigits = rawNationalId.replace(/\D/g, "");

    const errors: string[] = [];
    if (!str(r[col("ชื่อ-สกุล")])) errors.push("ไม่มีชื่อ-สกุล");
    if (!normalizedDept) {
      errors.push("ไม่มีแผนก");
    } else if (!DEPARTMENTS.includes(normalizedDept as (typeof DEPARTMENTS)[number])) {
      errors.push(`แผนก "${rawDept}" ไม่ถูกต้อง (ใช้: ${DEPARTMENTS.join(", ")})`);
    }

    if (!idDigits) {
      errors.push("ไม่มีเลขบัตรประชาชน (ต้องครบ 13 หลัก)");
    } else if (idDigits.length !== 13) {
      errors.push(`เลขบัตรประชาชนไม่ครบ 13 หลัก (${idDigits.length}/13)`);
    }

    if (docTypeLabel === "ใบอนุญาตทำงาน") {
      errors.push("ใบอนุญาตทำงานถูกรวมลงในเอกสารแล้ว กรุณาระบุประเภทเป็น พาสปอร์ตสีแดง/เขียว หรือ บัตรชมพู/10ปี");
    } else if (docTypeLabel && !docType) {
      errors.push(`ประเภทเอกสาร "${docTypeLabel}" ไม่ถูกต้อง`);
    }

    // Shared DB-matching validation when a document type is specified
    if (docType) {
      errors.push(
        ...validateMigrantDocument({
          documentType: docType,
          documentNumber: docNumber,
          issuedOn,
          expiresOn,
          visaIssuedOn,
          visaExpiresOn,
          areaPermitIssuedOn,
          areaPermitExpiresOn,
          workPermitIssuedOn,
          workPermitExpiresOn,
          remindDays,
        }),
      );
    }

    const phone =
      str(r[col("เบอร์โทรศัพท์")]) ||
      str(r[col("เบอร์โทร")]) ||
      str(r[col("โทรศัพท์")]) ||
      "";

    rows.push({
      rowIndex: i + 1,
      employeeCode,
      title: str(r[col("คำนำหน้า")]),
      fullName: str(r[col("ชื่อ-สกุล")]),
      phone,
      nationality: str(r[col("สัญชาติ")]),
      department: normalizedDept || rawDept,
      nationalId: formatNationalId(rawNationalId),
      birthDate: parseDate(r[col("วันเกิด")]),
      documentType: docType,
      documentNumber: docNumber,
      issuedOn,
      expiresOn,
      visaIssuedOn,
      visaExpiresOn,
      areaPermitIssuedOn,
      areaPermitExpiresOn,
      workPermitNumber,
      workPermitIssuedOn,
      workPermitExpiresOn,
      remindDays: Number.isFinite(remindDays) ? remindDays : 30,
      docNote: str(r[col("หมายเหตุเอกสาร")]),
      errors,
    });
  }

  return rows;
}

export async function downloadTemplate(): Promise<void> {
  const XLSX = await loadXlsx();
  const rows = [
    EXPORT_HEADERS,
    [
      "CM-0001", "นาย", "สมชาย ใจดี", "081-234-5678", "เมียนมา", "PR",
      "1-2345-67890-12-3", "2000-01-15",
      "พาสปอร์ตสีแดง", "ME123456", "2022-03-01", "2027-03-01",
      "2023-01-01", "2024-01-01", "", "",
      "WP-998877", "2023-01-01", "2025-01-01", "30", "ฝ่ายผลิต (PR)",
    ],
    [
      "CM-0002", "นางสาว", "มะลิ สวยงาม", "089-876-5432", "ลาว", "PA",
      "0-0506-51005-43-4", "1998-05-20",
      "บัตรชมพู", "PK-554433", "2023-02-15", "2025-02-15",
      "", "", "", "",
      "WP-112233", "2023-02-15", "2025-02-15", "30", "ฝ่ายแพ็ค (PA)",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = EXPORT_HEADERS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "migrant_workers_template.xlsx");
}
