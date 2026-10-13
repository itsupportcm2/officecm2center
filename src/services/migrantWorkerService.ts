import { supabase } from "../lib/supabase";

export type MigrantDocumentType = "PASSPORT_RED" | "PASSPORT_GREEN" | "PINK_CARD" | "TEN_YEAR_CARD" | "WORK_PERMIT";

export interface ForeignWorker {
  id: string; employeeCode: string; fullName: string; nationality: string; department: string; organizationUnit: string; title: string; nationalId: string; birthDate: string | null; position: string; note: string; isActive: boolean; createdAt: string; updatedAt: string;
}
export interface MigrantWorkerDocument {
  id: string; workerId: string; documentType: MigrantDocumentType; documentNumber: string;
  issuedOn: string | null; expiresOn: string | null; visaIssuedOn: string | null; visaExpiresOn: string | null;
  areaPermitIssuedOn: string | null; areaPermitExpiresOn: string | null;
  remindDays: number; note: string; isActive: boolean; createdAt: string; updatedAt: string;
}
export interface MigrantDocumentHistory { id: string; documentId: string; action: string; changedAt: string; changedByName: string; note: string | null }
export interface MigrantSnapshot { workers: ForeignWorker[]; documents: MigrantWorkerDocument[]; history: MigrantDocumentHistory[] }

const worker = (row: any): ForeignWorker => ({ id:String(row.id), employeeCode:String(row.employee_code), fullName:String(row.full_name), nationality:String(row.nationality ?? ""), department:String(row.department), organizationUnit:String(row.organization_unit ?? ""), title:String(row.title ?? ""), nationalId:String(row.national_id ?? ""), birthDate:row.birth_date ?? null, position:String(row.position ?? ""), note:String(row.note ?? ""), isActive:Boolean(row.is_active), createdAt:String(row.created_at), updatedAt:String(row.updated_at) });
const document = (row: any): MigrantWorkerDocument => ({ id:String(row.id), workerId:String(row.worker_id), documentType:row.document_type, documentNumber:String(row.document_number), issuedOn:row.issued_on ?? null, expiresOn:row.expires_on ?? null, visaIssuedOn:row.visa_issued_on ?? null, visaExpiresOn:row.visa_expires_on ?? null, areaPermitIssuedOn:row.area_permit_issued_on ?? null, areaPermitExpiresOn:row.area_permit_expires_on ?? null, remindDays:Number(row.remind_days ?? 30), note:String(row.note ?? ""), isActive:Boolean(row.is_active), createdAt:String(row.created_at), updatedAt:String(row.updated_at) });
const history = (row: any): MigrantDocumentHistory => ({ id:String(row.id), documentId:String(row.document_id), action:String(row.action), changedAt:String(row.changed_at), changedByName:String(row.changed_by_name ?? "ผู้ใช้งาน"), note:row.note ?? null });

export const migrantWorkerService = {
  async load(): Promise<MigrantSnapshot> {
    if (!supabase) return { workers: [], documents: [], history: [] };
    const { data, error } = await supabase.rpc("get_migrant_worker_snapshot");
    if (error) throw error;
    const result = data as any;
    return { workers:(result?.workers ?? []).map(worker), documents:(result?.documents ?? []).map(document), history:(result?.history ?? []).map(history) };
  },
  async saveWorker(input: Omit<ForeignWorker, "createdAt" | "updatedAt">): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.rpc("save_foreign_worker_details", { p_worker_id:input.id || null, p_employee_code:input.employeeCode, p_full_name:input.fullName, p_nationality:input.nationality, p_department:input.department, p_organization_unit:input.organizationUnit, p_title:input.title, p_national_id:input.nationalId, p_birth_date:input.birthDate, p_position:input.position, p_note:input.note, p_is_active:input.isActive });
    if (error) throw error;
  },
  async saveDocument(input: Omit<MigrantWorkerDocument, "createdAt" | "updatedAt">): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.rpc("save_migrant_worker_document_details", { p_document_id:input.id || null, p_worker_id:input.workerId, p_document_type:input.documentType, p_document_number:input.documentNumber, p_issued_on:input.issuedOn, p_expires_on:input.expiresOn, p_visa_issued_on:input.visaIssuedOn, p_visa_expires_on:input.visaExpiresOn, p_area_permit_issued_on:input.areaPermitIssuedOn, p_area_permit_expires_on:input.areaPermitExpiresOn, p_remind_days:input.remindDays, p_note:input.note, p_is_active:input.isActive });
    if (error) throw error;
  },
};
