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
import {
  describePrinterWorkflow,
  getPrintBridgeStatus,
  sendPrinterTestLabel,
} from "@/lib/printing/service";
import { useTranslation } from "@/hooks/useTranslation";
import type {
  PrintBridgeStatus,
  PrinterConfig,
  PrinterConnectionType,
  PrinterWorkflowState,
} from "@/lib/printing/types";

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

const workflowBadgeVariant = (state: PrinterWorkflowState) => {
  switch (state) {
    case "ready":
      return "success" as const;
    case "bridge-unavailable":
      return "warning" as const;
    case "configured":
      return "secondary" as const;
    case "not-configured":
      return "outline" as const;
  }
};

const PrinterSettingsCard = () => {
  const { t } = useTranslation();
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
  const defaultWorkflow = describePrinterWorkflow(defaultPrinter, bridgeStatus);

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
      toast.error(t("Printer name is required"));
      return;
    }

    if (!form.model.trim()) {
      toast.error(t("Printer model is required"));
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
    toast.success(t(form.id ? "Printer profile updated" : "Printer profile saved"));
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
    toast.success(t("Printer removed"));
  };

  const handleDefaultPrinterChange = (printerId: string) => {
    persistSettings(setDefaultPrinter(settings, printerId === "none" ? null : printerId));
  };

  const handleTestPrint = async (printerId?: string | null) => {
    setTestingPrinterId(printerId ?? "__default__");

    try {
      const result = await sendPrinterTestLabel(printerId);
      if (result.status === "bridge") {
        toast.success(t(result.message, result.messageVariables));
      } else {
        toast(t(result.message, result.messageVariables));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send test print";
      toast.error(t(message));
    } finally {
      setTestingPrinterId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-heading">{t("Printing")}</CardTitle>
            <CardDescription>
              {t("Save printer profiles for daily use, keep browser or PDF fallback available, and let a future local bridge take over one-click TSPL printing when it is installed.")}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={workflowBadgeVariant(defaultWorkflow.state)}>{t(defaultWorkflow.label)}</Badge>
            {defaultPrinter && <Badge variant="outline">{defaultPrinter.name}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={workflowBadgeVariant(defaultWorkflow.state)}>{t(defaultWorkflow.label)}</Badge>
              <span className="text-sm font-medium">{t("Default barcode printer")}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(defaultWorkflow.detail, defaultWorkflow.detailVariables)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("Configured means the printer profile is saved. Ready means the profile is saved and the local bridge is available for direct TSPL output.")}
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={bridgeStatus.connected ? "success" : "outline"}>
                {t(bridgeStatus.connected ? "Ready" : "Bridge unavailable")}
              </Badge>
              <span className="text-sm font-medium">{t("Bridge helper")}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {bridgeStatus.connected
                ? t("{bridgeName}. Direct barcode print jobs can be handed off immediately.", {
                    bridgeName: t(bridgeStatus.name),
                  })
                : t("No local helper is connected yet. The app will keep using browser or PDF fallback where needed.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refreshBridgeStatus()} disabled={refreshingBridge}>
              {refreshingBridge ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {t("Refresh bridge status")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("Printer name")}</Label>
            <Input
              placeholder="Warehouse Zebra"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("Printer model")}</Label>
            <Input
              placeholder="TSC TE244"
              value={form.model}
              onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t("Connection type")}</Label>
            <Select
              value={form.connectionType}
              onValueChange={(value: PrinterConnectionType) =>
                setForm((current) => ({ ...current, connectionType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Select printer connection")} />
              </SelectTrigger>
              <SelectContent>
                {CONNECTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSavePrinter}>
            <Printer className="mr-2 h-4 w-4" />
            {t(form.id ? "Update printer profile" : "Save printer profile")}
          </Button>
          {form.id && (
            <Button variant="outline" onClick={() => setForm(EMPTY_FORM)}>
              {t("Cancel edit")}
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
            {t("Send TSPL test print")}
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t("Default barcode printer")}</Label>
            <Select value={settings.defaultPrinterId ?? "none"} onValueChange={handleDefaultPrinterChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("Choose a default printer")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("No default printer")}</SelectItem>
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
              {t("No printers saved yet. Add one to prepare direct TSPL printing later.")}
            </div>
          ) : (
            <div className="space-y-3">
              {settings.printers.map((printer) => {
                const isDefault = settings.defaultPrinterId === printer.id;
                const isTesting = testingPrinterId === printer.id;
                const workflow = describePrinterWorkflow(printer, bridgeStatus);

                return (
                  <div key={printer.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{printer.name}</p>
                          {isDefault && (
                            <Badge variant="secondary">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {t("Default")}
                            </Badge>
                          )}
                          <Badge variant={workflowBadgeVariant(workflow.state)}>{t(workflow.label)}</Badge>
                          <Badge variant={printer.connectionType === "manual" ? "outline" : "info"}>
                            {t(CONNECTION_OPTIONS.find((option) => option.value === printer.connectionType)?.label ?? "")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{printer.model}</p>
                        <p className="text-sm text-muted-foreground">
                          {t(workflow.detail, workflow.detailVariables)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditPrinter(printer)}>
                          {t("Edit")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleTestPrint(printer.id)}
                          disabled={isTesting}
                        >
                          {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
                          {t("Test print")}
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
