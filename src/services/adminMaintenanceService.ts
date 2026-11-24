import { isSupabaseConfigured, supabase } from "../lib/supabase";

export type PurgeModuleKey =
  | "migrant_workers"
  | "renewals"
  | "issue_requests"
  | "purchase_requests"
  | "stock_transactions"
  | "audit_logs";

export interface PurgeModuleConfig {
  key: PurgeModuleKey;
  title: string;
  badge: string;
  subtitle: string;
  deletes: string[];
  preserves: string;
}

export interface PurgeResult {
  module: PurgeModuleKey;
  deleted: Record<string, number>;
}

export const PURGE_MODULES: ReadonlyArray<PurgeModuleConfig> = [
  {
    key: "migrant_workers",
    title: "ข้อมูลต่อภาษีแรงงานต่างด้าว",
    badge: "HR & แรงงานต่างด้าว",
    subtitle: "ล้างข้อมูลทดสอบทั้งหมดในระบบต่อภาษี เพื่อเริ่มนำเข้าข้อมูลจริง",
    deletes: [
      "รายชื่อพนักงานต่างด้าวทั้งหมด (foreign_workers)",
      "เอกสารพาสปอร์ต, บัตรชมพู, บัตร 10 ปี และใบอนุญาตทำงานทั้งหมด",
      "ประวัติการแก้ไขและต่ออายุเอกสารแรงงานต่างด้าวทั้งหมด",
    ],
    preserves: "ไม่กระทบข้อมูลสินค้าในคลัง ยอดสต็อก ใบขอเบิก และบัญชีผู้ใช้งาน",
  },
  {
    key: "renewals",
    title: "รายการต่ออายุสำนักงาน",
    badge: "เอกสารสำนักงาน",
    subtitle: "ล้างข้อมูลการติดตามต่ออายุภาษี ประกันภัย และใบอนุญาตสำนักงาน",
    deletes: [
      "รายการติดตามต่ออายุทั้งหมด (renewals)",
      "ประวัติการต่ออายุทั้งหมด (renewal_history)",
    ],
    preserves: "ไม่กระทบข้อมูลแรงงานต่างด้าว คลังสินค้า และผู้ใช้งาน",
  },
  {
    key: "issue_requests",
    title: "คำขอเบิกสินค้า",
    badge: "งานเบิกจ่าย",
    subtitle: "ล้างคำขอเบิกสินค้า รายการรออนุมัติ และคำขอรอจ่ายของทั้งหมด",
    deletes: [
      "ใบคำขอเบิกสินค้าทั้งหมด (issue_requests)",
      "รายการสินค้าภายในใบขอเบิกทั้งหมด (issue_request_lines)",
    ],
    preserves: "ไม่กระทบรายการสินค้า ยอดสต็อกคงเหลือ และข้อมูลแรงงานต่างด้าว",
  },
  {
    key: "purchase_requests",
    title: "ใบขอซื้อ (PR)",
    badge: "จัดซื้อ",
    subtitle: "ล้างรายการใบขอซื้อและสถานะสั่งซื้อทั้งหมด",
    deletes: [
      "ใบขอซื้อทั้งหมด (purchase_requests)",
      "รายการสินค้าในใบขอซื้อทั้งหมด (purchase_request_lines)",
    ],
    preserves: "ไม่กระทบรายการสินค้า ยอดสต็อกคงเหลือ และใบขอเบิก",
  },
  {
    key: "stock_transactions",
    title: "ประวัติเคลื่อนไหวสต็อก",
    badge: "คลังสินค้า",
    subtitle: "ล้างประวัติรับเข้า-เบิกออก-ปรับยอด และรีเซ็ตยอดคงเหลือในคลังเป็น 0",
    deletes: [
      "ประวัติธุรกรรมสต็อกทั้งหมด (stock_transactions)",
      "รีเซ็ตยอดคงเหลือในทุกคลังสินค้าให้เป็น 0",
    ],
    preserves: "ยังเก็บรายการสินค้า หมวดหมู่ และตำแหน่งจัดเก็บไว้ครบถ้วน",
  },
  {
    key: "audit_logs",
    title: "บันทึกกิจกรรม (Audit Log)",
    badge: "ความปลอดภัย",
    subtitle: "ล้างประวัติการใช้งานและบันทึกการแก้ไขย้อนหลังทั้งหมด",
    deletes: [
      "บันทึกกิจกรรมในระบบทั้งหมด (audit_logs)",
    ],
    preserves: "ไม่กระทบข้อมูลหลักในคลังสินค้า ใบขอเบิก และแรงงานต่างด้าว",
  },
];

const clearOfflineModule = (moduleKey: PurgeModuleKey): Record<string, number> => {
  switch (moduleKey) {
    case "renewals":
      localStorage.setItem("cm-office-renewals-v1", "[]");
      localStorage.setItem("cm-office-renewal-history-v1", "[]");
      return { renewals: 0, history: 0 };
    case "stock_transactions":
      localStorage.setItem("cm-office-transactions-v2", "[]");
      localStorage.setItem("cm-office-balances-v1", "{}");
      return { transactions: 0, resetBalances: 0 };
    case "audit_logs":
      localStorage.setItem("cm-office-audit-v1", "[]");
      return { logs: 0 };
    default:
      return {};
  }
};

export const adminMaintenanceService = {
  async purgeModule(moduleKey: PurgeModuleKey): Promise<PurgeResult> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        module: moduleKey,
        deleted: clearOfflineModule(moduleKey),
      };
    }

    const { data, error } = await supabase.rpc("admin_purge_module_data", {
      p_module: moduleKey,
    });

    if (error) {
      const msg = String(error.message || "");
      const code = String((error as { code?: string }).code || "");
      if (
        code === "PGRST202" ||
        msg.includes("Could not find the function") ||
        msg.includes("admin_purge_module_data")
      ) {
        throw new Error(
          "ยังไม่พบฟังก์ชันล้างข้อมูลในฐานข้อมูล กรุณารันไฟล์ migration 202611240002_admin_selective_purge.sql ใน Supabase SQL Editor ก่อน",
        );
      }
      if (msg.includes("DELETE requires a WHERE clause")) {
        throw new Error(
          "ฟังก์ชันล้างข้อมูลในฐานข้อมูลเป็นเวอร์ชันเก่า กรุณารันไฟล์ migration 202611240002_admin_selective_purge.sql เวอร์ชันล่าสุดใน Supabase SQL Editor ใหม่อีกครั้ง",
        );
      }
      if (msg.toLowerCase().includes("permission denied")) {
        throw new Error("เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถล้างข้อมูลได้");
      }
      throw new Error(msg || "ล้างข้อมูลไม่สำเร็จ");
    }

    const payload = (data ?? {}) as {
      module?: PurgeModuleKey;
      deleted?: Record<string, number>;
    };
    return {
      module: payload.module ?? moduleKey,
      deleted: payload.deleted ?? {},
    };
  },
};
