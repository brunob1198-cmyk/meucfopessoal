-- Score de Saúde Financeira: snapshot mensal para o histórico de evolução.
-- Mesmo padrão de net_worth_history (20260308145646_...sql): um retrato por
-- usuário/mês, atualizado automaticamente sempre que o score é recalculado.
CREATE TABLE public.financial_health_score_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month DATE NOT NULL,
  total_score INTEGER NOT NULL DEFAULT 0,
  liquidez_score INTEGER NOT NULL DEFAULT 0,
  controle_gastos_score INTEGER NOT NULL DEFAULT 0,
  endividamento_score INTEGER NOT NULL DEFAULT 0,
  reserva_emergencia_score INTEGER NOT NULL DEFAULT 0,
  capacidade_poupanca_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.financial_health_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own score history" ON public.financial_health_score_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own score history" ON public.financial_health_score_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own score history" ON public.financial_health_score_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own score history" ON public.financial_health_score_history FOR DELETE USING (auth.uid() = user_id);
