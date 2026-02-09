
-- Rename existing enum values
ALTER TYPE public.shipment_status RENAME VALUE 'Created' TO 'Label Created';
ALTER TYPE public.shipment_status RENAME VALUE 'In Warehouse' TO 'Received';

-- Add new enum values in order
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'Arrived in Destination' AFTER 'Shipped';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'Released by Customs' AFTER 'Arrived in Destination';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'Ready for Delivery' AFTER 'Released by Customs';

-- Update the default value for shipments.status
ALTER TABLE public.shipments ALTER COLUMN status SET DEFAULT 'Label Created'::shipment_status;
