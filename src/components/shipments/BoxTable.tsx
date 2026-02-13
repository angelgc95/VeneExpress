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
import type { Box, PricingRule, ServiceType } from '@/types/shipping';

interface BoxTableProps {
  shipmentId: string;
  shipmentIdStr: string;
  serviceType: ServiceType;
  isFinalized?: boolean;
}

const BoxTable = ({ shipmentId, shipmentIdStr, serviceType, isFinalized }: BoxTableProps) => {
  const queryClient = useQueryClient();
  const { isStaff } = useAuth();
  const [newBox, setNewBox] = useState({ length: '', width: '', height: '' });
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

  const addMutation = useMutation({
    mutationFn: async () => {
      const l = parseFloat(newBox.length);
      const w = parseFloat(newBox.width);
      const h = parseFloat(newBox.height);
      if (isNaN(l) || isNaN(w) || isNaN(h) || l <= 0 || w <= 0 || h <= 0) {
        throw new Error('Enter valid dimensions (positive numbers)');
      }
      const rate = pricingRule ? parseFloat(String(pricingRule.rate_per_ft3)) : 25;
      const volume = (l * w * h) / 1728;
      const calcPrice = Math.round(volume * rate * 100) / 100;
      const boxNum = String(boxes.length + 1).padStart(2, '0');
      const boxId = `${shipmentIdStr}-${boxNum}`;

      const { error } = await (supabase as any).from('boxes').insert({
        box_id: boxId,
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
      toast.success('Box added');
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
      toast.success('Box removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const overrideMutation = useMutation({
    mutationFn: async () => {
      if (!overrideBox) return;
      const price = parseFloat(overridePrice);
      if (isNaN(price) || price < 0) throw new Error('Enter a valid price');
      if (!overrideReason.trim()) throw new Error('Override reason is required');
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
      toast.success('Price overridden');
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
            <Plus className="h-4 w-4 mr-1" /> Add Box
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Box ID</TableHead>
            <TableHead>Dimensions (in)</TableHead>
            <TableHead>Volume (ft³)</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Price</TableHead>
            <TableHead className="w-28">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {boxes.map((box) => (
            <TableRow key={box.id}>
              <TableCell className="font-mono-id text-sm">{box.box_id}</TableCell>
              <TableCell className="text-sm">
                {parseFloat(String(box.length_in))} × {parseFloat(String(box.width_in))} × {parseFloat(String(box.height_in))}
              </TableCell>
              <TableCell className="text-sm">{parseFloat(String(box.volume_ft3)).toFixed(2)}</TableCell>
              <TableCell className="text-sm">${parseFloat(String(box.applied_rate)).toFixed(2)}</TableCell>
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
                        title="Override price"
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
          ))}
          {boxes.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No boxes yet. Add your first box above.
              </TableCell>
            </TableRow>
          )}
          {boxes.length > 0 && (
            <TableRow className="bg-muted/50 font-medium">
              <TableCell>Total ({boxes.length} boxes)</TableCell>
              <TableCell />
              <TableCell>{totalVolume.toFixed(2)}</TableCell>
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
            <DialogTitle className="font-heading">Override Price — {overrideBox?.box_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Price ($)</Label>
              <Input type="number" step="0.01" value={overridePrice} onChange={(e) => setOverridePrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Why is this price being overridden?" />
            </div>
            <Button className="w-full" onClick={() => overrideMutation.mutate()} disabled={overrideMutation.isPending}>
              {overrideMutation.isPending ? 'Saving...' : 'Save Override'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BoxTable;
