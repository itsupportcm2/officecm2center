import { describe, expect, it } from "vitest";
import { formatNationalId, validateMigrantDocument } from "../services/migrantWorkerService";
import { EXPORT_HEADERS, parseDate } from "./migrantWorkerIO";

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
  });

  it("rejects invalid calendar dates", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("2026-13-01")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("EXPORT_HEADERS", () => {
  it("contains all 21 columns including phone", () => {
    expect(EXPORT_HEADERS).toHaveLength(21);
    expect(EXPORT_HEADERS).toContain("เบอร์โทรศัพท์");
  });
});
