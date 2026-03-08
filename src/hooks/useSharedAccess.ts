import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useMyShares() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['shared-access-mine', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_access')
        .select('*')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useSharedWithMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['shared-access-with-me', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_access')
        .select('*')
        .eq('shared_with_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useInviteUser() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, permission }: { email: string; permission: 'view' | 'edit' }) => {
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase.from('shared_access').insert({
        owner_id: user.id,
        shared_with_email: email,
        permission,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-access-mine'] });
      toast.success('Convite enviado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRespondInvite() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('shared_access')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-access-with-me'] });
      toast.success('Resposta salva!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeShare() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shared_access').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-access-mine'] });
      toast.success('Acesso revogado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
