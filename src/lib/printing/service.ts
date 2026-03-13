import {
  getDefaultPrinter,
  loadPrinterSettings,
} from "@/lib/printing/storage";
import { buildBarcodeTsplJob, buildPrinterTestJob } from "@/lib/printing/tspl";
import type {
  BarcodeLabelPrintData,
  PrintBridgeStatus,
  PrintDispatchResult,
  PrinterConfig,
} from "@/lib/printing/types";

const getBridge = () => (typeof window === "undefined" ? undefined : window.VeneExpressPrintBridge);

const resolvePrinter = (printerId?: string | null): PrinterConfig | null => {
  const settings = loadPrinterSettings();
  if (printerId) {
    return settings.printers.find((printer) => printer.id === printerId) ?? null;
  }
  return getDefaultPrinter(settings);
};

const manualFallback = (
  reason: string,
  job: ReturnType<typeof buildBarcodeTsplJob>,
  printer: PrinterConfig | null,
): PrintDispatchResult => ({
  status: "manual-fallback",
  reason,
  job,
  printer,
});

export const getPrintBridgeStatus = async (): Promise<PrintBridgeStatus> => {
  const bridge = getBridge();
  if (!bridge) {
    return {
      available: false,
      connected: false,
      name: "Bridge not connected",
    };
  }

  if (!bridge.getStatus) {
    return {
      available: true,
      connected: true,
      name: "Bridge detected",
    };
  }

  try {
    const status = await bridge.getStatus();
    return {
      available: true,
      connected: status.connected ?? true,
      name: status.name?.trim() || "Bridge detected",
    };
  } catch {
    return {
      available: true,
      connected: false,
      name: "Bridge detected, status unavailable",
    };
  }
};

export const printBarcodeLabels = async (
  labels: BarcodeLabelPrintData[],
  printerId?: string | null,
): Promise<PrintDispatchResult> => {
  const printer = resolvePrinter(printerId);
  const job = buildBarcodeTsplJob(labels, printer?.id ?? null);
  const bridge = getBridge();

  if (!printer) {
    return manualFallback("No default printer configured", job, null);
  }

  if (printer.connectionType === "manual") {
    return manualFallback("Printer is configured for manual browser printing", job, printer);
  }

  if (!bridge?.printTsplJob) {
    return manualFallback("Print bridge not connected", job, printer);
  }

  await bridge.printTsplJob(job, printer);
  return {
    status: "bridge",
    job,
    printer,
  };
};

export const sendPrinterTestLabel = async (
  printerId?: string | null,
): Promise<PrintDispatchResult> => {
  const printer = resolvePrinter(printerId);
  const job = buildPrinterTestJob(printer?.id ?? null);
  const bridge = getBridge();

  if (!printer) {
    return {
      status: "manual-fallback",
      reason: "No printer selected",
      job,
      printer: null,
    };
  }

  if (printer.connectionType === "manual") {
    return {
      status: "manual-fallback",
      reason: "Manual printer profiles do not support direct bridge test prints",
      job,
      printer,
    };
  }

  if (bridge?.testPrint) {
    await bridge.testPrint(job, printer);
    return {
      status: "bridge",
      job,
      printer,
    };
  }

  if (bridge?.printTsplJob) {
    await bridge.printTsplJob(job, printer);
    return {
      status: "bridge",
      job,
      printer,
    };
  }

  return {
    status: "manual-fallback",
    reason: "Print bridge not connected",
    job,
    printer,
  };
};
