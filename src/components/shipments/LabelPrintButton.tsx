import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
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
  label = 'Print Labels',
  variant = 'outline',
  size = 'sm',
  singleBox = false,
}: LabelPrintButtonProps) => {
  const [loading, setLoading] = useState(false);

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

  const handlePrint = async (labelType: 'barcode' | 'detail') => {
    setLoading(true);
    try {
      if (labelType === 'detail') {
        await handleManualPrint('detail');
        return;
      }

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
        toast.success(`Sent ${printableBoxes.length} barcode label(s) to ${printResult.printer?.name ?? 'printer'}`);
        return;
      }

      toast(printResult.reason === 'No default printer configured'
        ? 'No default printer is configured. Opening browser print instead.'
        : printResult.reason === 'Printer is configured for manual browser printing'
          ? 'This printer profile uses manual browser printing. Opening printable barcode labels.'
          : 'Local print bridge not connected. Opening printable barcode labels instead.');

      await handleManualPrint('barcode');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate labels');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={loading}>
          <Printer className={`h-4 w-4 ${label ? 'mr-1.5' : ''}`} />
          {label ? (loading ? 'Working...' : label) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {singleBox ? 'This Box' : 'All Boxes'}
        </DropdownMenuLabel>
        <DropdownMenuLabel className="max-w-56 text-[11px] font-normal leading-relaxed text-muted-foreground">
          Barcode print uses the local TSPL bridge when configured, then falls back to browser print.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handlePrint('detail')}>
          📋 Details Label
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePrint('barcode')}>
          ▮▮▮ Barcode Label
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LabelPrintButton;
