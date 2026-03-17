import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Package, RefreshCw, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from '@/hooks/useTranslation';
import type { Shipment, ShipmentStatus } from '@/types/shipping';

const statusVariant = (status: ShipmentStatus) => {
  const map: Record<ShipmentStatus, 'secondary' | 'warning' | 'info' | 'default' | 'success' | 'destructive'> = {
    'Label Created': 'secondary', 'Received': 'warning', 'Shipped': 'info', 'Arrived in Destination': 'default',
    'Released by Customs': 'default', 'Ready for Delivery': 'warning', 'Delivered': 'success', 'Cancelled': 'destructive',
  };
  return map[status] ?? 'secondary';
};

const ALL_STATUSES: ShipmentStatus[] = ['Label Created', 'Received', 'Shipped', 'Arrived in Destination', 'Released by Customs', 'Ready for Delivery', 'Delivered', 'Cancelled'];

const Shipments = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, dateLocale } = useTranslation();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { data: shipments = [] } = useQuery({
    queryKey: ['shipments'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('shipments')
        .select('*, customers(first_name, last_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (Shipment & { customers: { first_name: string; last_name: string } })[];
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: ShipmentStatus }) => {
      const { error } = await (supabase as any)
        .from('shipments')
        .update({ status })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, { ids, status }) => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setSelected(new Set());
      setBulkStatus('');
      toast.success(t('{count} shipment(s) updated to "{status}"', { count: ids.length, status: t(status) }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelShipmentsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase as any)
        .from('shipments')
        .update({ status: 'Cancelled' })
        .in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setSelected(new Set());
      setCancelDialogOpen(false);
      toast.success(t('{count} shipment(s) cancelled', { count }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = shipments.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || s.shipment_id.toLowerCase().includes(q)
      || `${s.customers?.first_name} ${s.customers?.last_name}`.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkStatusChange = () => {
    if (!bulkStatus || selected.size === 0) return;
    bulkStatusMutation.mutate({ ids: Array.from(selected), status: bulkStatus as ShipmentStatus });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">{t('Shipments')}</h1>
          <p className="text-muted-foreground text-sm">{t('{count} total shipments', { count: shipments.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('Set status...')} />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleBulkStatusChange}
                disabled={!bulkStatus || bulkStatusMutation.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('Update {count}', { count: selected.size })}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setCancelDialogOpen(true)}
                disabled={cancelShipmentsMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {t('Cancel {count}', { count: selected.size })}
              </Button>
            </div>
          )}
          <Button onClick={() => navigate('/shipments/new')} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> {t('New Shipment')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Search by ID or customer...')}
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('All Statuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('All Statuses')}</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleAll}
                    aria-label={t('Select all')}
                  />
                </TableHead>
                <TableHead>{t('Shipment ID')}</TableHead>
                <TableHead>{t('Customer')}</TableHead>
                <TableHead>{t('Service')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('Created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/50"
                  data-state={selected.has(s.id) ? 'selected' : undefined}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={() => toggleOne(s.id)}
                      aria-label={t('Select {label}', { label: s.shipment_id })}
                    />
                  </TableCell>
                  <TableCell className="font-mono-id font-medium text-sm" onClick={() => navigate(`/shipments/${s.id}`)}>
                    {s.shipment_id}
                  </TableCell>
                  <TableCell onClick={() => navigate(`/shipments/${s.id}`)}>
                    {s.customers?.first_name} {s.customers?.last_name}
                  </TableCell>
                  <TableCell onClick={() => navigate(`/shipments/${s.id}`)}>
                    <Badge variant={s.service_type === 'AIR' ? 'info' : 'secondary'}>{s.service_type}</Badge>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/shipments/${s.id}`)}>
                    <Badge variant={statusVariant(s.status)}>{t(s.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden md:table-cell" onClick={() => navigate(`/shipments/${s.id}`)}>
                    {format(new Date(s.created_at), 'MMM d, yyyy', { locale: dateLocale })}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {search || statusFilter !== 'all' ? t('No shipments match your filters') : t('No shipments yet')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              {t('Cancel {count} shipment(s)?', { count: selected.size })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('This will mark the selected shipment(s) as "Cancelled". You can change the status back later if needed.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Go Back')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelShipmentsMutation.mutate(Array.from(selected))}
              disabled={cancelShipmentsMutation.isPending}
            >
              {cancelShipmentsMutation.isPending ? t('Cancelling...') : t('Yes, cancel shipments')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Shipments;
