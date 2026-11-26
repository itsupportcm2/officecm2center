export const THAI_MONTHS_FULL = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

export const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;

export const THAI_WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;

/** Convert Buddhist Era year (>= 2400) to Gregorian Common Era year. */
export function toGregorianYear(year: number): number {
  return year >= 2400 ? year - 543 : year;
}

/** Validate a year/month/day tuple (supporting C.E. or B.E. year) and format as YYYY-MM-DD. */
export function buildValidIsoDate(year: number, month: number, day: number): string | null {
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

/** Convert ISO YYYY-MM-DD string to Thai DD/MM/BBBB display format (e.g. 26/11/2569). */
export function isoToThaiDisplay(iso?: string | null): string {
  if (!iso) return "";
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return "";
  return `${match[3]}/${match[2]}/${year + 543}`;
}

/** Parse typed/pasted Thai DD/MM/BBBB, DD/MM/YYYY, compact 8-digit, or ISO YYYY-MM-DD into YYYY-MM-DD. */
export function parseThaiInputToIso(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Compact 8 digits: DDMMBBBB or DDMMYYYY (e.g. 26112569 or 26112026)
  const compact = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) {
    return buildValidIsoDate(Number(compact[3]), Number(compact[2]), Number(compact[1]));
  }

  // DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY (1-2 digit day/month + 4-digit B.E. or C.E. year)
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    return buildValidIsoDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  // ISO YYYY-MM-DD or YYYY/MM/DD (B.E. or C.E. year)
  const ymd = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymd) {
    return buildValidIsoDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  return null;
}

/** Auto-format numeric typing as DD/MM/BBBB while preserving manual slash editing. */
export function formatTypingThaiDate(raw: string): string {
  const cleaned = raw.replace(/[-.]/g, "/").replace(/[^\d/]/g, "");
  if (!cleaned) return "";

  if (!cleaned.includes("/")) {
    const digits = cleaned.slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  const collapsed = cleaned.replace(/\/{2,}/g, "/");
  const parts = collapsed.split("/");
  if (parts.length === 2) {
    const [p0, p1] = parts;
    if (p0.length > 2) {
      return `${p0.slice(0, 2)}/${p0.slice(2, 4)}/${p1.slice(0, 4)}`;
    }
    if (p1.length > 2) {
      return `${p0.slice(0, 2)}/${p1.slice(0, 2)}/${p1.slice(2, 6)}`;
    }
    return `${p0.slice(0, 2)}/${p1}`;
  }

  return `${parts[0].slice(0, 2)}/${parts[1].slice(0, 2)}/${parts.slice(2).join("").slice(0, 4)}`;
}

/** Check whether an ISO YYYY-MM-DD date falls within optional min/max ISO bounds. */
export function isIsoInRange(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}
