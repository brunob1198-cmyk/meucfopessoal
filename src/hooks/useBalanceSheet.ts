import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type AssetCategory =
  | 'conta_corrente' | 'poupanca' | 'dinheiro_caixa'
  | 'renda_fixa' | 'acoes' | 'fundos' | 'criptomoedas'
  | 'imoveis' | 'veiculos' | 'participacoes' | 'outros_bens';

export type LiabilityCategory =
  | 'cartao_credito' | 'emprestimo' | 'financiamento_imobiliario'
  | 'financiamento_veiculo' | 'parcelamento' | 'impostos_pagar' | 'outros_passivos';

export interface Asset {
  id: string;
  user_id: string;
  name: string;
  category: AssetCategory;
  current_value: number;
  acquisition_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Liability {
  id: string;
  user_id: string;
  name: string;
  category: LiabilityCategory;
  total_value: number;
  current_balance: number;
  monthly_payment: number;
  interest_rate: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface NetWorthSnapshot {
  id: string;
  user_id: string;
  month: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  created_at: string;
}

const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  conta_corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  dinheiro_caixa: 'Dinheiro em Caixa',
  renda_fixa: 'Renda Fixa',
  acoes: 'Ações',
  fundos: 'Fundos',
  criptomoedas: 'Criptomoedas',
  imoveis: 'Imóveis',
  veiculos: 'Veículos',
  participacoes: 'Participações',
  outros_bens: 'Outros Bens',
};

const LIABILITY_CATEGORY_LABELS: Record<LiabilityCategory, string> = {
  cartao_credito: 'Cartão de Crédito',
  emprestimo: 'Empréstimo',
  financiamento_imobiliario: 'Financiamento Imobiliário',
  financiamento_veiculo: 'Financiamento de Veículo',
  parcelamento: 'Parcelamento',
  impostos_pagar: 'Impostos a Pagar',
  outros_passivos: 'Outros Passivos',
};

const ASSET_GROUPS = {
  'Ativos de Curto Prazo': ['conta_corrente', 'poupanca', 'dinheiro_caixa'] as AssetCategory[],
  'Investimentos': ['renda_fixa', 'acoes', 'fundos', 'criptomoedas'] as AssetCategory[],
  'Bens': ['imoveis', 'veiculos', 'participacoes', 'outros_bens'] as AssetCategory[],
};

const LIABILITY_GROUPS = {
  'Dívidas': ['cartao_credito', 'emprestimo'] as LiabilityCategory[],
  'Financiamentos': ['financiamento_imobiliario', 'financiamento_veiculo'] as LiabilityCategory[],
  'Outros Passivos': ['parcelamento', 'impostos_pagar', 'outros_passivos'] as LiabilityCategory[],
};

export { ASSET_CATEGORY_LABELS, LIABILITY_CATEGORY_LABELS, ASSET_GROUPS, LIABILITY_GROUPS };

export function useAssets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['balance-sheet-assets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('balance_sheet_assets')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Asset[];
    },
    enabled: !!user,
  });

  const upsert = useMutation({
    mutationFn: async (asset: Partial<Asset> & { name: string; category: AssetCategory; current_value: number }) => {
      const payload = { ...asset, user_id: user!.id };
      if (asset.id) {
        const { error } = await supabase.from('balance_sheet_assets').update(payload).eq('id', asset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('balance_sheet_assets').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance-sheet-assets'] });
      toast({ title: 'Ativo salvo com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao salvar ativo', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('balance_sheet_assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance-sheet-assets'] });
      toast({ title: 'Ativo removido' });
    },
    onError: () => toast({ title: 'Erro ao remover ativo', variant: 'destructive' }),
  });

  return { ...query, upsert, remove };
}

export function useLiabilities() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['balance-sheet-liabilities', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('balance_sheet_liabilities')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Liability[];
    },
    enabled: !!user,
  });

  const upsert = useMutation({
    mutationFn: async (liability: Partial<Liability> & { name: string; category: LiabilityCategory; total_value: number; current_balance: number }) => {
      const payload = { ...liability, user_id: user!.id };
      if (liability.id) {
        const { error } = await supabase.from('balance_sheet_liabilities').update(payload).eq('id', liability.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('balance_sheet_liabilities').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance-sheet-liabilities'] });
      toast({ title: 'Passivo salvo com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao salvar passivo', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('balance_sheet_liabilities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance-sheet-liabilities'] });
      toast({ title: 'Passivo removido' });
    },
    onError: () => toast({ title: 'Erro ao remover passivo', variant: 'destructive' }),
  });

  return { ...query, upsert, remove };
}

export function useNetWorthHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['net-worth-history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('net_worth_history')
        .select('*')
        .order('month', { ascending: true });
      if (error) throw error;
      return data as NetWorthSnapshot[];
    },
    enabled: !!user,
  });

  const saveSnapshot = useMutation({
    mutationFn: async (snapshot: { month: string; total_assets: number; total_liabilities: number; net_worth: number }) => {
      const { error } = await supabase
        .from('net_worth_history')
        .upsert({ ...snapshot, user_id: user!.id }, { onConflict: 'user_id,month' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['net-worth-history'] }),
  });

  return { ...query, saveSnapshot };
}
