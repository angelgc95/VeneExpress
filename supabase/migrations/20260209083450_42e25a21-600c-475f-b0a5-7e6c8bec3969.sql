-- Fix profiles table: drop RESTRICTIVE policies and recreate as PERMISSIVE
-- The issue is that RESTRICTIVE-only policies result in no access since
-- RESTRICTIVE policies only narrow PERMISSIVE ones (and there are none).

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));