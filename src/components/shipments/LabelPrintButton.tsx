import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Download, FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getBoxBarcodeValueFromId, getBoxScanCodeFromId } from '@/lib/scan-codes';
import { printBarcodeLabels } from '@/lib/printing/service';
import type { Box } from '@/types/shipping';

type PrintableBox = Pick<Box, 'id' | 'box_id'>;

interface LabelPrintButtonProps {
  shipmentId: string;
  boxIds?: string[];
  boxes?: PrintableBox[];
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** If true, show only single-box options (no "All boxes") */
  singleBox?: boolean;
}

const LabelPrintButton = ({
  shipmentId,
  boxIds,
  boxes = [],
  label = 'Label Actions',
  variant = 'outline',
  size = 'sm',
  singleBox = false,
}: LabelPrintButtonProps) => {
  const [loadingAction, setLoadingAction] = useState<null | 'barcode-print' | 'barcode-download' | 'detail-print'>(null);

  const loadBoxes = async (): Promise<PrintableBox[]> => {
    const knownBoxes = boxIds?.length
      ? boxes.filter((box) => boxIds.includes(box.id))
      : boxes;

    if (knownBoxes.length > 0) {
      return knownBoxes;
    }

    let query = (supabase as any)
      .from('boxes')
      .select('id, box_id')
      .eq('shipment_id', shipmentId)
      .order('created_at');

    if (boxIds?.length) {
      query = query.in('id', boxIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PrintableBox[];
  };

  const openBrowserPrintWindow = (html: string) => {
    const printWindow = window.open('', '_blank', 'width=420,height=680');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups for this site.');
      return false;
    }

    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 300);
    };

    return true;
  };

  const handleManualPrint = async (labelType: 'barcode' | 'detail') => {
    const { data, error } = await supabase.functions.invoke('generate-label', {
      body: { shipmentId, boxIds, labelType },
    });

    if (error) throw error;
    if (!data?.html) throw new Error('No label HTML returned');

    if (!openBrowserPrintWindow(data.html)) {
      return;
    }

    const typeLabel = labelType === 'barcode' ? 'barcode' : 'detail';
    toast.success(`${data.count} ${typeLabel} label(s) ready to print`);
  };

  const handleDetailsPrint = async () => {
    setLoadingAction('detail-print');
    try {
      await handleManualPrint('detail');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate labels');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBarcodePrint = async () => {
    setLoadingAction('barcode-print');
    try {
      const printableBoxes = await loadBoxes();
      if (printableBoxes.length === 0) {
        throw new Error('No boxes available to print');
      }

      const printResult = await printBarcodeLabels(
        printableBoxes.map((box) => ({
          boxId: box.box_id,
          humanReadableCode: box.box_id,
          barcodeValue:
            getBoxBarcodeValueFromId(box.box_id) ??
            getBoxScanCodeFromId(box.box_id) ??
            box.box_id,
        })),
      );

      if (printResult.status === 'bridge') {
        toast.success(printResult.message);
        return;
      }

      toast(printResult.message);
      await handleManualPrint('barcode');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate labels');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBarcodeDownload = async () => {
    setLoadingAction('barcode-download');
    try {
      await handleManualPrint('barcode');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate labels');
    } finally {
      setLoadingAction(null);
    }
  };

  const buttonLabel = () => {
    if (!label) return null;
    if (loadingAction === 'barcode-print') return 'Printing...';
    if (loadingAction === 'barcode-download') return 'Preparing...';
    if (loadingAction === 'detail-print') return 'Opening...';
    return label;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={loadingAction !== null}
          aria-label={singleBox ? 'Label actions for this box' : 'Label actions'}
          title={singleBox ? 'Label actions for this box' : 'Label actions'}
        >
          <Printer className={`h-4 w-4 ${label ? 'mr-1.5' : ''}`} />
          {buttonLabel()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {singleBox ? 'This box' : 'All boxes'}
        </DropdownMenuLabel>
        <DropdownMenuLabel className="max-w-56 text-[11px] font-normal leading-relaxed text-muted-foreground">
          Direct barcode print uses the local TSPL bridge when it is ready. Browser or PDF fallback is always available.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleBarcodePrint()} className="flex-col items-start gap-1 py-2">
          <div className="flex items-center gap-2 font-medium">
            <Printer className="h-4 w-4" />
            Print barcode label
          </div>
          <div className="text-xs leading-relaxed text-muted-foreground">
            Sends a TSPL job when the printer workflow is ready. Otherwise opens the browser fallback automatically.
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleBarcodeDownload()} className="flex-col items-start gap-1 py-2">
          <div className="flex items-center gap-2 font-medium">
            <Download className="h-4 w-4" />
            Download barcode label
          </div>
          <div className="text-xs leading-relaxed text-muted-foreground">
            Opens the browser or PDF label directly, without trying a printer bridge first.
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleDetailsPrint()} className="flex-col items-start gap-1 py-2">
          <div className="flex items-center gap-2 font-medium">
            <FileText className="h-4 w-4" />
            Print details label
          </div>
          <div className="text-xs leading-relaxed text-muted-foreground">
            Opens the details label in the browser print flow for paper, PDF, or thermal output.
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LabelPrintButton;
