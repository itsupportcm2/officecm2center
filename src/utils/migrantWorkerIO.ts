import * as XLSX from "xlsx";
import { DEPARTMENTS } from "../constants/departments";
import type {
  ForeignWorker,
  MigrantDocumentType,
  MigrantWorkerDocument,
} from "../services/migrantWorkerService";

// ---- Column headers ----
export const EXPORT_HEADERS = [
  "รหัสพนักงาน",
  "คำนำหน้า",
  "ชื่อ-สกุล",
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

export function exportToExcel(
  workers: ForeignWorker[],
  documents: MigrantWorkerDocument[]
): void {
  const rows = toRows(workers, documents);
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 18 },
    { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 },
    { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 20 },
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

function parseDate(val: unknown): string | null {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Excel serial number
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }

  // Try native parsing as last resort
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function str(val: unknown): string {
  return val == null ? "" : String(val).trim();
}

export function parseImportFile(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
        }) as unknown[][];

        if (raw.length < 2) {
          resolve([]);
          return;
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

        const headers = (raw[headerIdx] as unknown[]).map((h) =>
          String(h).trim()
        );
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

          const errors: string[] = [];
          if (!str(r[col("ชื่อ-สกุล")])) errors.push("ไม่มีชื่อ-สกุล");
          if (!normalizedDept) {
            errors.push("ไม่มีแผนก");
          } else if (!DEPARTMENTS.includes(normalizedDept as (typeof DEPARTMENTS)[number])) {
            errors.push(`แผนก "${rawDept}" ไม่ถูกต้อง (ใช้: EC, HR, AP, AC, PC, IT, DC, LAB, R&D, QC, RM, PR, PA, ST, MC, SE, O&E, SERVICE)`);
          }

          if (docTypeLabel === "ใบอนุญาตทำงาน") {
            errors.push("ใบอนุญาตทำงานถูกรวมลงในเอกสารแล้ว กรุณาระบุประเภทเป็น พาสปอร์ตสีแดง/เขียว หรือ บัตรชมพู/10ปี");
          } else if (docTypeLabel && !docType) {
            errors.push(`ประเภทเอกสาร "${docTypeLabel}" ไม่ถูกต้อง`);
          }

          // Document specific checks if a document type is chosen
          if (docType) {
            if (!docNumber) errors.push("กรุณากรอกเลขที่เอกสาร");
            if (!expiresOn) errors.push("กรุณาระบุวันหมดอายุเอกสาร");
            if ((docType === "PASSPORT_RED" || docType === "PASSPORT_GREEN") && !visaExpiresOn) {
              errors.push("พาสปอร์ตต้องระบุวันหมดอายุวีซ่า");
            }
            if (docType === "TEN_YEAR_CARD" && !areaPermitExpiresOn) {
              errors.push("บัตร 10 ปีต้องระบุวันหมดอายุใบออกนอกพื้นที่");
            }
          }

          rows.push({
            rowIndex: i + 1,
            employeeCode,
            title: str(r[col("คำนำหน้า")]),
            fullName: str(r[col("ชื่อ-สกุล")]),
            nationality: str(r[col("สัญชาติ")]),
            department: normalizedDept || rawDept,
            nationalId: str(r[col("เลขบัตรประชาชน")]),
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
            remindDays: Number(r[col("แจ้งเตือนล่วงหน้า(วัน)")]) || 30,
            docNote: str(r[col("หมายเหตุเอกสาร")]),
            errors,
          });
        }

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsArrayBuffer(file);
  });
}

export function downloadTemplate(): void {
  const rows = [
    EXPORT_HEADERS,
    [
      "CM-0001", "นาย", "สมชาย ใจดี", "เมียนมา", "PR",
      "1234567890123", "2000-01-15",
      "พาสปอร์ตสีแดง", "ME123456", "2022-03-01", "2027-03-01",
      "2023-01-01", "2024-01-01", "", "",
      "WP-998877", "2023-01-01", "2025-01-01", "30", "ฝ่ายผลิต (PR)",
    ],
    [
      "CM-0002", "นางสาว", "มะลิ สวยงาม", "ลาว", "PA",
      "0012345678901", "1998-05-20",
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
