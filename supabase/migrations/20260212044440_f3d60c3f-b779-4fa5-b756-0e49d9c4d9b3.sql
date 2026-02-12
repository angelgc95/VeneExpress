
-- Explicit deny policies for anonymous access on sensitive tables

-- customers table
CREATE POLICY "Deny anonymous access to customers"
ON public.customers
FOR SELECT
TO anon
USING (false);

-- notification_log table
CREATE POLICY "Deny anonymous access to notification_log"
ON public.notification_log
FOR SELECT
TO anon
USING (false);

-- profiles table
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);
