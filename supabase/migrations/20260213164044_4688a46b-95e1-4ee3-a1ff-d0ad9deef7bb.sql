
-- Fix: Prevent users from self-approving by changing their own 'approved' field.
-- A trigger is the most robust approach since RLS policies can't restrict individual columns.

CREATE OR REPLACE FUNCTION public.prevent_self_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If approved status is being changed
  IF OLD.approved IS DISTINCT FROM NEW.approved THEN
    -- Only admins can change the approved field
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can change approval status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_self_approval_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_approval();
