
-- Connected bank accounts via Pluggy
CREATE TABLE public.connected_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pluggy_item_id TEXT NOT NULL,
  connector_name TEXT NOT NULL,
  connector_logo TEXT,
  account_type TEXT NOT NULL DEFAULT 'checking',
  account_name TEXT,
  balance NUMERIC DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connected accounts" ON public.connected_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own connected accounts" ON public.connected_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own connected accounts" ON public.connected_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own connected accounts" ON public.connected_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Imported bank transactions (before user confirms/categorizes)
CREATE TABLE public.imported_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connected_account_id UUID REFERENCES public.connected_accounts(id) ON DELETE CASCADE NOT NULL,
  external_id TEXT,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  transaction_type TEXT DEFAULT 'debit',
  suggested_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  confirmed_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, external_id)
);

ALTER TABLE public.imported_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own imported transactions" ON public.imported_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own imported transactions" ON public.imported_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own imported transactions" ON public.imported_transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own imported transactions" ON public.imported_transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
