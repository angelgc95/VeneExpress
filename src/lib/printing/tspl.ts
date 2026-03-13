import type { BarcodeLabelPrintData, TsplPrintJob } from "@/lib/printing/types";

const escapeTsplText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "'")
    .replace(/\r?\n/g, " ")
    .trim();

const isEan13Value = (value: string) => /^\d{13}$/.test(value);

const buildBarcodeCommand = (label: BarcodeLabelPrintData) => {
  const barcodeType = isEan13Value(label.barcodeValue) ? "EAN13" : "128";
  const narrow = barcodeType === "EAN13" ? 3 : 2;
  const wide = barcodeType === "EAN13" ? 6 : 4;

  return [
    `BARCODE 70,180,"${barcodeType}",220,1,0,${narrow},${wide},"${escapeTsplText(label.barcodeValue)}"`,
    `TEXT 70,440,"3",0,2,2,"${escapeTsplText(label.humanReadableCode)}"`,
  ].join("\n");
};

const createJobId = () => globalThis.crypto?.randomUUID?.() ?? `print-job-${Date.now()}`;

export const buildBarcodeTsplPayload = (labels: BarcodeLabelPrintData[]) =>
  labels
    .map((label) =>
      [
        "SIZE 4.00,6.00",
        "GAP 0.12,0",
        "DIRECTION 1",
        "REFERENCE 0,0",
        "CLS",
        'TEXT 70,70,"3",0,1,1,"VeneExpress"',
        buildBarcodeCommand(label),
        "PRINT 1,1",
      ].join("\n"),
    )
    .join("\n");

export const buildBarcodeTsplJob = (
  labels: BarcodeLabelPrintData[],
  printerId: string | null,
): TsplPrintJob => ({
  id: createJobId(),
  type: "barcode-label",
  printerId,
  labelSize: "4x6",
  payload: buildBarcodeTsplPayload(labels),
  labels,
  createdAt: new Date().toISOString(),
});

const buildTestTsplPayload = (createdAt: string) => {
  const timestamp = createdAt.slice(0, 16).replace("T", " ");
  return [
    "SIZE 4.00,6.00",
    "GAP 0.12,0",
    "DIRECTION 1",
    "REFERENCE 0,0",
    "CLS",
    'TEXT 60,60,"3",0,2,2,"VeneExpress"',
    'TEXT 60,120,"3",0,1,1,"Printer integration test"',
    'TEXT 60,160,"3",0,1,1,"Bridge-ready TSPL payload"',
    'BARCODE 60,250,"128",180,1,0,2,4,"VENEEXPRESS-TEST"',
    'TEXT 60,470,"3",0,2,2,"TEST PRINT"',
    `TEXT 60,530,"3",0,1,1,"${escapeTsplText(timestamp)} UTC"`,
    "PRINT 1,1",
  ].join("\n");
};

export const buildPrinterTestJob = (printerId: string | null): TsplPrintJob => {
  const createdAt = new Date().toISOString();
  const label: BarcodeLabelPrintData = {
    boxId: "TEST",
    barcodeValue: "VENEEXPRESS-TEST",
    humanReadableCode: "PRINTER TEST",
  };

  return {
    id: createJobId(),
    type: "test-print",
    printerId,
    labelSize: "4x6",
    payload: buildTestTsplPayload(createdAt),
    labels: [label],
    createdAt,
  };
};
