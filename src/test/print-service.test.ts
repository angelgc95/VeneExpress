import { describe, expect, it } from "vitest";

import { describePrinterWorkflow } from "@/lib/printing/service";
import type { PrintBridgeStatus, PrinterConfig } from "@/lib/printing/types";

const disconnectedBridge: PrintBridgeStatus = {
  available: false,
  connected: false,
  name: "Bridge unavailable",
};

const connectedBridge: PrintBridgeStatus = {
  available: true,
  connected: true,
  name: "Bridge detected",
};

const manualPrinter: PrinterConfig = {
  id: "printer-1",
  name: "Front Desk",
  model: "TSC TE244",
  connectionType: "manual",
  createdAt: "2026-03-13T00:00:00.000Z",
  updatedAt: "2026-03-13T00:00:00.000Z",
};

const bridgePrinter: PrinterConfig = {
  ...manualPrinter,
  id: "printer-2",
  name: "Warehouse USB",
  connectionType: "bridge-usb",
};

describe("printer workflow states", () => {
  it("reports not configured when no printer is selected", () => {
    expect(describePrinterWorkflow(null, disconnectedBridge)).toMatchObject({
      state: "not-configured",
      label: "Not configured",
    });
  });

  it("reports configured for manual fallback printers", () => {
    expect(describePrinterWorkflow(manualPrinter, disconnectedBridge)).toMatchObject({
      state: "configured",
      label: "Configured",
    });
  });

  it("reports bridge unavailable for direct printers without the helper", () => {
    expect(describePrinterWorkflow(bridgePrinter, disconnectedBridge)).toMatchObject({
      state: "bridge-unavailable",
      label: "Bridge unavailable",
    });
  });

  it("reports ready when the bridge printer and helper are both available", () => {
    expect(describePrinterWorkflow(bridgePrinter, connectedBridge)).toMatchObject({
      state: "ready",
      label: "Ready",
    });
  });
});
