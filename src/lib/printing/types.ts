export type PrinterConnectionType =
  | "manual"
  | "bridge-usb"
  | "bridge-network"
  | "bridge-bluetooth";

export interface PrinterConfig {
  id: string;
  name: string;
  model: string;
  connectionType: PrinterConnectionType;
  createdAt: string;
  updatedAt: string;
}

export interface PrinterSettingsState {
  printers: PrinterConfig[];
  defaultPrinterId: string | null;
}

export interface BarcodeLabelPrintData {
  boxId: string;
  barcodeValue: string;
  humanReadableCode: string;
}

export interface TsplPrintJob {
  id: string;
  type: "barcode-label" | "test-print";
  printerId: string | null;
  labelSize: "4x6";
  payload: string;
  labels: BarcodeLabelPrintData[];
  createdAt: string;
}

export interface PrintBridgeStatus {
  available: boolean;
  connected: boolean;
  name: string;
}

export interface PrintDispatchResult {
  status: "bridge" | "manual-fallback";
  reason?: string;
  job: TsplPrintJob;
  printer: PrinterConfig | null;
}

export interface VeneExpressPrintBridge {
  printTsplJob: (job: TsplPrintJob, printer: PrinterConfig) => Promise<void> | void;
  testPrint?: (job: TsplPrintJob, printer: PrinterConfig) => Promise<void> | void;
  getStatus?: () =>
    | Promise<Partial<Pick<PrintBridgeStatus, "connected" | "name">>>
    | Partial<Pick<PrintBridgeStatus, "connected" | "name">>;
}

declare global {
  interface Window {
    VeneExpressPrintBridge?: VeneExpressPrintBridge;
  }
}
