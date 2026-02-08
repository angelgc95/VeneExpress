import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';

interface LabelPrintButtonProps {
  shipmentId: string;
  boxIds?: string[];
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const LabelPrintButton = ({
  shipmentId,
  boxIds,
  label = 'Print Labels',
  variant = 'outline',
  size = 'sm',
}: LabelPrintButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-label', {
        body: { shipmentId, boxIds },
      });

      if (error) throw error;
      if (!data?.html) throw new Error('No label HTML returned');

      // Open print window
      const printWindow = window.open('', '_blank', 'width=450,height=650');
      if (!printWindow) {
        toast.error('Pop-up blocked. Please allow pop-ups for this site.');
        return;
      }

      printWindow.document.write(data.html);
      printWindow.document.close();

      // Wait for content to render, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 300);
      };

      toast.success(`${data.count} label(s) ready to print`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate labels');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handlePrint} disabled={loading}>
      <Printer className="h-4 w-4 mr-1.5" />
      {loading ? 'Generating...' : label}
    </Button>
  );
};

export default LabelPrintButton;
