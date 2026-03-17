import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { FileText, Lock, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import InvoicePrintButton from '@/components/shipments/InvoicePrintButton';
import { useTranslation } from '@/hooks/useTranslation';
import type { Box, Invoice, InvoiceLineItem, Payment, PaymentMethod } from '@/types/shipping';

interface InvoiceSectionProps {
  shipmentId: string;
  boxes: Box[];
}

const InvoiceSection = ({ shipmentId, boxes }: InvoiceSectionProps) => {
  const queryClient = useQueryClient();
  const { isStaff } = useAuth();
  const { t, dateLocale } = useTranslation();
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [adjustment, setAdjustment] = useState('');

  const { data: invoice } = useQuery({
    queryKey: ['invoice', shipmentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('invoices')
        .select('*')
        .eq('shipment_id', shipmentId)
        .maybeSingle();
      if (error) throw error;
      return data as Invoice | null;
    },
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['line-items', invoice?.id],
    enabled: !!invoice,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice!.id)
        .order('type');
      if (error) throw error;
      return data as InvoiceLineItem[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', invoice?.id],
    enabled: !!invoice,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payments')
        .select('*')
        .eq('invoice_id', invoice!.id)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (boxes.length === 0) throw new Error(t('Add boxes before generating invoice'));

      const { data: invNum, error: rpcErr } = await (supabase as any).rpc('generate_invoice_number');
      if (rpcErr) throw rpcErr;

      const subtotal = boxes.reduce((sum, b) => sum + (parseFloat(String(b.final_price)) || 0), 0);
      const adj = parseFloat(adjustment) || 0;
      const total = subtotal + adj;

      const { data: inv, error: invErr } = await (supabase as any).from('invoices').insert({
        invoice_number: invNum,
        shipment_id: shipmentId,
        subtotal,
        adjustment: adj,
        total,
        balance: total,
      }).select('id').single();
      if (invErr) throw invErr;

      const items: Array<{
        invoice_id: string;
        type: 'shipping' | 'discount' | 'misc';
        description: string;
        qty: number;
        unit_price: number;
        line_total: number;
      }> = boxes.map((box) => ({
        invoice_id: inv.id,
        type: 'shipping' as const,
        description: `Shipping Box ${box.box_id} (${parseFloat(String(box.volume_ft3)).toFixed(2)} ft³ × $${parseFloat(String(box.applied_rate)).toFixed(2)})`,
        qty: 1,
        unit_price: parseFloat(String(box.final_price)),
        line_total: parseFloat(String(box.final_price)),
      }));

      if (adj !== 0) {
        items.push({
          invoice_id: inv.id,
          type: adj > 0 ? 'misc' : 'discount',
          description: t(adj > 0 ? 'Additional charges' : 'Discount'),
          qty: 1,
          unit_price: adj,
          line_total: adj,
        });
      }

      const { error: liErr } = await (supabase as any).from('invoice_line_items').insert(items);
      if (liErr) throw liErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', shipmentId] });
      toast.success(t('Invoice generated'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) return;
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) throw new Error(t('Enter a valid amount'));

      const { error: payErr } = await (supabase as any).from('payments').insert({
        invoice_id: invoice.id,
        method: paymentMethod,
        amount,
        reference: paymentRef.trim() || null,
      });
      if (payErr) throw payErr;

      const newPaid = parseFloat(String(invoice.paid_amount)) + amount;
      const invoiceTotal = parseFloat(String(invoice.total));
      const newBalance = invoiceTotal - newPaid;
      const newStatus = newBalance <= 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Unpaid';

      const { error: updErr } = await (supabase as any).from('invoices').update({
        paid_amount: newPaid,
        balance: Math.max(0, newBalance),
        payment_status: newStatus,
      }).eq('id', invoice.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setPaymentAmount('');
      setPaymentRef('');
      toast.success(t('Payment recorded'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) return;
      const { error } = await (supabase as any).from('invoices').update({
        is_finalized: true,
        finalized_at: new Date().toISOString(),
      }).eq('id', invoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', shipmentId] });
      toast.success(t('Invoice finalized — pricing is now locked'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paymentStatusVariant = (status: string) => {
    if (status === 'Paid') return 'success' as const;
    if (status === 'Partial') return 'warning' as const;
    return 'destructive' as const;
  };

  if (!invoice) {
    return (
      <div className="text-center py-8 space-y-4">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <p className="text-muted-foreground">{t('No invoice generated yet')}</p>
        {/* UI-only check for better UX — actual security is enforced by RLS policies */}
        {isStaff && (
          <div className="max-w-xs mx-auto space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">{t('Adjustment (+/-)')}</Label>
              <Input
                type="number"
                step="0.01"
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || boxes.length === 0}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <FileText className="h-4 w-4 mr-2" />
              {generateMutation.isPending ? t('Generating...') : t('Generate Invoice')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-heading font-semibold text-lg">{invoice.invoice_number}</h3>
          <p className="text-sm text-muted-foreground">
            {t('Created {date}', {
              date: format(new Date(invoice.created_at), 'MMM d, yyyy', { locale: dateLocale }),
            })}
            {invoice.is_finalized && ` • ${t('Finalized')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={paymentStatusVariant(invoice.payment_status)}>{t(invoice.payment_status)}</Badge>
          {invoice.is_finalized && <Badge variant="outline"><Lock className="h-3 w-3 mr-1" /> {t('Locked')}</Badge>}
          <InvoicePrintButton shipmentId={shipmentId} />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Description')}</TableHead>
            <TableHead className="text-right">{t('Qty')}</TableHead>
            <TableHead className="text-right">{t('Unit Price')}</TableHead>
            <TableHead className="text-right">{t('Total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="text-sm">{item.description}</TableCell>
              <TableCell className="text-right text-sm">{item.qty}</TableCell>
              <TableCell className="text-right text-sm">${parseFloat(String(item.unit_price)).toFixed(2)}</TableCell>
              <TableCell className="text-right text-sm font-medium">${parseFloat(String(item.line_total)).toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('Subtotal')}</span>
            <span>${parseFloat(String(invoice.subtotal)).toFixed(2)}</span>
          </div>
          {parseFloat(String(invoice.adjustment)) !== 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('Adjustment')}</span>
              <span>{parseFloat(String(invoice.adjustment)) > 0 ? '+' : ''}${parseFloat(String(invoice.adjustment)).toFixed(2)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>{t('Total')}</span>
            <span>${parseFloat(String(invoice.total)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-success">
            <span>{t('Paid')}</span>
            <span>${parseFloat(String(invoice.paid_amount)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>{t('Balance')}</span>
            <span>${parseFloat(String(invoice.balance)).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {payments.length > 0 && (
        <div>
          <h4 className="font-heading font-semibold mb-2">{t('Payments')}</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Date')}</TableHead>
                <TableHead>{t('Method')}</TableHead>
                <TableHead>{t('Reference')}</TableHead>
                <TableHead className="text-right">{t('Amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{format(new Date(p.paid_at), 'MMM d, yyyy HH:mm', { locale: dateLocale })}</TableCell>
                  <TableCell className="text-sm capitalize">{t(p.method === 'cash' ? 'Cash' : p.method === 'card' ? 'Card' : p.method === 'other' ? 'Other' : 'Zelle')}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.reference || '—'}</TableCell>
                  <TableCell className="text-right text-sm font-medium">${parseFloat(String(p.amount)).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {isStaff && !invoice.is_finalized && (
        <div className="space-y-4">
          <Separator />
          <h4 className="font-heading font-semibold">{t('Record Payment')}</h4>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('Amount ($)')}</Label>
              <Input
                className="w-28"
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('Method')}</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t('Cash')}</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="card">{t('Card')}</SelectItem>
                  <SelectItem value="other">{t('Other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <Label className="text-xs">{t('Reference')}</Label>
              <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder={t('Optional ref #')} />
            </div>
            <Button size="sm" onClick={() => payMutation.mutate()} disabled={payMutation.isPending}>
              <CreditCard className="h-4 w-4 mr-1" /> {t('Record')}
            </Button>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => finalizeMutation.mutate()}
              disabled={finalizeMutation.isPending}
            >
              <Lock className="h-4 w-4 mr-1" /> {t('Finalize Invoice')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceSection;
