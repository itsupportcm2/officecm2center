import { supabase } from "../lib/supabase";

export type MigrantDocumentType =
  | "PASSPORT_RED"
  | "PASSPORT_GREEN"
  | "PINK_CARD"
  | "TEN_YEAR_CARD";

export interface ForeignWorker {
  id: string;
  employeeCode: string;
  fullName: string;
  nationality: string;
  department: string;
  organizationUnit: string;
  phone: string;
  title: string;
  nationalId: string;
  birthDate: string | null;
  position: string;
  note: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface MigrantWorkerDocument {
  id: string;
  workerId: string;
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface MigrantDocumentHistory {
  id: string;
  documentId: string;
  action: string;
  changedAt: string;
  changedByName: string;
  note: string | null;
}
export interface MigrantSnapshot {
  workers: ForeignWorker[];
  documents: MigrantWorkerDocument[];
  history: MigrantDocumentHistory[];
}

export type WorkerGender = "MALE" | "FEMALE" | "UNKNOWN";

export const GENDER_LABELS: Record<WorkerGender, string> = {
  MALE: "ชาย",
  FEMALE: "หญิง",
  UNKNOWN: "ไม่ระบุ",
};

export const getWorkerGender = (worker: { title?: string | null; fullName?: string }): WorkerGender => {
  const t = (worker.title || "").trim().toLowerCase();
  const name = (worker.fullName || "").trim().toLowerCase();

  if (
    t === "นาย" ||
    t === "mr." ||
    t === "mr" ||
    t === "ชาย" ||
    t.startsWith("นาย")
  ) {
    return "MALE";
  }
  if (
    t === "นาง" ||
    t === "นางสาว" ||
    t === "น.ส." ||
    t === "น.ส" ||
    t === "ms." ||
    t === "ms" ||
    t === "mrs." ||
    t === "mrs" ||
    t === "miss" ||
    t === "หญิง" ||
    t.startsWith("นาง") ||
    t.startsWith("นางสาว")
  ) {
    return "FEMALE";
  }

  if (name.startsWith("นาย ") || name.startsWith("mr. ") || name.startsWith("mr ")) return "MALE";
  if (
    name.startsWith("นาง ") ||
    name.startsWith("นางสาว ") ||
    name.startsWith("น.ส. ") ||
    name.startsWith("ms. ") ||
    name.startsWith("mrs. ") ||
    name.startsWith("miss ")
  ) {
    return "FEMALE";
  }

  return "UNKNOWN";
};

export const getWorkerAge = (birthDate: string | null | undefined): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
};

export const formatNationalId = (val: string | null | undefined): string => {
  if (!val) return "";
  const digits = String(val).replace(/\D/g, "").slice(0, 13);
  let res = "";
  if (digits.length > 0) res += digits.slice(0, 1);
  if (digits.length > 1) res += "-" + digits.slice(1, 5);
  if (digits.length > 5) res += "-" + digits.slice(5, 10);
  if (digits.length > 10) res += "-" + digits.slice(10, 12);
  if (digits.length > 12) res += "-" + digits.slice(12, 13);
  return res;
};

export interface DocumentValidationInput {
  documentType: MigrantDocumentType;
  documentNumber: string;
  issuedOn: string | null;
  expiresOn: string | null;
  visaIssuedOn?: string | null;
  visaExpiresOn?: string | null;
  areaPermitIssuedOn?: string | null;
  areaPermitExpiresOn?: string | null;
  workPermitIssuedOn?: string | null;
  workPermitExpiresOn?: string | null;
  remindDays?: number;
}

/** Validate migrant document fields to match PostgreSQL table check constraints. */
export function validateMigrantDocument(doc: DocumentValidationInput): string[] {
  const errors: string[] = [];
  const num = (doc.documentNumber || "").trim();

  if (!num) {
    errors.push("กรุณากรอกเลขที่เอกสาร");
  } else if (doc.documentType === "PASSPORT_RED" && !/^M/i.test(num)) {
    errors.push("เลขที่พาสปอร์ตสีแดงต้องขึ้นต้นด้วยตัว M (เช่น ME123456)");
  } else if (doc.documentType === "PASSPORT_GREEN" && !/^(CC|CA)/i.test(num)) {
    errors.push("เลขที่พาสปอร์ตสีเขียวต้องขึ้นต้นด้วย CC หรือ CA");
  }

  if (!doc.issuedOn) {
    errors.push("กรุณาระบุวันออกเอกสาร");
  }
  if (!doc.expiresOn) {
    errors.push("กรุณาระบุวันหมดอายุเอกสาร");
  }
  if (doc.issuedOn && doc.expiresOn && doc.expiresOn < doc.issuedOn) {
    errors.push("วันหมดอายุเอกสารต้องไม่ก่อนวันออกเอกสาร");
  }

  if (doc.documentType === "PASSPORT_RED" || doc.documentType === "PASSPORT_GREEN") {
    if (!doc.visaExpiresOn) {
      errors.push("กรุณาระบุวันหมดอายุวีซ่า");
    }
    if (doc.visaIssuedOn && doc.visaExpiresOn && doc.visaExpiresOn < doc.visaIssuedOn) {
      errors.push("วันหมดอายุวีซ่าต้องไม่ก่อนวันออกวีซ่า");
    }
  }

  if (doc.documentType === "TEN_YEAR_CARD") {
    if (!doc.areaPermitIssuedOn) {
      errors.push("กรุณาระบุวันออกใบออกนอกพื้นที่");
    }
    if (!doc.areaPermitExpiresOn) {
      errors.push("กรุณาระบุวันหมดอายุใบออกนอกพื้นที่");
    }
    if (
      doc.areaPermitIssuedOn &&
      doc.areaPermitExpiresOn &&
      doc.areaPermitExpiresOn < doc.areaPermitIssuedOn
    ) {
      errors.push("วันหมดอายุใบออกนอกพื้นที่ต้องไม่ก่อนวันออกใบออกนอกพื้นที่");
    }
  }

  if (
    doc.workPermitIssuedOn &&
    doc.workPermitExpiresOn &&
    doc.workPermitExpiresOn < doc.workPermitIssuedOn
  ) {
    errors.push("วันหมดอายุใบอนุญาตทำงานต้องไม่ก่อนวันออกใบอนุญาตทำงาน");
  }

  if (
    doc.remindDays !== undefined &&
    (!Number.isFinite(doc.remindDays) || doc.remindDays < 0 || doc.remindDays > 365)
  ) {
    errors.push("จำนวนวันแจ้งเตือนล่วงหน้าต้องอยู่ระหว่าง 0 ถึง 365 วัน");
  }

  return errors;
}

function isRpcNotFoundError(error: any, fnName: string): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "");
  return (
    error.code === "PGRST202" ||
    msg.includes("Could not find the function") ||
    (msg.includes("function") && msg.includes(fnName))
  );
}

/** Translate PostgreSQL constraint and RPC errors into readable Thai messages. */
export function translateMigrantDbError(error: any): Error {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "");
  const details = String(error?.details ?? "");
  const combined = `${msg} ${details}`;

  if (
    combined.includes("migrant_worker_one_active_identity_document_idx") ||
    (code === "23505" && combined.toLowerCase().includes("identity_document"))
  ) {
    return new Error(
      "พนักงานคนนี้มีเอกสารหลักที่ใช้งานอยู่แล้ว 1 ฉบับ กรุณาแก้ไขเอกสารเดิม หรือปิดใช้งานเอกสารเดิมก่อนเพิ่มฉบับใหม่",
    );
  }
  if (
    combined.includes("migrant_worker_documents_document_number_check") ||
    combined.includes("^M") ||
    combined.includes("^(CC|CA)")
  ) {
    return new Error(
      "รูปแบบเลขที่เอกสารไม่ถูกต้อง (พาสปอร์ตสีแดงต้องขึ้นต้นด้วย M, สีเขียวต้องขึ้นต้นด้วย CC หรือ CA)",
    );
  }
  if (combined.includes("migrant_worker_documents_check")) {
    return new Error(
      "ข้อมูลวันที่เอกสารไม่ครบถ้วน (ต้องระบุวันออกและวันหมดอายุเอกสาร รวมถึงวีซ่า/ใบออกนอกพื้นที่ตามประเภท)",
    );
  }
  if (combined.includes("date_order") || combined.includes("expires_on >= issued_on")) {
    return new Error("วันหมดอายุต้องไม่ก่อนวันออกเอกสาร");
  }
  if (combined.toLowerCase().includes("permission denied")) {
    return new Error(
      "ไม่มีสิทธิ์ดำเนินการ กรุณาตรวจสอบสิทธิ์ผู้ใช้งานหรืออัปเดตฟังก์ชันฐานข้อมูล",
    );
  }

  return error instanceof Error ? error : new Error(msg || "ดำเนินการไม่สำเร็จ");
}

const worker = (row: any): ForeignWorker => {
  const hasPhoneColumn = Object.prototype.hasOwnProperty.call(row ?? {}, "phone");
  const rawPhone = String(row?.phone ?? "").trim();
  const rawOrg = String(row?.organization_unit ?? "").trim();
  const looksLikePhone = /^[0-9+\-\s()]{7,30}$/.test(rawOrg);
  const phone = rawPhone || (!hasPhoneColumn || looksLikePhone ? rawOrg : "");
  const organizationUnit = looksLikePhone && !rawPhone ? "" : rawOrg;

  return {
    id: String(row.id),
    employeeCode: String(row.employee_code),
    fullName: String(row.full_name),
    nationality: String(row.nationality ?? ""),
    department: String(row.department),
    organizationUnit,
    phone,
    title: String(row.title ?? ""),
    nationalId: formatNationalId(row.national_id),
    birthDate: row.birth_date ?? null,
    position: String(row.position ?? ""),
    note: String(row.note ?? ""),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
};
const document = (row: any): MigrantWorkerDocument => ({
  id: String(row.id),
  workerId: String(row.worker_id),
  documentType: row.document_type,
  documentNumber: String(row.document_number ?? ""),
  issuedOn: row.issued_on ?? null,
  expiresOn: row.expires_on ?? null,
  visaIssuedOn: row.visa_issued_on ?? null,
  visaExpiresOn: row.visa_expires_on ?? null,
  areaPermitIssuedOn: row.area_permit_issued_on ?? null,
  areaPermitExpiresOn: row.area_permit_expires_on ?? null,
  workPermitNumber: String(row.work_permit_number ?? ""),
  workPermitIssuedOn: row.work_permit_issued_on ?? null,
  workPermitExpiresOn: row.work_permit_expires_on ?? null,
  remindDays: Number(row.remind_days ?? 30),
  note: String(row.note ?? ""),
  isActive: Boolean(row.is_active),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});
const history = (row: any): MigrantDocumentHistory => ({
  id: String(row.id),
  documentId: String(row.document_id),
  action: String(row.action),
  changedAt: String(row.changed_at),
  changedByName: String(row.changed_by_name ?? "ผู้ใช้งาน"),
  note: row.note ?? null,
});

export const migrantWorkerService = {
  async load(): Promise<MigrantSnapshot> {
    if (!supabase) return { workers: [], documents: [], history: [] };
    const { data, error } = await supabase.rpc("get_migrant_worker_snapshot");
    if (error) throw error;
    const result = data as any;
    return {
      workers: (result?.workers ?? []).map(worker),
      documents: (result?.documents ?? []).map(document),
      history: (result?.history ?? []).map(history),
    };
  },
  async saveWorker(
    input: Omit<ForeignWorker, "createdAt" | "updatedAt">,
  ): Promise<ForeignWorker> {
    if (!supabase) throw new Error("Supabase is not configured");

    const baseParams = {
      p_worker_id: input.id || null,
      p_employee_code: input.employeeCode,
      p_full_name: input.fullName,
      p_nationality: input.nationality,
      p_department: input.department,
      p_title: input.title,
      p_national_id: input.nationalId ? formatNationalId(input.nationalId) : "",
      p_birth_date: input.birthDate,
      p_position: input.position,
      p_note: input.note,
      p_is_active: input.isActive ?? true,
    };

    const throwWorkerError = (err: any): never => {
      if (err?.message?.includes("invalid department")) {
        throw new Error(
          `แผนก "${input.department}" ไม่ถูกต้องในระบบ (ต้องเป็นหนึ่งใน: EC, HR, AP, AC, PC, IT, DC, LAB, R&D, QC, RM, PR, PA, ST, MC, SE, O&E, SERVICE)`,
        );
      }
      if (
        err?.message?.includes("employee code already exists") ||
        err?.message?.includes("foreign_workers_employee_code_key")
      ) {
        throw new Error(`รหัสพนักงาน "${input.employeeCode}" มีอยู่แล้วในระบบ`);
      }
      throw translateMigrantDbError(err);
    };

    // First try 13-param RPC (with dedicated p_phone column)
    const { data, error } = await supabase.rpc("save_foreign_worker_details", {
      ...baseParams,
      p_organization_unit: (input.organizationUnit ?? "").trim(),
      p_phone: (input.phone ?? "").trim(),
    });

    if (error) {
      // Fallback to 12-param signature if 202611240001 migration hasn't run yet
      if (isRpcNotFoundError(error, "save_foreign_worker_details")) {
        const { data: fallbackData, error: fallbackError } = await supabase.rpc(
          "save_foreign_worker_details",
          {
            ...baseParams,
            p_organization_unit: (input.phone || input.organizationUnit || "").trim(),
          },
        );
        if (fallbackError) throwWorkerError(fallbackError);
        return worker(fallbackData);
      }
      throwWorkerError(error);
    }

    return worker(data);
  },
  async deleteWorker(workerId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.rpc("delete_foreign_worker", {
      p_worker_id: workerId,
    });
    if (error) {
      if (isRpcNotFoundError(error, "delete_foreign_worker")) {
        throw new Error(
          "ยังไม่พบฟังก์ชันลบข้อมูลในฐานข้อมูล กรุณารันไฟล์ migration 202611240001_migrant_worker_delete_and_phone.sql ใน Supabase SQL Editor ก่อน",
        );
      }
      throw translateMigrantDbError(error);
    }
  },
  async deleteDocument(docId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.rpc("delete_migrant_worker_document", {
      p_document_id: docId,
    });
    if (error) {
      if (isRpcNotFoundError(error, "delete_migrant_worker_document")) {
        throw new Error(
          "ยังไม่พบฟังก์ชันลบเอกสารในฐานข้อมูล กรุณารันไฟล์ migration 202611240001_migrant_worker_delete_and_phone.sql ใน Supabase SQL Editor ก่อน",
        );
      }
      throw translateMigrantDbError(error);
    }
  },
  async saveDocument(
    input: Omit<MigrantWorkerDocument, "createdAt" | "updatedAt">,
  ): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");

    const baseParams = {
      p_document_id: input.id || null,
      p_worker_id: input.workerId,
      p_document_type: input.documentType,
      p_document_number: input.documentNumber,
      p_issued_on: input.issuedOn,
      p_expires_on: input.expiresOn,
      p_visa_issued_on: input.visaIssuedOn,
      p_visa_expires_on: input.visaExpiresOn,
      p_area_permit_issued_on: input.areaPermitIssuedOn,
      p_area_permit_expires_on: input.areaPermitExpiresOn,
      p_remind_days: input.remindDays,
      p_note: input.note,
      p_is_active: input.isActive,
    };

    // First try with 16 params (including work permit columns)
    const { error } = await supabase.rpc("save_migrant_worker_document_details", {
      ...baseParams,
      p_work_permit_number: input.workPermitNumber ?? "",
      p_work_permit_issued_on: input.workPermitIssuedOn ?? null,
      p_work_permit_expires_on: input.workPermitExpiresOn ?? null,
    });

    if (error) {
      // If function with 16 params not found (migration not yet run in Supabase), fallback to 13 params
      if (isRpcNotFoundError(error, "save_migrant_worker_document_details")) {
        const { error: fallbackError } = await supabase.rpc(
          "save_migrant_worker_document_details",
          baseParams,
        );
        if (fallbackError) throw translateMigrantDbError(fallbackError);
        return;
      }
      throw translateMigrantDbError(error);
    }
  },
};
