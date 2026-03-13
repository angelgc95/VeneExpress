import { describe, expect, it } from "vitest";

import {
  buildLookupCandidates,
  getBoxBarcodeValueFromId,
  getBoxIdFromScanCode,
  getBoxScanCodeFromId,
  getEan13CheckDigit,
  getShipmentIdFromScanCode,
  getShipmentScanCodeFromId,
  isValidEan13,
  normalizeLookupValue,
} from "@/lib/scan-codes";

describe("scan code helpers", () => {
  it("normalizes manual input and scanner whitespace", () => {
    expect(normalizeLookupValue("  ve-2026-000123-07 \n")).toBe("VE-2026-000123-07");
    expect(normalizeLookupValue("2026 000123 07")).toBe("202600012307");
  });

  it("derives manual scan codes from shipment and box ids", () => {
    expect(getShipmentScanCodeFromId("VE-2026-000123")).toBe("2026000123");
    expect(getBoxScanCodeFromId("VE-2026-000123-07")).toBe("202600012307");
  });

  it("builds a valid EAN-13 barcode value for box labels", () => {
    expect(getEan13CheckDigit("202600012307")).toBe("3");
    expect(getBoxBarcodeValueFromId("VE-2026-000123-07")).toBe("2026000123073");
    expect(isValidEan13("2026000123073")).toBe(true);
  });

  it("reconstructs ids from manual scan codes", () => {
    expect(getShipmentIdFromScanCode("2026000123")).toBe("VE-2026-000123");
    expect(getBoxIdFromScanCode("202600012307")).toBe("VE-2026-000123-07");
  });

  it("accepts EAN-13 barcode payloads from printed labels", () => {
    expect(getBoxIdFromScanCode("2026000123073")).toBe("VE-2026-000123-07");
  });

  it("builds box and shipment lookup candidates from a numeric code", () => {
    expect(buildLookupCandidates("2026 000123 07")).toEqual({
      normalizedQuery: "202600012307",
      digitsOnly: "202600012307",
      shipmentIds: ["VE-2026-000123"],
      boxIds: ["VE-2026-000123-07"],
    });
  });

  it("keeps direct ids available as lookup candidates", () => {
    expect(buildLookupCandidates("ve-2026-000123-07")).toEqual({
      normalizedQuery: "VE-2026-000123-07",
      digitsOnly: "202600012307",
      shipmentIds: ["VE-2026-000123"],
      boxIds: ["VE-2026-000123-07"],
    });
  });

  it("strips the EAN-13 check digit before lookup", () => {
    expect(buildLookupCandidates("2026000123073")).toEqual({
      normalizedQuery: "2026000123073",
      digitsOnly: "202600012307",
      shipmentIds: ["VE-2026-000123"],
      boxIds: ["VE-2026-000123-07"],
    });
  });

  it("ignores invalid formats", () => {
    expect(getShipmentScanCodeFromId("bad-id")).toBeNull();
    expect(getBoxScanCodeFromId("VE-2026-123")).toBeNull();
    expect(getShipmentIdFromScanCode("123")).toBeNull();
    expect(getBoxIdFromScanCode("123")).toBeNull();
    expect(isValidEan13("2026000123074")).toBe(false);
  });
});
