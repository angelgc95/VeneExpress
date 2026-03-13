import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Printer, RefreshCw, Trash2, Wrench } from "lucide-react";
import {
  EMPTY_PRINTER_SETTINGS,
  deletePrinter,
  getDefaultPrinter,
  loadPrinterSettings,
  savePrinterSettings,
  setDefaultPrinter,
  upsertPrinter,
} from "@/lib/printing/storage";
import { getPrintBridgeStatus, sendPrinterTestLabel } from "@/lib/printing/service";
import type { PrintBridgeStatus, PrinterConfig, PrinterConnectionType } from "@/lib/printing/types";

const CONNECTION_OPTIONS: Array<{ value: PrinterConnectionType; label: string }> = [
  { value: "manual", label: "Manual browser print" },
  { value: "bridge-usb", label: "Local bridge (USB)" },
  { value: "bridge-network", label: "Local bridge (Network)" },
  { value: "bridge-bluetooth", label: "Local bridge (Bluetooth)" },
];

const EMPTY_FORM = {
  id: null as string | null,
  name: "",
  model: "",
  connectionType: "manual" as PrinterConnectionType,
};

const PrinterSettingsCard = () => {
  const [settings, setSettings] = useState(EMPTY_PRINTER_SETTINGS);
  const [bridgeStatus, setBridgeStatus] = useState<PrintBridgeStatus>({
    available: false,
    connected: false,
    name: "Bridge not connected",
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  const [refreshingBridge, setRefreshingBridge] = useState(false);

  const defaultPrinter = getDefaultPrinter(settings);

  const persistSettings = (nextSettings: typeof settings) => {
    setSettings(nextSettings);
    savePrinterSettings(nextSettings);
  };

  const refreshBridgeStatus = async () => {
    setRefreshingBridge(true);
    try {
      setBridgeStatus(await getPrintBridgeStatus());
    } finally {
      setRefreshingBridge(false);
    }
  };

  useEffect(() => {
    setSettings(loadPrinterSettings());
    void refreshBridgeStatus();
  }, []);

  const handleSavePrinter = () => {
    if (!form.name.trim()) {
      toast.error("Printer name is required");
      return;
    }

    if (!form.model.trim()) {
      toast.error("Printer model is required");
      return;
    }

    const nextSettings = upsertPrinter(settings, {
      id: form.id,
      name: form.name.trim(),
      model: form.model.trim(),
      connectionType: form.connectionType,
    });

    persistSettings(nextSettings);
    setForm(EMPTY_FORM);
    toast.success(form.id ? "Printer updated" : "Printer saved");
  };

  const handleEditPrinter = (printer: PrinterConfig) => {
    setForm({
      id: printer.id,
      name: printer.name,
      model: printer.model,
      connectionType: printer.connectionType,
    });
  };

  const handleDeletePrinter = (printerId: string) => {
    persistSettings(deletePrinter(settings, printerId));
    if (form.id === printerId) {
      setForm(EMPTY_FORM);
    }
    toast.success("Printer removed");
  };

  const handleDefaultPrinterChange = (printerId: string) => {
    persistSettings(setDefaultPrinter(settings, printerId === "none" ? null : printerId));
  };

  const handleTestPrint = async (printerId?: string | null) => {
    setTestingPrinterId(printerId ?? "__default__");

    try {
      const result = await sendPrinterTestLabel(printerId);
      if (result.status === "bridge") {
        toast.success(`Test print sent to ${result.printer?.name ?? "printer"}`);
      } else {
        toast(result.reason ?? "A local print bridge is required for direct test prints");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send test print";
      toast.error(message);
    } finally {
      setTestingPrinterId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-heading">Printing</CardTitle>
            <CardDescription>
              Barcode direct print is bridge-ready for TSPL printers. Browsers still fall back to manual
              print when no local helper is connected, especially on iPhone Safari.
            </CardDescription>
          </div>
          <Badge variant={bridgeStatus.connected ? "success" : "outline"}>
            {bridgeStatus.connected ? bridgeStatus.name : "Bridge not connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <div className="flex-1">
            <p className="text-sm font-medium">Bridge status</p>
            <p className="text-sm text-muted-foreground">
              {bridgeStatus.connected
                ? "TSPL jobs can be handed off to the local print bridge."
                : "No print bridge detected. Barcode print buttons will keep using browser print fallback."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshBridgeStatus()} disabled={refreshingBridge}>
            {refreshingBridge ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Printer name</Label>
            <Input
              placeholder="Warehouse Zebra"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Printer model</Label>
            <Input
              placeholder="TSC TE244"
              value={form.model}
              onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Connection type</Label>
            <Select
              value={form.connectionType}
              onValueChange={(value: PrinterConnectionType) =>
                setForm((current) => ({ ...current, connectionType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select printer connection" />
              </SelectTrigger>
              <SelectContent>
                {CONNECTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSavePrinter}>
            <Printer className="mr-2 h-4 w-4" />
            {form.id ? "Update printer" : "Save printer"}
          </Button>
          {form.id && (
            <Button variant="outline" onClick={() => setForm(EMPTY_FORM)}>
              Cancel edit
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => void handleTestPrint(defaultPrinter?.id ?? null)}
            disabled={!defaultPrinter || testingPrinterId === (defaultPrinter?.id ?? "__default__")}
          >
            {testingPrinterId === (defaultPrinter?.id ?? "__default__") ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wrench className="mr-2 h-4 w-4" />
            )}
            Test default printer
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Default printer</Label>
            <Select value={settings.defaultPrinterId ?? "none"} onValueChange={handleDefaultPrinterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a default printer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default printer</SelectItem>
                {settings.printers.map((printer) => (
                  <SelectItem key={printer.id} value={printer.id}>
                    {printer.name} ({printer.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {settings.printers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No printers saved yet. Add one to prepare direct TSPL printing later.
            </div>
          ) : (
            <div className="space-y-3">
              {settings.printers.map((printer) => {
                const isDefault = settings.defaultPrinterId === printer.id;
                const isTesting = testingPrinterId === printer.id;

                return (
                  <div key={printer.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{printer.name}</p>
                          {isDefault && (
                            <Badge variant="secondary">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Default
                            </Badge>
                          )}
                          <Badge variant={printer.connectionType === "manual" ? "outline" : "info"}>
                            {CONNECTION_OPTIONS.find((option) => option.value === printer.connectionType)?.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{printer.model}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditPrinter(printer)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleTestPrint(printer.id)}
                          disabled={isTesting}
                        >
                          {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
                          Test
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeletePrinter(printer.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PrinterSettingsCard;
