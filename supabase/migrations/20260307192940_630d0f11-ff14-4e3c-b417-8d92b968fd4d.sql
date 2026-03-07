
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DRE type enum
CREATE TYPE public.dre_type AS ENUM ('receita', 'desconto', 'custo', 'despesa', 'depreciacao', 'resultado_financeiro', 'outras_receitas', 'impostos', 'investimento');

-- Categories table (hierarchical)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dre_type public.dre_type NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_categories_user ON public.categories(user_id);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  comment TEXT,
  is_installment BOOLEAN NOT NULL DEFAULT false,
  installment_group UUID,
  installment_number INT,
  total_installments INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_category ON public.transactions(category_id);
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Projections table
CREATE TABLE public.projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projections" ON public.projections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projections" ON public.projections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projections" ON public.projections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projections" ON public.projections FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_projections_user ON public.projections(user_id);

-- Function to seed default categories for a new user
CREATE OR REPLACE FUNCTION public.seed_default_categories(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_receita UUID;
  v_descontos UUID;
  v_custos UUID;
  v_habitacao UUID;
  v_saude UUID;
  v_automovel UUID;
  v_pessoais UUID;
  v_restaurante UUID;
  v_lazer UUID;
  v_estudos UUID;
  v_investimentos UUID;
BEGIN
  INSERT INTO public.categories (user_id, name, dre_type, sort_order, is_default) VALUES (p_user_id, 'RECEITA BRUTA', 'receita', 1, true) RETURNING id INTO v_receita;
  INSERT INTO public.categories (user_id, name, dre_type, parent_id, sort_order, is_default) VALUES
    (p_user_id, 'Salário', 'receita', v_receita, 1, true),
    (p_user_id, 'VR + VA', 'receita', v_receita, 2, true),
    (p_user_id, 'Benefícios', 'receita', v_receita, 3, true),
    (p_user_id, 'Demais proventos', 'receita', v_receita, 4, true),
    (p_user_id, 'FGTS depositado', 'receita', v_receita, 5, true);

  INSERT INTO public.categories (user_id, name, dre_type, sort_order, is_default) VALUES (p_user_id, 'DESCONTOS INCIDENTES', 'desconto', 2, true) RETURNING id INTO v_descontos;
  INSERT INTO public.categories (user_id, name, dre_type, parent_id, sort_order, is_default) VALUES
    (p_user_id, 'IR', 'desconto', v_descontos, 1, true),
    (p_user_id, 'INSS', 'desconto', v_descontos, 2, true),
    (p_user_id, 'Desconto VA + VR', 'desconto', v_descontos, 3, true),
    (p_user_id, 'ISS', 'desconto', v_descontos, 4, true);

  INSERT INTO public.categories (user_id, name, dre_type, sort_order, is_default) VALUES (p_user_id, 'CUSTOS', 'custo', 3, true) RETURNING id INTO v_custos;
  INSERT INTO public.categories (user_id, name, dre_type, parent_id, sort_order, is_default) VALUES
    (p_user_id, 'Venda de VA', 'custo', v_custos, 1, true);

  INSERT INTO public.categories (user_id, name, dre_type, sort_order, is_default) VALUES (p_user_id, 'HABITAÇÃO', 'despesa', 4, true) RETURNING id INTO v_habitacao;
  INSERT INTO public.categories (user_id, name, dre_type, parent_id, sort_order, is_default) VALUES
    (p_user_id, 'Aluguel / Prestação Apto', 'despesa', v_habitacao, 1, true),
    (p_user_id, 'Aluguel / Prestação Resort', 'despesa', v_habitacao, 2, true),
    (p_user_id, 'Condomínio Apto', 'despesa', v_habitacao, 3, true),
    (p_user_id, 'Condomínio Resort', 'despesa', v_habitacao, 4, true),
    (p_user_id, 'IPTU', 'despesa', v_habitacao, 5, true),
    (p_user_id, 'Energia / Água', 'despesa', v_habitacao, 6, true),
    (p_user_id, 'FGTS utilizado', 'despesa', v_habitacao, 7, true),
    (p_user_id, 'Animais', 'despesa', v_habitacao, 8, true),
    (p_user_id, 'Assinaturas', 'despesa', v_habitacao, 9, true),
    (p_user_id, 'Supermercado', 'despesa', v_habitacao, 10, true),
    (p_user_id, 'Farmácia', 'despesa', v_habitacao, 11, true),
    (p_user_id, 'Compras de itens', 'despesa', v_habitacao, 12, true),
    (p_user_id, 'Outros / Ajuda em casa', 'despesa', v_habitacao, 13, true);

  INSERT INTO public.categories (user_id, name, dre_type, sort_order, is_default) VALUES (p_user_id, 'SAÚDE', 'despesa', 5, true) RETURNING id INTO v_saude;
  INSERT INTO public.categories (user_id, name, dre_type, parent_id, sort_order, is_default) VALUES
    (p_user_id, 'Plano de saúde', 'despesa', v_saude, 1, true),
    (p_user_id, 'Médico / Psicóloga', 'despesa', v_saude, 2, true),
    (p_user_id, 'Dentista', 'despesa', v_saude, 3, true),
    (p_user_id, 'Medicamentos', 'despesa', v_saude, 4, true),
    (p_user_id, 'Outros', 'despesa', v_saude, 5, true);

  INSERT INTO public.categories (user_id, name, dre_type, sort_order, is_default) VALUES (p_user_id, 'AUTOMÓVEL', 'despesa', 6, true) RETURNING id INTO v_automovel;
  INSERT INTO public.categories (user_id, name, dre_type, parent_id, sort_order, is_default) VALUES
    (p_user_id, 'Seguro', 'despesa', v_automovel, 1, true),
    (p_user_id, 'Prestações', 'despesa', v_automovel, 2, true),
    (p_user_id, 'Combustível', 'despesa', v_automovel, 3, true),
    (p_user_id, 'Lavagens', 'despesa', v_automovel, 4, true),
    (p_user_id, 'IPVA', 'despesa', v_automovel, 5, true),
    (p_user_id, 'Mecânico', 'despesa', v_automovel, 6, true),
    (p_user_id, 'Multas', 'despesa', v_automovel, 7, true),
    (p_user_id, 'Outros', 'despesa', v_automovel, 8, true);

  INSERT INTO public.categories (user_id, name, dre_type, sort_order, is_default) VALUES (p_user_id, 'DESPESAS PESSOAIS', 'despesa', 7, true) RETURNING id INTO v_pessoais;
  INSERT INTO public.categories (user_id, name, dre_type, parent_id, sort_order, is_default) VALUES
    (p_user_id, 'Higiene pessoal', 'despesa', v_pessoais, 1, true),
    (p_user_id, 'Cosméticos / acessórios', 'despesa', v_pessoais, 2, true),
    (p_user_id, 'Cabeleireiro', 'despesa', v_pessoais, 3, true),
    (p_user_id, 'Vestuário', 'despesa', v_pessoais, 4, true),
    (p_user_id, 'Lavanderia', 'despesa', v_pessoais, 5, true),
    (p_user_id, 'Academia / Crossfit / Yoga', 'despesa', v_pessoais, 6, true),
    (p_user_id, 'Telefone celular', 'despesa', v_pessoais, 7, true),
    (p_user_id, 'Empréstimos', 'despesa', v_pessoais, 8, true),
    (p_user_id, 'Outros', 'despesa', v_pessoais, 9, true);

  INSERT INTO public.categories (user_id, name, dre_type, sort_order, is_default) VALUES (p_user_id, 'RESTAURANTE', 'despesa', 8, true) RETURNING id INTO v_restaurante;
  INSERT INTO public.categories (user_id, name, dre_type, parent_id, sort_order, is_default) VALUES
    (p_user_id, 'Restaurantes', 'despesa', v_restaurante, 1, true),
    (p_user_id, 'Lanches', 'despesa', v_restaurante, 2, true);

  INSERT INTO public.categories (user_id, name, dre_type, sort_order, is_default) VALUES (p_user_id, 'LAZER', 'despesa', 9, true) RETURNING id INTO v_lazer;
  INSERT INTO public.categories (user_id, name, dre_type, parent_id, sort_order, is_default) VALUES
    (p_user_id, 'Cafés / bares / boates', 'despesa', v_lazer, 1, true),
    (p_user_id, 'Livraria / jornal', 'despesa', v_lazer, 2, true),
    (p_user_id, 'Viagens', 'despesa', v_lazer, 3, true),
    (p_user_id, 'Cinema', 'despesa', v_lazer, 4, true),
    (p_user_id, 'Shows / eventos', 'despesa', v_lazer, 5, true),
    (p_user_id, 'Outros', 'despesa', v_lazer, 6, true);

  INSERT INTO public.categories (user_id, name, dre_type, sort_order, is_default) VALUES (p_user_id, 'ESTUDOS', 'despesa', 10, true) RETURNING id INTO v_estudos;
  INSERT INTO public.categories (user_id, name, dre_type, parent_id, sort_order, is_default) VALUES
    (p_user_id, 'MBA', 'despesa', v_estudos, 1, true),
    (p_user_id, 'Inglês', 'despesa', v_estudos, 2, true),
    (p_user_id, 'Material escolar', 'despesa', v_estudos, 3, true),
    (p_user_id, 'Gastos gerais', 'despesa', v_estudos, 4, true),
    (p_user_id, 'Lanche na faculdade', 'despesa', v_estudos, 5, true),
    (p_user_id, 'Cursos extras', 'despesa', v_estudos, 6, true);

  INSERT INTO public.categories (user_id, name, dre_type, sort_order, is_default) VALUES (p_user_id, 'INVESTIMENTOS', 'investimento', 11, true) RETURNING id INTO v_investimentos;
  INSERT INTO public.categories (user_id, name, dre_type, parent_id, sort_order, is_default) VALUES
    (p_user_id, 'Investimentos Coma Bem', 'investimento', v_investimentos, 1, true),
    (p_user_id, 'Investimentos Loja Galo', 'investimento', v_investimentos, 2, true),
    (p_user_id, 'Investimentos PJ', 'investimento', v_investimentos, 3, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to seed categories on new user signup
CREATE OR REPLACE FUNCTION public.seed_categories_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.seed_default_categories(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_seed_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.seed_categories_on_signup();
