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

interface LabelPrintButtonProps {
  shipmentId: string;
  boxIds?: string[];
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** If true, show only single-box options (no "All boxes") */
  singleBox?: boolean;
}

const LabelPrintButton = ({
  shipmentId,
  boxIds,
  label = 'Print Labels',
  variant = 'outline',
  size = 'sm',
  singleBox = false,
}: LabelPrintButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handlePrint = async (labelType: 'barcode' | 'detail') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-label', {
        body: { shipmentId, boxIds, labelType },
      });

      if (error) throw error;
      if (!data?.html) throw new Error('No label HTML returned');

      const w = labelType === 'barcode' ? 280 : 280;
      const h = labelType === 'barcode' ? 200 : 350;
      const printWindow = window.open('', '_blank', `width=${w},height=${h}`);
      if (!printWindow) {
        toast.error('Pop-up blocked. Please allow pop-ups for this site.');
        return;
      }

      printWindow.document.write(data.html);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 300);
      };

      const typeLabel = labelType === 'barcode' ? 'barcode' : 'detail';
      toast.success(`${data.count} ${typeLabel} label(s) ready to print`);
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
          <Printer className="h-4 w-4 mr-1.5" />
          {loading ? 'Generating...' : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {singleBox ? 'This Box' : 'All Boxes'}
        </DropdownMenuLabel>
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
