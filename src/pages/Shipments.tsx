import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Package } from 'lucide-react';
import { format } from 'date-fns';
import type { Shipment, ShipmentStatus } from '@/types/shipping';

const statusVariant = (status: ShipmentStatus) => {
  const map: Record<ShipmentStatus, 'secondary' | 'warning' | 'info' | 'default' | 'success'> = {
    'Created': 'secondary', 'In Warehouse': 'warning', 'Paid': 'info', 'Shipped': 'default', 'Delivered': 'success',
  };
  return map[status] ?? 'outline';
};

const Shipments = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const filtered = shipments.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || s.shipment_id.toLowerCase().includes(q)
      || `${s.customers?.first_name} ${s.customers?.last_name}`.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Shipments</h1>
          <p className="text-muted-foreground text-sm">{shipments.length} total shipments</p>
        </div>
        <Button onClick={() => navigate('/shipments/new')} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4 mr-2" /> New Shipment
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID or customer..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Created">Created</SelectItem>
                <SelectItem value="In Warehouse">In Warehouse</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Shipped">Shipped</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/shipments/${s.id}`)}
                >
                  <TableCell className="font-mono-id font-medium text-sm">{s.shipment_id}</TableCell>
                  <TableCell>{s.customers?.first_name} {s.customers?.last_name}</TableCell>
                  <TableCell>
                    <Badge variant={s.service_type === 'AIR' ? 'info' : 'secondary'}>{s.service_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                    {format(new Date(s.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {search || statusFilter !== 'all' ? 'No shipments match your filters' : 'No shipments yet'}
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

export default Shipments;
