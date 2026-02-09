export type ShipmentStatus = 'Created' | 'In Warehouse' | 'Paid' | 'Shipped' | 'Delivered' | 'Cancelled';
export type ServiceType = 'SEA' | 'AIR';
export type PaymentMethod = 'cash' | 'zelle' | 'card' | 'other';
export type PaymentStatusType = 'Unpaid' | 'Partial' | 'Paid';
export type InvoiceLineType = 'shipping' | 'discount' | 'misc';
export type AppRole = 'admin' | 'staff' | 'readonly';

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Address {
  id: string;
  name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  created_at: string;
}

export interface Shipment {
  id: string;
  shipment_id: string;
  customer_id: string;
  sender_address_id: string | null;
  receiver_address_id: string | null;
  service_type: ServiceType;
  currency: string;
  status: ShipmentStatus;
  public_tracking_code: string | null;
  created_at: string;
  updated_at: string;
  customers?: Customer;
}

export interface Box {
  id: string;
  box_id: string;
  shipment_id: string;
  length_in: number;
  width_in: number;
  height_in: number;
  volume_ft3: number;
  applied_rate: number | null;
  calculated_price: number | null;
  price_override: number | null;
  override_reason: string | null;
  final_price: number | null;
  notes: string | null;
  created_at: string;
}

export interface PricingRule {
  id: string;
  name: string;
  route: string;
  service_type: ServiceType;
  rate_per_ft3: number;
  is_active: boolean;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  shipment_id: string;
  subtotal: number;
  adjustment: number;
  total: number;
  paid_amount: number;
  balance: number;
  payment_status: PaymentStatusType;
  is_finalized: boolean;
  created_at: string;
  finalized_at: string | null;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  type: InvoiceLineType;
  description: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  paid_at: string;
}

export interface StatusEvent {
  id: string;
  shipment_id: string;
  box_id: string | null;
  status: ShipmentStatus;
  note: string | null;
  actor_user_id: string | null;
  created_at: string;
}

export interface CompanySettings {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  updated_at: string;
}
