
-- Dream categories enum
CREATE TYPE public.dream_category AS ENUM (
  'casa_propria', 'carro', 'viagem', 'cirurgia', 'educacao',
  'aposentadoria', 'independencia_financeira', 'outro'
);

-- Dream status enum
CREATE TYPE public.dream_status AS ENUM (
  'em_progresso', 'proximo', 'em_risco', 'concluido'
);

-- Financial dreams table
CREATE TABLE public.financial_dreams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category dream_category NOT NULL DEFAULT 'outro',
  target_value NUMERIC NOT NULL DEFAULT 0,
  accumulated_value NUMERIC NOT NULL DEFAULT 0,
  target_date DATE,
  description TEXT,
  status dream_status NOT NULL DEFAULT 'em_progresso',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_dreams ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own dreams" ON public.financial_dreams
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dreams" ON public.financial_dreams
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dreams" ON public.financial_dreams
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dreams" ON public.financial_dreams
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_financial_dreams_updated_at
  BEFORE UPDATE ON public.financial_dreams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
