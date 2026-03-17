import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Warehouse, Ship, CheckCircle, Search, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import type { Shipment, ShipmentStatus } from '@/types/shipping';

const statusVariant = (status: ShipmentStatus) => {
  const map: Record<ShipmentStatus, 'secondary' | 'warning' | 'info' | 'default' | 'success' | 'destructive'> = {
    'Label Created': 'secondary',
    'Received': 'warning',
    'Shipped': 'info',
    'Arrived in Destination': 'default',
    'Released by Customs': 'default',
    'Ready for Delivery': 'warning',
    'Delivered': 'success',
    'Cancelled': 'destructive',
  };
  return map[status] ?? 'secondary';
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { t, dateLocale } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: shipments = [] } = useQuery({
    queryKey: ['shipments-dashboard'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('shipments')
        .select('*, customers(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as (Shipment & { customers: { first_name: string; last_name: string } })[];
    },
  });

  const counts = shipments.reduce((acc: Record<string, number>, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  const kpis = [
    { label: 'Label Created', count: counts['Label Created'] || 0, icon: Package, color: 'text-muted-foreground bg-muted' },
    { label: 'Received', count: counts['Received'] || 0, icon: Warehouse, color: 'text-warning bg-warning/10' },
    { label: 'Shipped', count: counts['Shipped'] || 0, icon: Ship, color: 'text-info bg-info/10' },
    { label: 'Delivered', count: counts['Delivered'] || 0, icon: CheckCircle, color: 'text-success bg-success/10' },
  ];

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    navigate(`/shipments?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">{t('Dashboard')}</h1>
          <p className="text-muted-foreground text-sm">{t('Overview of your shipping operations')}</p>
        </div>
        <Button onClick={() => navigate('/shipments/new')} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4 mr-2" /> {t('New Shipment')}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl", kpi.color)}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">{kpi.count}</p>
                <p className="text-xs text-muted-foreground">{t(kpi.label)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">{t('Quick Search')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Search by Shipment ID, Box ID, or customer phone...')}
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button variant="outline" onClick={handleSearch}>{t('Search')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">{t('Recent Shipments')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Shipment ID')}</TableHead>
                <TableHead>{t('Customer')}</TableHead>
                <TableHead>{t('Service')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('Date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.slice(0, 10).map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/shipments/${s.id}`)}
                >
                  <TableCell className="font-mono-id font-medium text-sm">{s.shipment_id}</TableCell>
                  <TableCell>{s.customers?.first_name} {s.customers?.last_name}</TableCell>
                  <TableCell>
                    <Badge variant={s.service_type === 'AIR' ? 'info' : 'secondary'}>
                      {s.service_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(s.status)}>{t(s.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                    {format(new Date(s.created_at), 'MMM d, yyyy', { locale: dateLocale })}
                  </TableCell>
                </TableRow>
              ))}
              {shipments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    {t('No shipments yet. Create your first one!')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
