
-- Asset categories enum
CREATE TYPE public.asset_category AS ENUM (
  'conta_corrente', 'poupanca', 'dinheiro_caixa',
  'renda_fixa', 'acoes', 'fundos', 'criptomoedas',
  'imoveis', 'veiculos', 'participacoes', 'outros_bens'
);

-- Liability categories enum
CREATE TYPE public.liability_category AS ENUM (
  'cartao_credito', 'emprestimo', 'financiamento_imobiliario',
  'financiamento_veiculo', 'parcelamento', 'impostos_pagar', 'outros_passivos'
);

-- Assets table
CREATE TABLE public.balance_sheet_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category public.asset_category NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  acquisition_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.balance_sheet_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets" ON public.balance_sheet_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assets" ON public.balance_sheet_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON public.balance_sheet_assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON public.balance_sheet_assets FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.balance_sheet_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Liabilities table
CREATE TABLE public.balance_sheet_liabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category public.liability_category NOT NULL,
  total_value NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  monthly_payment NUMERIC DEFAULT 0,
  interest_rate NUMERIC DEFAULT 0,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.balance_sheet_liabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own liabilities" ON public.balance_sheet_liabilities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own liabilities" ON public.balance_sheet_liabilities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own liabilities" ON public.balance_sheet_liabilities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own liabilities" ON public.balance_sheet_liabilities FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_liabilities_updated_at BEFORE UPDATE ON public.balance_sheet_liabilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Net worth snapshots for historical tracking
CREATE TABLE public.net_worth_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month DATE NOT NULL,
  total_assets NUMERIC NOT NULL DEFAULT 0,
  total_liabilities NUMERIC NOT NULL DEFAULT 0,
  net_worth NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.net_worth_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own net worth history" ON public.net_worth_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own net worth history" ON public.net_worth_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own net worth history" ON public.net_worth_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own net worth history" ON public.net_worth_history FOR DELETE USING (auth.uid() = user_id);
