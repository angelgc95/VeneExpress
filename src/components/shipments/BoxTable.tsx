import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LabelPrintButton from '@/components/shipments/LabelPrintButton';
import { getBoxScanCodeFromId } from '@/lib/scan-codes';
import { useTranslation } from '@/hooks/useTranslation';
import type { Box, PricingRule, ServiceType, StandardItem } from '@/types/shipping';

interface BoxTableProps {
  shipmentId: string;
  shipmentIdStr: string;
  serviceType: ServiceType;
  isFinalized?: boolean;
}

const BoxTable = ({ shipmentId, shipmentIdStr, serviceType, isFinalized }: BoxTableProps) => {
  const queryClient = useQueryClient();
  const { isStaff } = useAuth();
  const { t } = useTranslation();
  const [newBox, setNewBox] = useState({ length: '', width: '', height: '' });
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [overrideBox, setOverrideBox] = useState<Box | null>(null);
  const [overridePrice, setOverridePrice] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const { data: boxes = [] } = useQuery({
    queryKey: ['boxes', shipmentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('boxes')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at');
      if (error) throw error;
      return data as Box[];
    },
  });

  const { data: pricingRule } = useQuery({
    queryKey: ['pricing-rule', serviceType],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pricing_rules')
        .select('*')
        .eq('service_type', serviceType)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PricingRule | null;
    },
  });

  const { data: standardItems = [] } = useQuery({
    queryKey: ['standard-items'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('standard_items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as StandardItem[];
    },
  });

  const nextBoxId = () => {
    const nextBoxNumber = boxes.reduce((max, box) => {
      const match = box.box_id.match(/-(\d{2})$/);
      if (!match) return max;
      return Math.max(max, Number(match[1]));
    }, 0) + 1;
    const boxNum = String(nextBoxNumber).padStart(2, '0');
    return `${shipmentIdStr}-${boxNum}`;
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const l = parseFloat(newBox.length);
      const w = parseFloat(newBox.width);
      const h = parseFloat(newBox.height);
      if (isNaN(l) || isNaN(w) || isNaN(h) || l <= 0 || w <= 0 || h <= 0) {
        throw new Error(t('Enter valid dimensions (positive numbers)'));
      }
      const rate = pricingRule ? parseFloat(String(pricingRule.rate_per_ft3)) : 25;
      const volume = (l * w * h) / 1728;
      const calcPrice = Math.round(volume * rate * 100) / 100;

      const { error } = await (supabase as any).from('boxes').insert({
        box_id: nextBoxId(),
        shipment_id: shipmentId,
        length_in: l,
        width_in: w,
        height_in: h,
        applied_rate: rate,
        calculated_price: calcPrice,
        final_price: calcPrice,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes', shipmentId] });
      setNewBox({ length: '', width: '', height: '' });
      toast.success(t('Box added'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStandardItemMutation = useMutation({
    mutationFn: async ({ name, price }: { name: string; price: number }) => {
      const { error } = await (supabase as any).from('boxes').insert({
        box_id: nextBoxId(),
        shipment_id: shipmentId,
        length_in: 0,
        width_in: 0,
        height_in: 0,
        applied_rate: 0,
        calculated_price: price,
        final_price: price,
        notes: name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes', shipmentId] });
      toast.success(t('Item added'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCustomItemMutation = useMutation({
    mutationFn: async () => {
      if (!customItemName.trim()) throw new Error(t('Enter item name'));
      const price = parseFloat(customItemPrice);
      if (isNaN(price) || price < 0) throw new Error(t('Enter a valid price'));
      const { error } = await (supabase as any).from('boxes').insert({
        box_id: nextBoxId(),
        shipment_id: shipmentId,
        length_in: 0,
        width_in: 0,
        height_in: 0,
        applied_rate: 0,
        calculated_price: price,
        final_price: price,
        notes: customItemName.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes', shipmentId] });
      setCustomItemName('');
      setCustomItemPrice('');
      toast.success(t('Custom item added'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (boxId: string) => {
      const { error } = await (supabase as any).from('boxes').delete().eq('id', boxId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes', shipmentId] });
      toast.success(t('Box removed'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const overrideMutation = useMutation({
    mutationFn: async () => {
      if (!overrideBox) return;
      const price = parseFloat(overridePrice);
      if (isNaN(price) || price < 0) throw new Error(t('Enter a valid price'));
      if (!overrideReason.trim()) throw new Error(t('Override reason is required'));
      const { error } = await (supabase as any).from('boxes').update({
        price_override: price,
        override_reason: overrideReason.trim(),
        final_price: price,
      }).eq('id', overrideBox.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes', shipmentId] });
      setOverrideBox(null);
      toast.success(t('Price overridden'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = boxes.reduce((sum, b) => sum + (parseFloat(String(b.final_price)) || 0), 0);
  const totalVolume = boxes.reduce((sum, b) => sum + (parseFloat(String(b.volume_ft3)) || 0), 0);

  const previewVolume = (() => {
    const l = parseFloat(newBox.length), w = parseFloat(newBox.width), h = parseFloat(newBox.height);
    if (isNaN(l) || isNaN(w) || isNaN(h) || l <= 0 || w <= 0 || h <= 0) return null;
    return (l * w * h) / 1728;
  })();

  const rate = pricingRule ? parseFloat(String(pricingRule.rate_per_ft3)) : 25;

  return (
    <div className="space-y-4">
      {/* UI-only check for better UX — actual security is enforced by RLS policies */}
      {!isFinalized && isStaff && (
        <div className="space-y-4">
          {/* Standard Items */}
          {standardItems.length > 0 && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('Quick Add Standard Items')}</Label>
              <div className="flex flex-wrap gap-2">
                {standardItems.map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    size="sm"
                    onClick={() => addStandardItemMutation.mutate({ name: item.name, price: item.price })}
                    disabled={addStandardItemMutation.isPending}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {item.name} - ${parseFloat(String(item.price)).toFixed(2)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Item (black themed) */}
          <div className="p-4 bg-foreground text-background rounded-lg space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-background/70">{t('Custom Item')}</Label>
            <div className="flex items-end gap-3">
              <div className="space-y-1 flex-1">
                <Input
                  className="bg-background text-foreground"
                  placeholder={t('Item description')}
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                />
              </div>
              <div className="space-y-1 w-28">
                <Input
                  className="bg-background text-foreground"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t('Price')}
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => addCustomItemMutation.mutate()}
                disabled={addCustomItemMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-1" /> {t('Add')}
              </Button>
            </div>
          </div>

          {/* Dimension-based Box */}
          <div className="flex flex-wrap items-end gap-3 p-4 bg-muted rounded-lg">
            <div className="space-y-1">
              <Label className="text-xs">L (in)</Label>
              <Input
                className="w-20"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={newBox.length}
                onChange={(e) => setNewBox(b => ({ ...b, length: e.target.value }))}
              />
            </div>
            <span className="text-muted-foreground pb-2">×</span>
            <div className="space-y-1">
              <Label className="text-xs">W (in)</Label>
              <Input
                className="w-20"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={newBox.width}
                onChange={(e) => setNewBox(b => ({ ...b, width: e.target.value }))}
              />
            </div>
            <span className="text-muted-foreground pb-2">×</span>
            <div className="space-y-1">
              <Label className="text-xs">H (in)</Label>
              <Input
                className="w-20"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={newBox.height}
                onChange={(e) => setNewBox(b => ({ ...b, height: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addMutation.mutate()}
              />
            </div>
            {previewVolume !== null && (
              <div className="text-sm text-muted-foreground pb-2">
                = {previewVolume.toFixed(2)} ft³ × ${rate} = <span className="font-semibold text-foreground">${(previewVolume * rate).toFixed(2)}</span>
              </div>
            )}
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="mb-0">
              <Plus className="h-4 w-4 mr-1" /> {t('Add Box')}
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Box ID')}</TableHead>
            <TableHead>{t('Description')}</TableHead>
            <TableHead>{t('Volume (ft³)')}</TableHead>
            <TableHead>{t('Rate')}</TableHead>
            <TableHead>{t('Price')}</TableHead>
            <TableHead className="w-28">{t('Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {boxes.map((box) => {
            const isStdItem = parseFloat(String(box.length_in)) === 0 && parseFloat(String(box.width_in)) === 0;
            const scanCode = getBoxScanCodeFromId(box.box_id);
            return (
              <TableRow key={box.id}>
                <TableCell className="text-sm">
                  <div className="font-mono-id">{box.box_id}</div>
                  {scanCode && (
                    <div className="text-xs text-muted-foreground">
                      {t('Scan code:')} <span className="font-mono-id">{scanCode}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {isStdItem
                    ? (box.notes || t('Standard Item'))
                    : `${parseFloat(String(box.length_in))} × ${parseFloat(String(box.width_in))} × ${parseFloat(String(box.height_in))} in`
                  }
                </TableCell>
                <TableCell className="text-sm">
                  {isStdItem ? '—' : parseFloat(String(box.volume_ft3)).toFixed(2)}
                </TableCell>
                <TableCell className="text-sm">
                  {isStdItem ? '—' : `$${parseFloat(String(box.applied_rate)).toFixed(2)}`}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  ${parseFloat(String(box.final_price)).toFixed(2)}
                  {box.price_override !== null && (
                    <span className="ml-1 text-xs text-warning" title={box.override_reason || ''}>⚡</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <LabelPrintButton
                      shipmentId={shipmentId}
                      boxIds={[box.id]}
                      boxes={[box]}
                      label=""
                      size="icon"
                      variant="ghost"
                      singleBox
                    />
                    {isStaff && !isFinalized && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={t('Override price')}
                          onClick={() => {
                            setOverrideBox(box);
                            setOverridePrice(String(box.final_price));
                            setOverrideReason(box.override_reason || '');
                          }}
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteMutation.mutate(box.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {boxes.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {t('No boxes yet. Add your first box above.')}
              </TableCell>
            </TableRow>
          )}
          {boxes.length > 0 && (
            <TableRow className="bg-muted/50 font-medium">
              <TableCell>{t('Total ({count} items)', { count: boxes.length })}</TableCell>
              <TableCell />
              <TableCell>{totalVolume > 0 ? totalVolume.toFixed(2) : '—'}</TableCell>
              <TableCell />
              <TableCell className="text-lg">${total.toFixed(2)}</TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={!!overrideBox} onOpenChange={(open) => !open && setOverrideBox(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {t('Override Price — {boxId}', { boxId: overrideBox?.box_id ?? '' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('New Price ($)')}</Label>
              <Input type="number" step="0.01" value={overridePrice} onChange={(e) => setOverridePrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('Reason (required)')}</Label>
              <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder={t('Why is this price being overridden?')} />
            </div>
            <Button className="w-full" onClick={() => overrideMutation.mutate()} disabled={overrideMutation.isPending}>
              {overrideMutation.isPending ? t('Saving...') : t('Save Override')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BoxTable;
