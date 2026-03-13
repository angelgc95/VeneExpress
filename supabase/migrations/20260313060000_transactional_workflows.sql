-- Keep shipment-related cleanup transactional and predictable.

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_invoice_id_fkey
  FOREIGN KEY (invoice_id)
  REFERENCES public.invoices(id)
  ON DELETE CASCADE;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_shipment_id_fkey;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_shipment_id_fkey
  FOREIGN KEY (shipment_id)
  REFERENCES public.shipments(id)
  ON DELETE CASCADE;

ALTER TABLE public.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_shipment_id_fkey;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_shipment_id_fkey
  FOREIGN KEY (shipment_id)
  REFERENCES public.shipments(id)
  ON DELETE CASCADE;

ALTER TABLE public.status_events
  DROP CONSTRAINT IF EXISTS status_events_shipment_id_fkey;

ALTER TABLE public.status_events
  ADD CONSTRAINT status_events_shipment_id_fkey
  FOREIGN KEY (shipment_id)
  REFERENCES public.shipments(id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.create_shipment_with_addresses(
  p_customer_id uuid,
  p_new_customer_first_name text,
  p_new_customer_last_name text,
  p_new_customer_phone text,
  p_new_customer_email text,
  p_sender_name text,
  p_sender_phone text,
  p_sender_line1 text,
  p_sender_line2 text,
  p_sender_city text,
  p_sender_state text,
  p_sender_postal_code text,
  p_sender_country text,
  p_receiver_name text,
  p_receiver_phone text,
  p_receiver_line1 text,
  p_receiver_line2 text,
  p_receiver_city text,
  p_receiver_state text,
  p_receiver_postal_code text,
  p_receiver_country text,
  p_service_type public.service_type
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_sender_address_id uuid;
  v_receiver_address_id uuid;
  v_shipment_id uuid;
BEGIN
  IF NOT public.is_admin_or_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff/admin can create shipments';
  END IF;

  v_customer_id := p_customer_id;

  IF v_customer_id IS NULL THEN
    IF coalesce(trim(p_new_customer_first_name), '') = ''
      OR coalesce(trim(p_new_customer_last_name), '') = '' THEN
      RAISE EXCEPTION 'Customer name required';
    END IF;

    INSERT INTO public.customers (
      first_name,
      last_name,
      phone,
      email
    )
    VALUES (
      trim(p_new_customer_first_name),
      trim(p_new_customer_last_name),
      nullif(trim(coalesce(p_new_customer_phone, '')), ''),
      nullif(trim(coalesce(p_new_customer_email, '')), '')
    )
    RETURNING id INTO v_customer_id;
  END IF;

  IF coalesce(trim(p_sender_name), '') = ''
    OR coalesce(trim(p_sender_line1), '') = ''
    OR coalesce(trim(p_sender_city), '') = '' THEN
    RAISE EXCEPTION 'Sender address is incomplete';
  END IF;

  IF coalesce(trim(p_receiver_name), '') = ''
    OR coalesce(trim(p_receiver_line1), '') = ''
    OR coalesce(trim(p_receiver_city), '') = '' THEN
    RAISE EXCEPTION 'Receiver address is incomplete';
  END IF;

  INSERT INTO public.addresses (
    name,
    phone,
    line1,
    line2,
    city,
    state,
    postal_code,
    country
  )
  VALUES (
    trim(p_sender_name),
    nullif(trim(coalesce(p_sender_phone, '')), ''),
    trim(p_sender_line1),
    nullif(trim(coalesce(p_sender_line2, '')), ''),
    trim(p_sender_city),
    nullif(trim(coalesce(p_sender_state, '')), ''),
    nullif(trim(coalesce(p_sender_postal_code, '')), ''),
    coalesce(nullif(trim(coalesce(p_sender_country, '')), ''), 'US')
  )
  RETURNING id INTO v_sender_address_id;

  INSERT INTO public.addresses (
    name,
    phone,
    line1,
    line2,
    city,
    state,
    postal_code,
    country
  )
  VALUES (
    trim(p_receiver_name),
    nullif(trim(coalesce(p_receiver_phone, '')), ''),
    trim(p_receiver_line1),
    nullif(trim(coalesce(p_receiver_line2, '')), ''),
    trim(p_receiver_city),
    nullif(trim(coalesce(p_receiver_state, '')), ''),
    nullif(trim(coalesce(p_receiver_postal_code, '')), ''),
    coalesce(nullif(trim(coalesce(p_receiver_country, '')), ''), 'VE')
  )
  RETURNING id INTO v_receiver_address_id;

  INSERT INTO public.shipments (
    customer_id,
    sender_address_id,
    receiver_address_id,
    service_type
  )
  VALUES (
    v_customer_id,
    v_sender_address_id,
    v_receiver_address_id,
    coalesce(p_service_type, 'SEA'::public.service_type)
  )
  RETURNING id INTO v_shipment_id;

  RETURN v_shipment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_shipment_with_addresses(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.service_type
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_shipment_with_addresses(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.service_type
) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_customers_with_related_data(
  p_customer_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address_ids uuid[] := ARRAY[]::uuid[];
  v_deleted_count integer := 0;
BEGIN
  IF NOT public.is_admin_or_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff/admin can delete customers';
  END IF;

  IF coalesce(array_length(p_customer_ids, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  SELECT coalesce(array_agg(addr_id), ARRAY[]::uuid[])
  INTO v_address_ids
  FROM (
    SELECT DISTINCT sender_address_id AS addr_id
    FROM public.shipments
    WHERE customer_id = ANY (p_customer_ids)
      AND sender_address_id IS NOT NULL
    UNION
    SELECT DISTINCT receiver_address_id AS addr_id
    FROM public.shipments
    WHERE customer_id = ANY (p_customer_ids)
      AND receiver_address_id IS NOT NULL
  ) AS address_ids;

  DELETE FROM public.shipments
  WHERE customer_id = ANY (p_customer_ids);

  IF array_length(v_address_ids, 1) IS NOT NULL THEN
    DELETE FROM public.addresses AS address
    WHERE address.id = ANY (v_address_ids)
      AND NOT EXISTS (
        SELECT 1
        FROM public.shipments AS shipment
        WHERE shipment.sender_address_id = address.id
          OR shipment.receiver_address_id = address.id
      );
  END IF;

  DELETE FROM public.customers
  WHERE id = ANY (p_customer_ids);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_customers_with_related_data(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_customers_with_related_data(uuid[]) TO authenticated;
