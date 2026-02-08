
-- Drop overly permissive anon policies that expose ALL data
DROP POLICY IF EXISTS "Anon can view shipments for tracking" ON public.shipments;
DROP POLICY IF EXISTS "Anon can view status events" ON public.status_events;

-- Create a secure RPC for public tracking lookups
-- This returns ONLY limited tracking data, no customer PII or addresses
CREATE OR REPLACE FUNCTION public.get_tracking_info(p_tracking_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  v_shipment_id uuid;
  v_shipment_display_id text;
  v_status text;
  v_service_type text;
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_public_tracking_code text;
BEGIN
  -- Validate input
  IF p_tracking_code IS NULL OR length(trim(p_tracking_code)) < 8 THEN
    RETURN NULL;
  END IF;

  -- Find shipment by public tracking code only
  SELECT id, shipment_id, status, service_type, created_at, updated_at, public_tracking_code
  INTO v_shipment_id, v_shipment_display_id, v_status, v_service_type, v_created_at, v_updated_at, v_public_tracking_code
  FROM public.shipments
  WHERE public_tracking_code = trim(p_tracking_code)
  LIMIT 1;

  IF v_shipment_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Return only safe, limited tracking data
  SELECT json_build_object(
    'shipment', json_build_object(
      'id', v_shipment_id,
      'shipment_id', v_shipment_display_id,
      'status', v_status,
      'service_type', v_service_type,
      'created_at', v_created_at,
      'updated_at', v_updated_at,
      'public_tracking_code', v_public_tracking_code
    ),
    'events', COALESCE((
      SELECT json_agg(json_build_object(
        'id', se.id,
        'status', se.status,
        'note', se.note,
        'created_at', se.created_at
      ) ORDER BY se.created_at DESC)
      FROM public.status_events se
      WHERE se.shipment_id = v_shipment_id
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_tracking_info(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_tracking_info(text) TO authenticated;
