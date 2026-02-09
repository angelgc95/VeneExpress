import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Package, FileText, Clock, MapPin, Printer } from 'lucide-react';
import { format } from 'date-fns';
import BoxTable from '@/components/shipments/BoxTable';
import StatusTimeline from '@/components/shipments/StatusTimeline';
import InvoiceSection from '@/components/shipments/InvoiceSection';
import LabelPrintButton from '@/components/shipments/LabelPrintButton';
import type { Shipment, Address, Box, ShipmentStatus } from '@/types/shipping';

const statusVariant = (status: ShipmentStatus) => {
  const map: Record<ShipmentStatus, 'secondary' | 'warning' | 'info' | 'default' | 'success' | 'destructive'> = {
    'Label Created': 'secondary', 'Received': 'warning', 'Shipped': 'info', 'Arrived in Destination': 'default',
    'Released by Customs': 'default', 'Ready for Delivery': 'warning', 'Delivered': 'success', 'Cancelled': 'destructive',
  };
  return map[status] ?? 'secondary';
};

const ShipmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: shipment, isLoading } = useQuery({
    queryKey: ['shipment', id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('shipments')
        .select('*, customers(first_name, last_name, phone, email)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Shipment & { customers: { first_name: string; last_name: string; phone: string; email: string } };
    },
    enabled: !!id,
  });

  const { data: senderAddress } = useQuery({
    queryKey: ['address', shipment?.sender_address_id],
    enabled: !!shipment?.sender_address_id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('addresses').select('*').eq('id', shipment!.sender_address_id).single();
      if (error) throw error;
      return data as Address;
    },
  });

  const { data: receiverAddress } = useQuery({
    queryKey: ['address', shipment?.receiver_address_id],
    enabled: !!shipment?.receiver_address_id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('addresses').select('*').eq('id', shipment!.receiver_address_id).single();
      if (error) throw error;
      return data as Address;
    },
  });

  const { data: boxes = [] } = useQuery({
    queryKey: ['boxes', id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('boxes')
        .select('*')
        .eq('shipment_id', id)
        .order('created_at');
      if (error) throw error;
      return data as Box[];
    },
    enabled: !!id,
  });

  const { data: invoice } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('invoices')
        .select('*')
        .eq('shipment_id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading || !shipment) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const AddressCard = ({ address, label }: { address?: Address; label: string }) => (
    <div className="p-3 bg-muted rounded-lg space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      {address ? (
        <>
          <p className="font-medium text-sm">{address.name}</p>
          {address.phone && <p className="text-sm text-muted-foreground">{address.phone}</p>}
          <p className="text-sm">{address.line1}</p>
          {address.line2 && <p className="text-sm">{address.line2}</p>}
          <p className="text-sm">{address.city}{address.state ? `, ${address.state}` : ''} {address.postal_code}</p>
          <p className="text-sm font-medium">{address.country}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No address set</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/shipments')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-heading font-mono-id">{shipment.shipment_id}</h1>
            <Badge variant={statusVariant(shipment.status as ShipmentStatus)}>{shipment.status}</Badge>
            <Badge variant={shipment.service_type === 'AIR' ? 'info' : 'secondary'}>{shipment.service_type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {shipment.customers?.first_name} {shipment.customers?.last_name}
            {shipment.customers?.phone && ` • ${shipment.customers.phone}`}
            {' • '}Created {format(new Date(shipment.created_at), 'MMM d, yyyy')}
          </p>
        </div>
        {boxes.length > 0 && (
          <LabelPrintButton
            shipmentId={shipment.id}
            label={`Print Labels (${boxes.length})`}
          />
        )}
      </div>

      <Tabs defaultValue="boxes">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="boxes" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Boxes ({boxes.length})
          </TabsTrigger>
          <TabsTrigger value="invoice" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Invoice
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AddressCard address={senderAddress} label="From (Sender)" />
                <AddressCard address={receiverAddress} label="To (Receiver)" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boxes" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <BoxTable
                shipmentId={shipment.id}
                shipmentIdStr={shipment.shipment_id}
                serviceType={shipment.service_type as 'SEA' | 'AIR'}
                isFinalized={invoice?.is_finalized}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoice" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <InvoiceSection shipmentId={shipment.id} boxes={boxes} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <StatusTimeline
                shipmentId={shipment.id}
                currentStatus={shipment.status as ShipmentStatus}
                onStatusChange={() => queryClient.invalidateQueries({ queryKey: ['shipment', id] })}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ShipmentDetail;
