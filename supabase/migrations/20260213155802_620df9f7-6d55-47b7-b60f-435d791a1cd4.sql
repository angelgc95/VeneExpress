
-- Fix 1: Drop the fragile RESTRICTIVE deny policy on customers and replace with a note
-- The existing RESTRICTIVE "Deny anonymous access to customers" doesn't add real protection
-- since there are no PERMISSIVE anon policies. But to make the model robust, we drop it
-- and re-add as a PERMISSIVE policy with USING (false) scoped to the anon role.
DROP POLICY IF EXISTS "Deny anonymous access to customers" ON public.customers;
CREATE POLICY "Deny anonymous access to customers"
  ON public.customers
  FOR SELECT
  TO anon
  USING (false);

-- Fix 2: Add explicit anonymous deny policy on admin_allowlist
CREATE POLICY "Deny anonymous access to admin_allowlist"
  ON public.admin_allowlist
  FOR SELECT
  TO anon
  USING (false);
