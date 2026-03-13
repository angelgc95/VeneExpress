import type { PrinterConfig, PrinterSettingsState } from "@/lib/printing/types";

const STORAGE_KEY = "veneexpress.printer-settings";

export const EMPTY_PRINTER_SETTINGS: PrinterSettingsState = {
  printers: [],
  defaultPrinterId: null,
};

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const createPrinterId = () => globalThis.crypto?.randomUUID?.() ?? `printer-${Date.now()}`;

export const loadPrinterSettings = (): PrinterSettingsState => {
  if (!canUseStorage()) return EMPTY_PRINTER_SETTINGS;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return EMPTY_PRINTER_SETTINGS;

  try {
    const parsed = JSON.parse(stored) as Partial<PrinterSettingsState>;
    return {
      printers: Array.isArray(parsed.printers) ? parsed.printers : [],
      defaultPrinterId: typeof parsed.defaultPrinterId === "string" ? parsed.defaultPrinterId : null,
    };
  } catch {
    return EMPTY_PRINTER_SETTINGS;
  }
};

export const savePrinterSettings = (settings: PrinterSettingsState) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const upsertPrinter = (
  settings: PrinterSettingsState,
  input: Pick<PrinterConfig, "name" | "model" | "connectionType"> & { id?: string | null },
): PrinterSettingsState => {
  const now = new Date().toISOString();
  const existing = input.id ? settings.printers.find((printer) => printer.id === input.id) : null;
  const printer: PrinterConfig = {
    id: existing?.id ?? createPrinterId(),
    name: input.name,
    model: input.model,
    connectionType: input.connectionType,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const printers = existing
    ? settings.printers.map((candidate) => (candidate.id === printer.id ? printer : candidate))
    : [...settings.printers, printer];

  return {
    printers,
    defaultPrinterId: settings.defaultPrinterId ?? printer.id,
  };
};

export const deletePrinter = (settings: PrinterSettingsState, printerId: string): PrinterSettingsState => {
  const printers = settings.printers.filter((printer) => printer.id !== printerId);
  return {
    printers,
    defaultPrinterId:
      settings.defaultPrinterId === printerId ? printers[0]?.id ?? null : settings.defaultPrinterId,
  };
};

export const setDefaultPrinter = (
  settings: PrinterSettingsState,
  printerId: string | null,
): PrinterSettingsState => ({
  ...settings,
  defaultPrinterId: printerId,
});

export const getDefaultPrinter = (settings: PrinterSettingsState) =>
  settings.printers.find((printer) => printer.id === settings.defaultPrinterId) ?? null;
