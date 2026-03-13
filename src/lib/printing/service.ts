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
  PrinterWorkflowStatus,
} from "@/lib/printing/types";

const getBridge = () => (typeof window === "undefined" ? undefined : window.VeneExpressPrintBridge);

const resolvePrinter = (printerId?: string | null): PrinterConfig | null => {
  const settings = loadPrinterSettings();
  if (printerId) {
    return settings.printers.find((printer) => printer.id === printerId) ?? null;
  }
  return getDefaultPrinter(settings);
};

export const describePrinterWorkflow = (
  printer: PrinterConfig | null,
  bridgeStatus: PrintBridgeStatus,
): PrinterWorkflowStatus => {
  if (!printer) {
    return {
      state: "not-configured",
      label: "Not configured",
      detail: "No default printer is selected yet. Barcode labels will keep using browser or PDF fallback.",
      printer: null,
      bridge: bridgeStatus,
    };
  }

  if (printer.connectionType === "manual") {
    return {
      state: "configured",
      label: "Configured",
      detail: `${printer.name} is saved for browser or PDF fallback. A local bridge is still optional for one-click direct print later.`,
      printer,
      bridge: bridgeStatus,
    };
  }

  if (!bridgeStatus.connected) {
    return {
      state: "bridge-unavailable",
      label: "Bridge unavailable",
      detail: `${printer.name} is configured for direct TSPL print, but the local bridge/helper is not connected yet.`,
      printer,
      bridge: bridgeStatus,
    };
  }

  return {
    state: "ready",
    label: "Ready",
    detail: `${printer.name} is configured and the local bridge is available for direct TSPL printing.`,
    printer,
    bridge: bridgeStatus,
  };
};

const getBarcodeFallbackMessage = (workflow: PrinterWorkflowStatus) => {
  switch (workflow.state) {
    case "not-configured":
      return "No default printer is configured. Opening the browser or PDF barcode label instead.";
    case "configured":
      return "This printer is configured for browser or PDF fallback. Opening the barcode label now.";
    case "bridge-unavailable":
      return "Printer is configured, but the local bridge is unavailable. Opening the browser or PDF barcode label instead.";
    case "ready":
      return "Direct barcode print is ready.";
  }
};

const getTestPrintMessage = (workflow: PrinterWorkflowStatus) => {
  switch (workflow.state) {
    case "not-configured":
      return "TSPL test job prepared, but no default printer is configured yet.";
    case "configured":
      return "TSPL test job prepared. This printer profile is browser or PDF fallback only until a direct bridge is used.";
    case "bridge-unavailable":
      return "TSPL test job prepared, but the local bridge is unavailable so it was not sent.";
    case "ready":
      return "TSPL test print sent successfully.";
  }
};

const manualFallback = (
  message: string,
  workflow: PrinterWorkflowStatus,
  job: ReturnType<typeof buildBarcodeTsplJob> | ReturnType<typeof buildPrinterTestJob>,
  printer: PrinterConfig | null,
): PrintDispatchResult => ({
  status: "manual-fallback",
  message,
  workflow,
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
  const bridgeStatus = await getPrintBridgeStatus();
  const workflow = describePrinterWorkflow(printer, bridgeStatus);
  const bridge = getBridge();

  if (workflow.state !== "ready" || !bridge?.printTsplJob) {
    return manualFallback(getBarcodeFallbackMessage(workflow), workflow, job, printer);
  }

  await bridge.printTsplJob(job, printer);
  return {
    status: "bridge",
    message: `Sent ${labels.length} barcode label(s) to ${printer.name}.`,
    workflow,
    job,
    printer,
  };
};

export const sendPrinterTestLabel = async (
  printerId?: string | null,
): Promise<PrintDispatchResult> => {
  const printer = resolvePrinter(printerId);
  const job = buildPrinterTestJob(printer?.id ?? null);
  const bridgeStatus = await getPrintBridgeStatus();
  const workflow = describePrinterWorkflow(printer, bridgeStatus);
  const bridge = getBridge();

  if (workflow.state !== "ready") {
    return manualFallback(getTestPrintMessage(workflow), workflow, job, printer);
  }

  if (bridge?.testPrint) {
    await bridge.testPrint(job, printer);
    return {
      status: "bridge",
      message: `Sent TSPL test print to ${printer.name}.`,
      workflow,
      job,
      printer,
    };
  }

  if (bridge?.printTsplJob) {
    await bridge.printTsplJob(job, printer);
    return {
      status: "bridge",
      message: `Sent TSPL test print to ${printer.name}.`,
      workflow,
      job,
      printer,
    };
  }

  return manualFallback(getTestPrintMessage(workflow), workflow, job, printer);
};
