import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, Plus } from 'lucide-react';
import type { Customer, ServiceType } from '@/types/shipping';

interface AddressForm {
  name: string; phone: string; line1: string; line2: string; city: string; state: string; postal_code: string; country: string;
}

const emptyAddress = (country = 'US'): AddressForm => ({
  name: '', phone: '', line1: '', line2: '', city: '', state: '', postal_code: '', country
});

const AddressFormFields = ({ addr, setAddr, label }: { addr: AddressForm; setAddr: (a: AddressForm) => void; label: string }) => (
  <div className="space-y-4">
    <h3 className="font-heading font-semibold">{label}</h3>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Contact Name *</Label>
        <Input value={addr.name} onChange={(e) => setAddr({ ...addr, name: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} />
      </div>
    </div>
    <div className="space-y-2">
      <Label>Address Line 1 *</Label>
      <Input value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} required />
    </div>
    <div className="space-y-2">
      <Label>Address Line 2</Label>
      <Input value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="space-y-2">
        <Label>City *</Label>
        <Input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label>State</Label>
        <Input value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Postal Code</Label>
        <Input value={addr.postal_code} onChange={(e) => setAddr({ ...addr, postal_code: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Country</Label>
        <Input value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value })} />
      </div>
    </div>
  </div>
);

const CreateShipment = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState({ first_name: '', last_name: '', phone: '', email: '' });
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [sender, setSender] = useState<AddressForm>(emptyAddress('US'));
  const [receiver, setReceiver] = useState<AddressForm>(emptyAddress('VE'));
  const [serviceType, setServiceType] = useState<ServiceType>('SEA');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('customers').select('*').order('first_name');
      if (error) throw error;
      return data as Customer[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      let cId = customerId;

      if (isNewCustomer) {
        if (!newCustomer.first_name.trim() || !newCustomer.last_name.trim()) throw new Error('Customer name required');
        const { data, error } = await (supabase as any).from('customers').insert({
          first_name: newCustomer.first_name.trim(),
          last_name: newCustomer.last_name.trim(),
          phone: newCustomer.phone.trim() || null,
          email: newCustomer.email.trim() || null,
        }).select('id').single();
        if (error) throw error;
        cId = data.id;
      }

      if (!cId) throw new Error('Please select a customer');
      if (!sender.name.trim() || !sender.line1.trim() || !sender.city.trim()) throw new Error('Sender address is incomplete');
      if (!receiver.name.trim() || !receiver.line1.trim() || !receiver.city.trim()) throw new Error('Receiver address is incomplete');

      const { data: sAddr, error: sErr } = await (supabase as any).from('addresses').insert({
        name: sender.name.trim(), phone: sender.phone.trim() || null, line1: sender.line1.trim(),
        line2: sender.line2.trim() || null, city: sender.city.trim(), state: sender.state.trim() || null,
        postal_code: sender.postal_code.trim() || null, country: sender.country,
      }).select('id').single();
      if (sErr) throw sErr;

      const { data: rAddr, error: rErr } = await (supabase as any).from('addresses').insert({
        name: receiver.name.trim(), phone: receiver.phone.trim() || null, line1: receiver.line1.trim(),
        line2: receiver.line2.trim() || null, city: receiver.city.trim(), state: receiver.state.trim() || null,
        postal_code: receiver.postal_code.trim() || null, country: receiver.country,
      }).select('id').single();
      if (rErr) throw rErr;

      const { data: shipment, error: shipErr } = await (supabase as any).from('shipments').insert({
        customer_id: cId,
        sender_address_id: sAddr.id,
        receiver_address_id: rAddr.id,
        service_type: serviceType,
      }).select('id').single();
      if (shipErr) throw shipErr;

      return shipment.id;
    },
    onSuccess: (id) => {
      toast.success('Shipment created!');
      navigate(`/shipments/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // AddressFormFields is defined outside this component to prevent re-mounting on every render

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/shipments')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-heading">New Shipment</h1>
          <p className="text-muted-foreground text-sm">Step {step} of 3</p>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Customer</CardTitle>
            <CardDescription>Select an existing customer or create a new one</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant={!isNewCustomer ? 'default' : 'outline'} size="sm" onClick={() => setIsNewCustomer(false)}>
                Existing Customer
              </Button>
              <Button variant={isNewCustomer ? 'default' : 'outline'} size="sm" onClick={() => setIsNewCustomer(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Customer
              </Button>
            </div>

            {!isNewCustomer ? (
              <div className="space-y-2">
                <Label>Select Customer *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Choose a customer..." /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.phone ? `(${c.phone})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={newCustomer.first_name} onChange={(e) => setNewCustomer(nc => ({ ...nc, first_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input value={newCustomer.last_name} onChange={(e) => setNewCustomer(nc => ({ ...nc, last_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={newCustomer.phone} onChange={(e) => setNewCustomer(nc => ({ ...nc, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer(nc => ({ ...nc, email: e.target.value }))} />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => {
                if (!isNewCustomer && !customerId) { toast.error('Select a customer'); return; }
                if (isNewCustomer && (!newCustomer.first_name.trim() || !newCustomer.last_name.trim())) { toast.error('Enter customer name'); return; }
                setStep(2);
              }}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Addresses</CardTitle>
            <CardDescription>Enter sender and receiver addresses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <AddressFormFields addr={sender} setAddr={setSender} label="Sender (Origin)" />
            <Separator />
            <AddressFormFields addr={receiver} setAddr={setReceiver} label="Receiver (Destination)" />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => {
                if (!sender.name.trim() || !sender.line1.trim() || !sender.city.trim()) { toast.error('Complete sender address'); return; }
                if (!receiver.name.trim() || !receiver.line1.trim() || !receiver.city.trim()) { toast.error('Complete receiver address'); return; }
                setStep(3);
              }}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Review & Create</CardTitle>
            <CardDescription>Confirm shipment details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={serviceType} onValueChange={(v) => setServiceType(v as ServiceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEA">🚢 Sea Freight (Default)</SelectItem>
                  <SelectItem value="AIR">✈️ Air Freight</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium mb-1">Customer</p>
                {isNewCustomer ? (
                  <p>{newCustomer.first_name} {newCustomer.last_name}</p>
                ) : (
                  <p>{customers.find(c => c.id === customerId)?.first_name} {customers.find(c => c.id === customerId)?.last_name}</p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium mb-1">Route</p>
                <p>{sender.city}, {sender.country} → {receiver.city}, {receiver.country}</p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Shipment'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CreateShipment;
