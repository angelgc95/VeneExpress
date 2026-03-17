ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS destination_name text,
  ADD COLUMN IF NOT EXISTS destination_phone text,
  ADD COLUMN IF NOT EXISTS destination_line1 text,
  ADD COLUMN IF NOT EXISTS destination_line2 text,
  ADD COLUMN IF NOT EXISTS destination_city text,
  ADD COLUMN IF NOT EXISTS destination_state text,
  ADD COLUMN IF NOT EXISTS destination_postal_code text,
  ADD COLUMN IF NOT EXISTS destination_country text;

DROP FUNCTION IF EXISTS public.create_shipment_with_addresses(
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
);

CREATE FUNCTION public.create_shipment_with_addresses(
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
  p_service_type public.service_type,
  p_save_customer_addresses boolean DEFAULT true
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

  IF coalesce(p_save_customer_addresses, true) THEN
    UPDATE public.customers
    SET
      shipping_name = trim(p_sender_name),
      shipping_phone = nullif(trim(coalesce(p_sender_phone, '')), ''),
      shipping_line1 = trim(p_sender_line1),
      shipping_line2 = nullif(trim(coalesce(p_sender_line2, '')), ''),
      shipping_city = trim(p_sender_city),
      shipping_state = nullif(trim(coalesce(p_sender_state, '')), ''),
      shipping_postal_code = nullif(trim(coalesce(p_sender_postal_code, '')), ''),
      shipping_country = coalesce(nullif(trim(coalesce(p_sender_country, '')), ''), 'US'),
      destination_name = trim(p_receiver_name),
      destination_phone = nullif(trim(coalesce(p_receiver_phone, '')), ''),
      destination_line1 = trim(p_receiver_line1),
      destination_line2 = nullif(trim(coalesce(p_receiver_line2, '')), ''),
      destination_city = trim(p_receiver_city),
      destination_state = nullif(trim(coalesce(p_receiver_state, '')), ''),
      destination_postal_code = nullif(trim(coalesce(p_receiver_postal_code, '')), ''),
      destination_country = coalesce(nullif(trim(coalesce(p_receiver_country, '')), ''), 'VE')
    WHERE id = v_customer_id;
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
