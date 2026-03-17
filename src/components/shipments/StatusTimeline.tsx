import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from '@/hooks/useTranslation';
import type { StatusEvent, ShipmentStatus } from '@/types/shipping';

const STATUSES: ShipmentStatus[] = ['Label Created', 'Received', 'Shipped', 'Arrived in Destination', 'Released by Customs', 'Ready for Delivery', 'Delivered'];

const statusColor = (status: ShipmentStatus) => {
  const map: Record<ShipmentStatus, string> = {
    'Label Created': 'bg-muted-foreground',
    'Received': 'bg-warning',
    'Shipped': 'bg-info',
    'Arrived in Destination': 'bg-primary',
    'Released by Customs': 'bg-primary',
    'Ready for Delivery': 'bg-warning',
    'Delivered': 'bg-success',
    'Cancelled': 'bg-destructive',
  };
  return map[status] ?? 'bg-muted-foreground';
};

interface StatusTimelineProps {
  shipmentId: string;
  currentStatus: ShipmentStatus;
  onStatusChange?: () => void;
}

const StatusTimeline = ({ shipmentId, currentStatus, onStatusChange }: StatusTimelineProps) => {
  const queryClient = useQueryClient();
  const { user, isStaff } = useAuth();
  const { t, dateLocale } = useTranslation();
  const [newStatus, setNewStatus] = useState<string>('');
  const [note, setNote] = useState('');

  const { data: events = [] } = useQuery({
    queryKey: ['status-events', shipmentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('status_events')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as StatusEvent[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newStatus) throw new Error(t('Select a status'));

      const { error: eventError } = await (supabase as any).from('status_events').insert({
        shipment_id: shipmentId,
        status: newStatus,
        note: note.trim() || null,
        actor_user_id: user?.id,
      });
      if (eventError) throw eventError;

      const { error: updateError } = await (supabase as any)
        .from('shipments')
        .update({ status: newStatus })
        .eq('id', shipmentId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-events', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['shipment'] });
      setNewStatus('');
      setNote('');
      onStatusChange?.();
      toast.success(t('Status updated'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* UI-only check for better UX — actual security is enforced by RLS policies */}
      {isStaff && (
        <div className="flex flex-wrap items-end gap-3 p-4 bg-muted rounded-lg">
          <div className="space-y-1 flex-1 min-w-[150px]">
            <Label className="text-xs">{t('New Status')}</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger><SelectValue placeholder={t('Select status...')} /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s} disabled={s === currentStatus}>{t(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">{t('Note (optional)')}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Add a note...')} />
          </div>
          <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newStatus}>
            <Plus className="h-4 w-4 mr-1" /> {t('Update Status')}
          </Button>
        </div>
      )}

      <div className="relative">
        {events.length > 0 && (
          <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border" />
        )}
        <div className="space-y-4">
          {events.map((event, i) => (
            <div key={event.id} className="flex gap-4 relative">
              <div className={`h-6 w-6 rounded-full ${statusColor(event.status)} shrink-0 flex items-center justify-center z-10 ${i === 0 ? 'ring-2 ring-offset-2 ring-offset-card ring-accent' : ''}`}>
                <div className="h-2 w-2 rounded-full bg-card" />
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={i === 0 ? 'default' : 'outline'} className="text-xs">{t(event.status)}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(event.created_at), 'MMM d, yyyy HH:mm', { locale: dateLocale })}
                  </span>
                </div>
                {event.note && (
                  <p className="text-sm text-muted-foreground mt-1">{event.note}</p>
                )}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">{t('No status events yet')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusTimeline;
