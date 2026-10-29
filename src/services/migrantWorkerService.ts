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

const worker = (row: any): ForeignWorker => ({
  id: String(row.id),
  employeeCode: String(row.employee_code),
  fullName: String(row.full_name),
  nationality: String(row.nationality ?? ""),
  department: String(row.department),
  organizationUnit: String(row.organization_unit ?? ""),
  phone: String(row.phone ?? row.organization_unit ?? ""),
  title: String(row.title ?? ""),
  nationalId: String(row.national_id ?? ""),
  birthDate: row.birth_date ?? null,
  position: String(row.position ?? ""),
  note: String(row.note ?? ""),
  isActive: Boolean(row.is_active),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});
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
    const { data, error } = await supabase.rpc("save_foreign_worker_details", {
      p_worker_id: input.id || null,
      p_employee_code: input.employeeCode,
      p_full_name: input.fullName,
      p_nationality: input.nationality,
      p_department: input.department,
      p_organization_unit: (input.phone ?? input.organizationUnit ?? "").trim(),
      p_title: input.title,
      p_national_id: input.nationalId,
      p_birth_date: input.birthDate,
      p_position: input.position,
      p_note: input.note,
      p_is_active: input.isActive ?? true,
    });
    if (error) {
      if (error.message?.includes("invalid department")) {
        throw new Error(`แผนก "${input.department}" ไม่ถูกต้องในระบบ (ต้องเป็นหนึ่งใน: EC, HR, AP, AC, PC, IT, DC, LAB, R&D, QC, RM, PR, PA, ST, MC, SE, O&E, SERVICE)`);
      }
      if (error.message?.includes("employee code already exists")) {
        throw new Error(`รหัสพนักงาน "${input.employeeCode}" มีอยู่แล้วในระบบ`);
      }
      throw error;
    }
    return worker(data);
  },
  async deleteWorker(workerId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");

    // 1. Fetch document IDs to delete histories
    const { data: docs } = await supabase
      .from("migrant_worker_documents")
      .select("id")
      .eq("worker_id", workerId);

    const docIds = (docs ?? []).map((d: any) => d.id);
    if (docIds.length > 0) {
      await supabase
        .from("migrant_worker_document_history")
        .delete()
        .in("document_id", docIds);

      await supabase
        .from("migrant_worker_documents")
        .delete()
        .eq("worker_id", workerId);
    }

    // 2. Delete worker record
    const { error } = await supabase
      .from("foreign_workers")
      .delete()
      .eq("id", workerId);

    if (error) throw error;
  },
  async deleteDocument(docId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    await supabase
      .from("migrant_worker_document_history")
      .delete()
      .eq("document_id", docId);
    const { error } = await supabase
      .from("migrant_worker_documents")
      .delete()
      .eq("id", docId);
    if (error) throw error;
  },
  async saveDocument(
    input: Omit<MigrantWorkerDocument, "createdAt" | "updatedAt">,
  ): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    
    // First try with 16 params (including work permit columns)
    const { error } = await supabase.rpc(
      "save_migrant_worker_document_details",
      {
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
        p_work_permit_number: input.workPermitNumber ?? "",
        p_work_permit_issued_on: input.workPermitIssuedOn ?? null,
        p_work_permit_expires_on: input.workPermitExpiresOn ?? null,
      },
    );

    if (error) {
      // If function with 16 params not found (migration not yet run in Supabase), fallback to 13 params
      const isParamMismatch =
        error.code === "PGRST202" ||
        error.message?.includes("Could not find the function") ||
        (error.message?.includes("function") && error.message?.includes("save_migrant_worker_document_details"));

      if (isParamMismatch) {
        const { error: fallbackError } = await supabase.rpc(
          "save_migrant_worker_document_details",
          {
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
          },
        );
        if (fallbackError) throw fallbackError;
        return;
      }
      throw error;
    }
  },
};
