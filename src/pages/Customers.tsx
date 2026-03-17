import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Users, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from '@/hooks/useTranslation';
import type { Customer } from '@/types/shipping';

interface ShippingAddressForm {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

const getShippingAddressForm = (customer: Customer): ShippingAddressForm => ({
  name: customer.shipping_name || `${customer.first_name} ${customer.last_name}`.trim(),
  phone: customer.shipping_phone || customer.phone || '',
  line1: customer.shipping_line1 || '',
  line2: customer.shipping_line2 || '',
  city: customer.shipping_city || '',
  state: customer.shipping_state || '',
  postal_code: customer.shipping_postal_code || '',
  country: customer.shipping_country || 'US',
});

const Customers = () => {
  const queryClient = useQueryClient();
  const { t, dateLocale } = useTranslation();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [shippingForm, setShippingForm] = useState<ShippingAddressForm>({
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  });
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', notes: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.first_name.trim() || !form.last_name.trim()) throw new Error(t('Name is required'));
      const { error } = await (supabase as any).from('customers').insert({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDialogOpen(false);
      setForm({ first_name: '', last_name: '', phone: '', email: '', notes: '' });
      toast.success(t('Customer created'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: linkedShipments, error: linkedShipmentsError } = await (supabase as any)
        .from('shipments')
        .select('customer_id')
        .in('customer_id', ids);
      if (linkedShipmentsError) throw linkedShipmentsError;

      const linkedIds = new Set((linkedShipments || []).map((s: any) => s.customer_id));
      const deletableIds = ids.filter((id) => !linkedIds.has(id));
      const blocked = ids.filter((id) => linkedIds.has(id));

      if (deletableIds.length > 0) {
        const { error } = await (supabase as any)
          .from('customers')
          .delete()
          .in('id', deletableIds);
        if (error) throw error;
      }

      return { deleted: deletableIds.length, blocked };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (result.blocked.length === 0) {
        setSelected(new Set());
        toast.success(t('{count} customer(s) deleted', { count: result.deleted }));
      } else if (result.deleted > 0) {
        toast.success(t('{count} deleted', { count: result.deleted }));
        setBlockedIds(result.blocked);
        setUnlinkDialogOpen(true);
      } else {
        setBlockedIds(result.blocked);
        setUnlinkDialogOpen(true);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const forceDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await (supabase as any).rpc('delete_customers_with_related_data', {
        p_customer_ids: ids,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      setSelected(new Set());
      setBlockedIds([]);
      setUnlinkDialogOpen(false);
      toast.success(t('{count} customer(s) and linked shipments deleted', { count }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateShippingAddressMutation = useMutation({
    mutationFn: async () => {
      if (!editingCustomer) return;

      const shippingName = shippingForm.name.trim() || `${editingCustomer.first_name} ${editingCustomer.last_name}`.trim();
      if (!shippingName || !shippingForm.line1.trim() || !shippingForm.city.trim()) {
        throw new Error(t('Enter name, address line 1, and city to save a shipping address.'));
      }

      const { error } = await (supabase as any)
        .from('customers')
        .update({
          shipping_name: shippingName,
          shipping_phone: shippingForm.phone.trim() || null,
          shipping_line1: shippingForm.line1.trim(),
          shipping_line2: shippingForm.line2.trim() || null,
          shipping_city: shippingForm.city.trim(),
          shipping_state: shippingForm.state.trim() || null,
          shipping_postal_code: shippingForm.postal_code.trim() || null,
          shipping_country: shippingForm.country.trim() || 'US',
        })
        .eq('id', editingCustomer.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditingCustomer(null);
      toast.success(t('Shipping address saved'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return !q || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
      || c.phone?.toLowerCase().includes(q)
      || c.email?.toLowerCase().includes(q);
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
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

  const openShippingEditor = (customer: Customer) => {
    setEditingCustomer(customer);
    setShippingForm(getShippingAddressForm(customer));
  };

  const getShippingAddressSummary = (customer: Customer) => {
    if (!customer.shipping_line1) return t('No address saved yet');
    const cityLine = [customer.shipping_city, customer.shipping_state].filter(Boolean).join(', ');
    return [customer.shipping_line1, cityLine || customer.shipping_country].filter(Boolean).join(' • ');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">{t('Customers')}</h1>
          <p className="text-muted-foreground text-sm">{t('{count} total customers', { count: customers.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(Array.from(selected))}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('Delete {count}', { count: selected.size })}
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="h-4 w-4 mr-2" /> {t('Add Customer')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">{t('New Customer')}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('First Name *')}</Label>
                    <Input value={form.first_name} onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('Last Name *')}</Label>
                    <Input value={form.last_name} onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('Phone')}</Label>
                    <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('Email')}</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('Notes')}</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? t('Creating...') : t('Create Customer')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('Search customers by name, phone, or email...')}
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                <TableHead>{t('Name')}</TableHead>
                <TableHead>{t('Phone')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('Email')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('Shipping Address')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('Created')}</TableHead>
                <TableHead className="w-24">{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} data-state={selected.has(c.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleOne(c.id)}
                      aria-label={t('Select {label}', { label: `${c.first_name} ${c.last_name}` })}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                  <TableCell className="font-mono-id text-sm">{c.phone || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{c.email || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {getShippingAddressSummary(c)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {format(new Date(c.created_at), 'MMM d, yyyy', { locale: dateLocale })}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openShippingEditor(c)}>
                      {t('Edit')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {search ? t('No customers match your search') : t('No customers yet')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={unlinkDialogOpen} onOpenChange={(open) => {
        setUnlinkDialogOpen(open);
        if (!open) setBlockedIds([]);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">{t('Customers have linked shipments')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('{count} customer(s) have linked shipments and cannot be deleted directly. Would you like to unlink and delete all related shipments before deleting these customers? This action is irreversible.', { count: blockedIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setBlockedIds([]); setSelected(new Set()); }}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => forceDeleteMutation.mutate(blockedIds)}
              disabled={forceDeleteMutation.isPending}
            >
              {forceDeleteMutation.isPending ? t('Deleting...') : t('Yes, delete all')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{t('Edit shipping address')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingCustomer && (
              <div>
                <p className="font-medium">{editingCustomer.first_name} {editingCustomer.last_name}</p>
                <p className="text-sm text-muted-foreground">
                  {t('This saved address will autofill future shipments for this customer.')}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('Contact Name *')}</Label>
                <Input value={shippingForm.name} onChange={(e) => setShippingForm((current) => ({ ...current, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('Phone')}</Label>
                <Input value={shippingForm.phone} onChange={(e) => setShippingForm((current) => ({ ...current, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('Address Line 1 *')}</Label>
              <Input value={shippingForm.line1} onChange={(e) => setShippingForm((current) => ({ ...current, line1: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('Address Line 2')}</Label>
              <Input value={shippingForm.line2} onChange={(e) => setShippingForm((current) => ({ ...current, line2: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>{t('City')} *</Label>
                <Input value={shippingForm.city} onChange={(e) => setShippingForm((current) => ({ ...current, city: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('State')}</Label>
                <Input value={shippingForm.state} onChange={(e) => setShippingForm((current) => ({ ...current, state: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('Postal Code')}</Label>
                <Input value={shippingForm.postal_code} onChange={(e) => setShippingForm((current) => ({ ...current, postal_code: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('Country')}</Label>
                <Input value={shippingForm.country} onChange={(e) => setShippingForm((current) => ({ ...current, country: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full" onClick={() => updateShippingAddressMutation.mutate()} disabled={updateShippingAddressMutation.isPending}>
              {updateShippingAddressMutation.isPending ? t('Saving...') : t('Save shipping address')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
