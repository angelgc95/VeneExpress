import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

interface InvoicePrintButtonProps {
  shipmentId: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const InvoicePrintButton = ({
  shipmentId,
  variant = 'outline',
  size = 'sm',
}: InvoicePrintButtonProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: { shipmentId },
      });

      if (error) throw error;
      if (!data?.html) throw new Error(t('No invoice HTML returned'));

      const printWindow = window.open('', '_blank', 'width=900,height=700');
      if (!printWindow) {
        toast.error(t('Pop-up blocked. Please allow pop-ups for this site.'));
        return;
      }

      printWindow.document.write(data.html);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 300);
      };

      toast.success(t('Invoice ready to print'));
    } catch (e: any) {
      toast.error(e.message || t('Failed to generate invoice'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handlePrint} disabled={loading}>
      <Printer className="h-4 w-4 mr-1.5" />
      {loading ? t('Generating...') : t('Print Invoice')}
    </Button>
  );
};

export default InvoicePrintButton;
