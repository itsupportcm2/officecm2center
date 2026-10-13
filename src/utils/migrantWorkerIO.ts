import * as XLSX from "xlsx";
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
  "แจ้งเตือนล่วงหน้า(วัน)",
  "หมายเหตุเอกสาร",
];

const DOC_TYPE_MAP: Record<MigrantDocumentType, string> = {
  PASSPORT_RED: "พาสปอร์ตสีแดง",
  PASSPORT_GREEN: "พาสปอร์ตสีเขียว",
  PINK_CARD: "บัตรชมพู",
  TEN_YEAR_CARD: "บัตร 10 ปี",
  WORK_PERMIT: "ใบอนุญาตทำงาน",
};

const DOC_TYPE_REVERSE: Record<string, MigrantDocumentType> = Object.fromEntries(
  Object.entries(DOC_TYPE_MAP).map(([k, v]) => [v, k as MigrantDocumentType])
);

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
        "", "", "", "", "", "", "", "", "", "",
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
    { wch: 14 }, { wch: 20 },
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
        let headerIdx = 0;
        for (let i = 0; i < Math.min(raw.length, 5); i++) {
          if (raw[i].some((c) => String(c).includes("รหัสพนักงาน"))) {
            headerIdx = i;
            break;
          }
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

          const docTypeLabel = str(r[col("ประเภทเอกสาร")]);
          const docType: MigrantDocumentType | null =
            DOC_TYPE_REVERSE[docTypeLabel] ?? null;

          const errors: string[] = [];
          if (!str(r[col("ชื่อ-สกุล")])) errors.push("ไม่มีชื่อ-สกุล");
          if (!str(r[col("แผนก")])) errors.push("ไม่มีแผนก");
          if (docTypeLabel && !docType)
            errors.push(`ประเภทเอกสาร "${docTypeLabel}" ไม่ถูกต้อง`);

          rows.push({
            rowIndex: i + 1,
            employeeCode,
            title: str(r[col("คำนำหน้า")]),
            fullName: str(r[col("ชื่อ-สกุล")]),
            nationality: str(r[col("สัญชาติ")]),
            department: str(r[col("แผนก")]),
            nationalId: str(r[col("เลขบัตรประชาชน")]),
            birthDate: parseDate(r[col("วันเกิด")]),
            documentType: docType,
            documentNumber: str(r[col("เลขที่เอกสาร")]),
            issuedOn: parseDate(r[col("วันออกเอกสาร")]),
            expiresOn: parseDate(r[col("วันหมดอายุเอกสาร")]),
            visaIssuedOn: parseDate(r[col("วันออกวีซ่า")]),
            visaExpiresOn: parseDate(r[col("วันหมดอายุวีซ่า")]),
            areaPermitIssuedOn: parseDate(r[col("วันออกใบออกนอกพื้นที่")]),
            areaPermitExpiresOn: parseDate(r[col("วันหมดอายุใบออกนอกพื้นที่")]),
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
      "CM-0001", "นาย", "สมชาย ใจดี", "เมียนมา", "ฝ่ายผลิต",
      "1234567890123", "2000-01-15",
      "พาสปอร์ตสีแดง", "ME123456", "2022-03-01", "2027-03-01",
      "2023-01-01", "2024-01-01", "", "", "30", "",
    ],
    [
      "CM-0001", "นาย", "สมชาย ใจดี", "เมียนมา", "ฝ่ายผลิต",
      "1234567890123", "2000-01-15",
      "ใบอนุญาตทำงาน", "", "", "2024-12-31",
      "", "", "", "", "30", "",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = EXPORT_HEADERS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "migrant_workers_template.xlsx");
}
