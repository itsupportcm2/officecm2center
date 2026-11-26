import { describe, expect, it } from "vitest";
import { formatNationalId, validateMigrantDocument } from "../services/migrantWorkerService";
import { EXPORT_HEADERS, parseDate } from "./migrantWorkerIO";
import {
  formatTypingThaiDate,
  isIsoInRange,
  isoToThaiDisplay,
  parseThaiInputToIso,
} from "./thaiDateInput";

describe("formatNationalId", () => {
  it("formats 13 digits with standard Thai ID hyphens and caps length", () => {
    expect(formatNationalId("0050651005434")).toBe("0-0506-51005-43-4");
    expect(formatNationalId("0-0506-51005-43-4")).toBe("0-0506-51005-43-4");
    expect(formatNationalId("0050651005434999")).toBe("0-0506-51005-43-4");
    expect(formatNationalId("00506")).toBe("0-0506");
    expect(formatNationalId(null)).toBe("");
  });
});

describe("validateMigrantDocument", () => {
  it("accepts valid PASSPORT_RED, PASSPORT_GREEN, PINK_CARD, and TEN_YEAR_CARD documents", () => {
    expect(
      validateMigrantDocument({
        documentType: "PASSPORT_RED",
        documentNumber: "ME123456",
        issuedOn: "2024-01-01",
        expiresOn: "2029-01-01",
        visaIssuedOn: "2024-01-01",
        visaExpiresOn: "2026-01-01",
        workPermitIssuedOn: "2024-01-01",
        workPermitExpiresOn: "2026-01-01",
        remindDays: 45,
      }),
    ).toEqual([]);

    expect(
      validateMigrantDocument({
        documentType: "PASSPORT_GREEN",
        documentNumber: "CC998877",
        issuedOn: "2024-01-01",
        expiresOn: "2028-01-01",
        visaExpiresOn: "2026-01-01",
        remindDays: 30,
      }),
    ).toEqual([]);

    expect(
      validateMigrantDocument({
        documentType: "PINK_CARD",
        documentNumber: "PK-554433",
        issuedOn: "2024-01-01",
        expiresOn: "2026-01-01",
        remindDays: 0,
      }),
    ).toEqual([]);

    expect(
      validateMigrantDocument({
        documentType: "TEN_YEAR_CARD",
        documentNumber: "TY-112233",
        issuedOn: "2024-01-01",
        expiresOn: "2034-01-01",
        areaPermitIssuedOn: null,
        areaPermitExpiresOn: null,
        remindDays: 60,
      }),
    ).toEqual([]);
  });

  it("enforces required issuedOn, prefix rules, area permit dates, date order, and remindDays bounds", () => {
    const redMissingIssuedAndWrongPrefix = validateMigrantDocument({
      documentType: "PASSPORT_RED",
      documentNumber: "AB123456",
      issuedOn: null,
      expiresOn: "2029-01-01",
      visaExpiresOn: null,
    });
    expect(redMissingIssuedAndWrongPrefix).toContain(
      "เลขที่พาสปอร์ตสีแดงต้องขึ้นต้นด้วยตัว M (เช่น ME123456)",
    );
    expect(redMissingIssuedAndWrongPrefix).toContain("กรุณาระบุวันออกเอกสาร");
    expect(redMissingIssuedAndWrongPrefix).toContain("กรุณาระบุวันหมดอายุวีซ่า");

    const greenWrongPrefix = validateMigrantDocument({
      documentType: "PASSPORT_GREEN",
      documentNumber: "ME123456",
      issuedOn: "2024-01-01",
      expiresOn: "2028-01-01",
      visaExpiresOn: "2026-01-01",
    });
    expect(greenWrongPrefix).toContain("เลขที่พาสปอร์ตสีเขียวต้องขึ้นต้นด้วย CC หรือ CA");

    const reversedDatesAndBadRemind = validateMigrantDocument({
      documentType: "TEN_YEAR_CARD",
      documentNumber: "TY-112233",
      issuedOn: "2026-05-01",
      expiresOn: "2026-04-01",
      areaPermitIssuedOn: "2026-07-01",
      areaPermitExpiresOn: "2026-06-01",
      workPermitIssuedOn: "2026-06-01",
      workPermitExpiresOn: "2026-05-01",
      remindDays: 400,
    });
    expect(reversedDatesAndBadRemind).toContain("วันหมดอายุเอกสารต้องไม่ก่อนวันออกเอกสาร");
    expect(reversedDatesAndBadRemind).toContain("วันหมดอายุใบออกนอกพื้นที่ต้องไม่ก่อนวันออกใบออกนอกพื้นที่");
    expect(reversedDatesAndBadRemind).toContain("วันหมดอายุใบอนุญาตทำงานต้องไม่ก่อนวันออกใบอนุญาตทำงาน");
    expect(reversedDatesAndBadRemind).toContain("จำนวนวันแจ้งเตือนล่วงหน้าต้องอยู่ระหว่าง 0 ถึง 365 วัน");
  });
});

describe("parseDate", () => {
  it("parses Gregorian ISO and DD/MM/YYYY dates", () => {
    expect(parseDate("2026-03-15")).toBe("2026-03-15");
    expect(parseDate("15/03/2026")).toBe("2026-03-15");
    expect(parseDate("15-03-2026")).toBe("2026-03-15");
  });

  it("converts Thai Buddhist Era years (>= 2400) to Gregorian", () => {
    expect(parseDate("2569-03-15")).toBe("2026-03-15");
    expect(parseDate("15/03/2569")).toBe("2026-03-15");
    expect(parseDate("15.03.2569")).toBe("2026-03-15");
    expect(parseDate("15.03.2026")).toBe("2026-03-15");
  });

  it("strips trailing timestamps and parses Thai month names and Excel serials", () => {
    expect(parseDate("15/03/2569 00:00:00")).toBe("2026-03-15");
    expect(parseDate("2026-03-15T00:00:00Z")).toBe("2026-03-15");
    expect(parseDate("15 มี.ค. 2569")).toBe("2026-03-15");
    expect(parseDate("15 มีนาคม 2569")).toBe("2026-03-15");
    expect(parseDate("15-มี.ค.-69")).toBe("2026-03-15");
    expect(parseDate("5 ก.พ. 2569")).toBe("2026-02-05");
    expect(parseDate(46096)).toBe("2026-03-15");
    expect(parseDate("46096")).toBe("2026-03-15");
    const beSerial = Math.round((Date.UTC(2569, 2, 15) - Date.UTC(1899, 11, 30)) / 86_400_000);
    expect(parseDate(beSerial)).toBe("2026-03-15");
    expect(parseDate("03/25/2026")).toBe("2026-03-25");
    expect(parseDate("29/02/2567")).toBe("2024-02-29");
  });

  it("rejects invalid calendar dates", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("29/02/2568")).toBeNull();
    expect(parseDate("2026-13-01")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("thaiDateInput", () => {
  it("converts between ISO C.E. and Thai DD/MM/BBBB formats", () => {
    expect(isoToThaiDisplay("2026-11-26")).toBe("26/11/2569");
    expect(isoToThaiDisplay("")).toBe("");
    expect(isoToThaiDisplay(null)).toBe("");

    expect(parseThaiInputToIso("26/11/2569")).toBe("2026-11-26");
    expect(parseThaiInputToIso("26/11/2026")).toBe("2026-11-26");
    expect(parseThaiInputToIso("26112569")).toBe("2026-11-26");
    expect(parseThaiInputToIso("26112026")).toBe("2026-11-26");
    expect(parseThaiInputToIso("5/3/2569")).toBe("2026-03-05");
    expect(parseThaiInputToIso("2026-03-15")).toBe("2026-03-15");
    expect(parseThaiInputToIso("29/02/2568")).toBeNull();
  });

  it("formats typed digits and checks ISO bounds", () => {
    expect(formatTypingThaiDate("26112569")).toBe("26/11/2569");
    expect(formatTypingThaiDate("26-11-2569")).toBe("26/11/2569");

    // Simulate continuous keystroke-by-keystroke typing without manually pressing '/'
    let typed = "";
    const steps: string[] = [];
    for (const ch of "26112569") {
      typed = formatTypingThaiDate(typed + ch);
      steps.push(typed);
    }
    expect(steps).toEqual([
      "2",
      "26",
      "26/1",
      "26/11",
      "26/11/2",
      "26/11/25",
      "26/11/256",
      "26/11/2569",
    ]);

    // Manual slash entry and smooth backspace progression
    expect(formatTypingThaiDate("5/3/2569")).toBe("5/3/2569");
    expect(formatTypingThaiDate("26/11/")).toBe("26/11/");
    expect(formatTypingThaiDate("26/11")).toBe("26/11");
    expect(formatTypingThaiDate("26/1")).toBe("26/1");

    expect(isIsoInRange("2026-11-26", "2026-11-01", "2026-11-30")).toBe(true);
    expect(isIsoInRange("2026-10-31", "2026-11-01", "2026-11-30")).toBe(false);
  });
});

describe("EXPORT_HEADERS", () => {
  it("contains all 21 columns including phone", () => {
    expect(EXPORT_HEADERS).toHaveLength(21);
    expect(EXPORT_HEADERS).toContain("เบอร์โทรศัพท์");
  });
});
