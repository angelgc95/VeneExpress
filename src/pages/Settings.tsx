import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, Shield, Plus, Trash2 } from 'lucide-react';
import type { CompanySettings, PricingRule, StandardItem } from '@/types/shipping';

const Settings = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: company } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('company_settings').select('*').single();
      if (error) throw error;
      return data as CompanySettings;
    },
  });

  const { data: pricingRules = [] } = useQuery({
    queryKey: ['pricing-rules'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('pricing_rules').select('*').order('service_type');
      if (error) throw error;
      return data as PricingRule[];
    },
  });

  const { data: standardItems = [] } = useQuery({
    queryKey: ['standard-items'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('standard_items').select('*').order('sort_order');
      if (error) throw error;
      return data as StandardItem[];
    },
  });

  const [companyForm, setCompanyForm] = useState({ name: '', phone: '', address: '', email: '' });
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [ruleRate, setRuleRate] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemPrice, setEditItemPrice] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  useEffect(() => {
    if (company) {
      setCompanyForm({
        name: company.name || '',
        phone: company.phone || '',
        address: company.address || '',
        email: company.email || '',
      });
    }
  }, [company]);

  const saveCompanyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('company_settings').update({
        name: companyForm.name.trim(),
        phone: companyForm.phone.trim() || null,
        address: companyForm.address.trim() || null,
        email: companyForm.email.trim() || null,
      }).eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Company settings saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRateMutation = useMutation({
    mutationFn: async () => {
      if (!editingRule) return;
      const rate = parseFloat(ruleRate);
      if (isNaN(rate) || rate <= 0) throw new Error('Enter a valid rate');
      const { error } = await (supabase as any).from('pricing_rules').update({ rate_per_ft3: rate }).eq('id', editingRule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
      setEditingRule(null);
      toast.success('Rate updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAirRuleMutation = useMutation({
    mutationFn: async () => {
      const existing = pricingRules.find(r => r.service_type === 'AIR');
      if (existing) throw new Error('AIR rule already exists');
      const { error } = await (supabase as any).from('pricing_rules').insert({
        name: 'Standard Air Rate',
        route: 'USA→VE',
        service_type: 'AIR',
        rate_per_ft3: 35,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
      toast.success('Air rate added');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItemPriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      const { error } = await (supabase as any).from('standard_items').update({ price }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standard-items'] });
      setEditingItem(null);
      toast.success('Item price updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!newItemName.trim()) throw new Error('Enter item name');
      const price = parseFloat(newItemPrice);
      if (isNaN(price) || price < 0) throw new Error('Enter a valid price');
      const maxSort = standardItems.reduce((max, i) => Math.max(max, i.sort_order), 0);
      const { error } = await (supabase as any).from('standard_items').insert({
        name: newItemName.trim(),
        price,
        sort_order: maxSort + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standard-items'] });
      setNewItemName('');
      setNewItemPrice('');
      toast.success('Item added');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('standard_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standard-items'] });
      toast.success('Item removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // UI-only check for better UX — actual security is enforced by RLS policies on the database
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-2">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold font-heading">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Company Profile</CardTitle>
          <CardDescription>This information appears on invoices and labels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input value={companyForm.name} onChange={(e) => setCompanyForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={companyForm.phone} onChange={(e) => setCompanyForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={companyForm.address} onChange={(e) => setCompanyForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Zelle Email</Label>
            <Input
              type="email"
              placeholder="payments@example.com"
              value={companyForm.email}
              onChange={(e) => setCompanyForm(f => ({ ...f, email: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">This will appear on invoices as "Zelle: your@email.com"</p>
          </div>
          <Button onClick={() => saveCompanyMutation.mutate()} disabled={saveCompanyMutation.isPending}>
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-heading">Pricing Rules</CardTitle>
              <CardDescription>Volume-based rates per cubic foot</CardDescription>
            </div>
            {!pricingRules.find(r => r.service_type === 'AIR') && (
              <Button variant="outline" size="sm" onClick={() => addAirRuleMutation.mutate()}>
                Add AIR Rate
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Rate / ft³</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricingRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{rule.route}</TableCell>
                  <TableCell>
                    <Badge variant={rule.service_type === 'AIR' ? 'info' : 'secondary'}>{rule.service_type}</Badge>
                  </TableCell>
                  <TableCell>
                    {editingRule?.id === rule.id ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          className="w-20 h-8"
                          type="number"
                          step="0.01"
                          value={ruleRate}
                          onChange={(e) => setRuleRate(e.target.value)}
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => updateRateMutation.mutate()}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingRule(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <span className="font-mono-id">${parseFloat(String(rule.rate_per_ft3)).toFixed(2)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.is_active ? 'success' : 'outline'}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {editingRule?.id !== rule.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditingRule(rule); setRuleRate(String(rule.rate_per_ft3)); }}
                      >
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Standard Items</CardTitle>
          <CardDescription>Preset items available when adding to shipments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {standardItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {editingItem === item.id ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          className="w-24 h-8"
                          type="number"
                          step="0.01"
                          value={editItemPrice}
                          onChange={(e) => setEditItemPrice(e.target.value)}
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => {
                          const price = parseFloat(editItemPrice);
                          if (!isNaN(price) && price >= 0) updateItemPriceMutation.mutate({ id: item.id, price });
                        }}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingItem(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <span className="font-mono-id">${parseFloat(String(item.price)).toFixed(2)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {editingItem !== item.id && (
                        <Button variant="ghost" size="sm" onClick={() => { setEditingItem(item.id); setEditItemPrice(String(item.price)); }}>
                          Edit
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItemMutation.mutate(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator />

          <div className="flex items-end gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Item Name</Label>
              <Input placeholder="Custom item name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
            </div>
            <div className="space-y-1 w-28">
              <Label className="text-xs">Price ($)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => addItemMutation.mutate()} disabled={addItemMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
