import { useEffect, useState } from 'react';
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
import { useTranslation } from '@/hooks/useTranslation';
import type { Customer, ServiceType } from '@/types/shipping';

interface AddressForm {
  name: string; phone: string; line1: string; line2: string; city: string; state: string; postal_code: string; country: string;
}

const emptyAddress = (country = 'US'): AddressForm => ({
  name: '', phone: '', line1: '', line2: '', city: '', state: '', postal_code: '', country
});

const getCustomerShippingAddress = (customer?: Customer | null): AddressForm => ({
  name: customer?.shipping_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(' '),
  phone: customer?.shipping_phone || customer?.phone || '',
  line1: customer?.shipping_line1 || '',
  line2: customer?.shipping_line2 || '',
  city: customer?.shipping_city || '',
  state: customer?.shipping_state || '',
  postal_code: customer?.shipping_postal_code || '',
  country: customer?.shipping_country || 'US',
});

const AddressFormFields = ({ addr, setAddr, label }: { addr: AddressForm; setAddr: (a: AddressForm) => void; label: string }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="font-heading font-semibold">{t(label)}</h3>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>{t('Contact Name *')}</Label>
        <Input value={addr.name} onChange={(e) => setAddr({ ...addr, name: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label>{t('Phone')}</Label>
        <Input value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} />
      </div>
    </div>
    <div className="space-y-2">
      <Label>{t('Address Line 1 *')}</Label>
      <Input value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} required />
    </div>
    <div className="space-y-2">
      <Label>{t('Address Line 2')}</Label>
      <Input value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="space-y-2">
        <Label>{t('City')} *</Label>
        <Input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label>{t('State')}</Label>
        <Input value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>{t('Postal Code')}</Label>
        <Input value={addr.postal_code} onChange={(e) => setAddr({ ...addr, postal_code: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>{t('Country')}</Label>
        <Input value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value })} />
      </div>
    </div>
  </div>
  );
};

const CreateShipment = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  const selectedCustomer = !isNewCustomer
    ? customers.find((customer) => customer.id === customerId) ?? null
    : null;

  useEffect(() => {
    if (!selectedCustomer || isNewCustomer) return;
    setSender(getCustomerShippingAddress(selectedCustomer));
  }, [isNewCustomer, selectedCustomer]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const selectedCustomerId = isNewCustomer ? null : customerId;
      if (!isNewCustomer && !selectedCustomerId) throw new Error(t('Please select a customer'));
      if (!sender.name.trim() || !sender.line1.trim() || !sender.city.trim()) throw new Error(t('Sender address is incomplete'));
      if (!receiver.name.trim() || !receiver.line1.trim() || !receiver.city.trim()) throw new Error(t('Receiver address is incomplete'));

      const { data, error } = await (supabase as any).rpc('create_shipment_with_addresses', {
        p_customer_id: selectedCustomerId,
        p_new_customer_first_name: isNewCustomer ? newCustomer.first_name : null,
        p_new_customer_last_name: isNewCustomer ? newCustomer.last_name : null,
        p_new_customer_phone: isNewCustomer ? newCustomer.phone : null,
        p_new_customer_email: isNewCustomer ? newCustomer.email : null,
        p_sender_name: sender.name,
        p_sender_phone: sender.phone,
        p_sender_line1: sender.line1,
        p_sender_line2: sender.line2,
        p_sender_city: sender.city,
        p_sender_state: sender.state,
        p_sender_postal_code: sender.postal_code,
        p_sender_country: sender.country,
        p_receiver_name: receiver.name,
        p_receiver_phone: receiver.phone,
        p_receiver_line1: receiver.line1,
        p_receiver_line2: receiver.line2,
        p_receiver_city: receiver.city,
        p_receiver_state: receiver.state,
        p_receiver_postal_code: receiver.postal_code,
        p_receiver_country: receiver.country,
        p_service_type: serviceType,
      });
      if (error) throw error;
      if (!data) throw new Error(t('Shipment creation did not return an id'));

      return data as string;
    },
    onSuccess: (id) => {
      toast.success(t('Shipment created!'));
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
          <h1 className="text-2xl font-bold font-heading">{t('New Shipment')}</h1>
          <p className="text-muted-foreground text-sm">{t('Step {step} of 3', { step })}</p>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">{t('Customer')}</CardTitle>
            <CardDescription>{t('Select an existing customer or create a new one')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant={!isNewCustomer ? 'default' : 'outline'} size="sm" onClick={() => setIsNewCustomer(false)}>
                {t('Existing Customer')}
              </Button>
              <Button variant={isNewCustomer ? 'default' : 'outline'} size="sm" onClick={() => setIsNewCustomer(true)}>
                <Plus className="h-4 w-4 mr-1" /> {t('New Customer')}
              </Button>
            </div>

            {!isNewCustomer ? (
              <div className="space-y-2">
                <Label>{t('Select Customer *')}</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder={t('Choose a customer...')} /></SelectTrigger>
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
                  <Label>{t('First Name *')}</Label>
                  <Input value={newCustomer.first_name} onChange={(e) => setNewCustomer(nc => ({ ...nc, first_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('Last Name *')}</Label>
                  <Input value={newCustomer.last_name} onChange={(e) => setNewCustomer(nc => ({ ...nc, last_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('Phone')}</Label>
                  <Input value={newCustomer.phone} onChange={(e) => setNewCustomer(nc => ({ ...nc, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('Email')}</Label>
                  <Input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer(nc => ({ ...nc, email: e.target.value }))} />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => {
                if (!isNewCustomer && !customerId) { toast.error(t('Select a customer')); return; }
                if (isNewCustomer && (!newCustomer.first_name.trim() || !newCustomer.last_name.trim())) { toast.error(t('Enter customer name')); return; }
                setStep(2);
              }}>{t('Continue')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">{t('Addresses')}</CardTitle>
            <CardDescription>{t('Enter sender and receiver addresses')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isNewCustomer && selectedCustomer && (
              <p className="text-sm text-muted-foreground">
                {t("Sender address is loaded from the customer's saved shipping address when available.")}
              </p>
            )}
            <AddressFormFields addr={sender} setAddr={setSender} label="Sender (Origin)" />
            <Separator />
            <AddressFormFields addr={receiver} setAddr={setReceiver} label="Receiver (Destination)" />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>{t('Back')}</Button>
              <Button onClick={() => {
                if (!sender.name.trim() || !sender.line1.trim() || !sender.city.trim()) { toast.error(t('Complete sender address')); return; }
                if (!receiver.name.trim() || !receiver.line1.trim() || !receiver.city.trim()) { toast.error(t('Complete receiver address')); return; }
                setStep(3);
              }}>{t('Continue')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">{t('Review & Create')}</CardTitle>
            <CardDescription>{t('Confirm shipment details')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('Service Type')}</Label>
              <Select value={serviceType} onValueChange={(v) => setServiceType(v as ServiceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEA">🚢 {t('Sea Freight (Default)')}</SelectItem>
                  <SelectItem value="AIR">✈️ {t('Air Freight')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium mb-1">{t('Customer')}</p>
                {isNewCustomer ? (
                  <p>{newCustomer.first_name} {newCustomer.last_name}</p>
                ) : (
                  <p>{customers.find(c => c.id === customerId)?.first_name} {customers.find(c => c.id === customerId)?.last_name}</p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium mb-1">{t('Route')}</p>
                <p>{sender.city}, {sender.country} → {receiver.city}, {receiver.country}</p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>{t('Back')}</Button>
              <Button
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? t('Creating...') : t('Create Shipment')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CreateShipment;
