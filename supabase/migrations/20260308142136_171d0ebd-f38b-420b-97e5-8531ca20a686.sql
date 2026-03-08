
-- Shared access table
CREATE TABLE public.shared_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  shared_with_email TEXT NOT NULL,
  shared_with_id UUID,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_access ENABLE ROW LEVEL SECURITY;

-- Owner can manage their shares
CREATE POLICY "Owners can manage shared access"
  ON public.shared_access FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Shared users can view invites sent to them
CREATE POLICY "Shared users can view their invites"
  ON public.shared_access FOR SELECT
  TO authenticated
  USING (auth.uid() = shared_with_id);

-- Shared users can update status (approve/reject)
CREATE POLICY "Shared users can respond to invites"
  ON public.shared_access FOR UPDATE
  TO authenticated
  USING (auth.uid() = shared_with_id);

-- User plans table
CREATE TABLE public.user_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan"
  ON public.user_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plan"
  ON public.user_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plan"
  ON public.user_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-create free plan on signup
CREATE OR REPLACE FUNCTION public.create_user_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_plans (user_id, plan) VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_plan
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_plan();

-- Function to resolve shared_with_id from email
CREATE OR REPLACE FUNCTION public.resolve_shared_access_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = NEW.shared_with_email LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    NEW.shared_with_id := v_user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER resolve_shared_user_on_insert
  BEFORE INSERT ON public.shared_access
  FOR EACH ROW EXECUTE FUNCTION public.resolve_shared_access_user();
