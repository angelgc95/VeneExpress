import { describe, expect, it } from "vitest";

import {
  buildBarcodeTsplJob,
  buildBarcodeTsplPayload,
  buildPrinterTestJob,
} from "@/lib/printing/tspl";

describe("TSPL barcode printing", () => {
  it("generates 4x6 TSPL payloads for barcode labels", () => {
    const payload = buildBarcodeTsplPayload([
      {
        boxId: "VE-2026-000123-07",
        barcodeValue: "2026000123073",
        humanReadableCode: "VE-2026-000123-07",
      },
    ]);

    expect(payload).toContain("SIZE 4.00,6.00");
    expect(payload).toContain('BARCODE 70,180,"EAN13"');
    expect(payload).toContain('TEXT 70,440,"3",0,2,2,"VE-2026-000123-07"');
  });

  it("wraps the payload in a printable job structure", () => {
    const job = buildBarcodeTsplJob(
      [
        {
          boxId: "VE-2026-000123-08",
          barcodeValue: "2026000123080",
          humanReadableCode: "VE-2026-000123-08",
        },
      ],
      "printer-1",
    );

    expect(job.type).toBe("barcode-label");
    expect(job.printerId).toBe("printer-1");
    expect(job.labelSize).toBe("4x6");
    expect(job.payload).toContain("PRINT 1,1");
  });

  it("builds a realistic TSPL test print payload", () => {
    const job = buildPrinterTestJob("printer-1");

    expect(job.type).toBe("test-print");
    expect(job.payload).toContain('TEXT 60,120,"3",0,1,1,"Printer integration test"');
    expect(job.payload).toContain('BARCODE 60,250,"128"');
    expect(job.payload).toContain('TEXT 60,470,"3",0,2,2,"TEST PRINT"');
  });
});
