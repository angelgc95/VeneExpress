import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, Shield } from 'lucide-react';
import type { CompanySettings, PricingRule } from '@/types/shipping';

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

  const [companyForm, setCompanyForm] = useState({ name: '', phone: '', address: '' });
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [ruleRate, setRuleRate] = useState('');

  useEffect(() => {
    if (company) {
      setCompanyForm({
        name: company.name || '',
        phone: company.phone || '',
        address: company.address || '',
      });
    }
  }, [company]);

  const saveCompanyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('company_settings').update({
        name: companyForm.name.trim(),
        phone: companyForm.phone.trim() || null,
        address: companyForm.address.trim() || null,
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
    </div>
  );
};

export default Settings;
