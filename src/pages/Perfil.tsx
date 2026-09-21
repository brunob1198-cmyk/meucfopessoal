import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMyShares, useSharedWithMe, useInviteUser, useRespondInvite, useRevokeShare } from '@/hooks/useSharedAccess';
import { useUserPlan, FREE_TX_LIMIT } from '@/hooks/useUserPlan';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Trash2, Check, X, Crown, User, Save, AlertTriangle } from 'lucide-react';
import { AvatarUpload } from '@/components/AvatarUpload';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  approved: 'default',
  rejected: 'destructive',
};

const DELETE_ACCOUNT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`;

export default function Perfil() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { plan, isPremium, isLoading: planLoading } = useUserPlan();
  const { data: myShares, isLoading: sharesLoading } = useMyShares();
  const { data: sharedWithMe, isLoading: withMeLoading } = useSharedWithMe();
  const invite = useInviteUser();
  const respond = useRespondInvite();
  const revoke = useRevokeShare();

  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [profession, setProfession] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, gender, birth_date, profession')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setDisplayName(data.display_name || '');
        setGender((data as any).gender || '');
        setBirthDate((data as any).birth_date || '');
        setProfession((data as any).profession || '');
      }
      setProfileLoading(false);
    };
    load();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName || null,
        gender: gender || null,
        birth_date: birthDate || null,
        profession: profession || null,
      } as any)
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar perfil', variant: 'destructive' });
    } else {
      toast({ title: 'Perfil atualizado com sucesso!' });
    }
  };

  const handleInvite = () => {
    if (!email.trim()) return;
    invite.mutate({ email: email.trim(), permission });
    setEmail('');
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const resp = await fetch(DELETE_ACCOUNT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error || 'Erro ao excluir a conta.');

      toast({ title: 'Conta excluída com sucesso.' });
      await signOut();
    } catch (err) {
      toast({
        title: 'Erro ao excluir conta',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
      setDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu perfil, plano e acessos compartilhados</p>
      </div>

      {/* User Info + Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Membro desde {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}</p>
            </div>
            {planLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Badge variant={isPremium ? 'default' : 'secondary'} className="gap-1">
                {isPremium && <Crown className="h-3 w-3" />}
                {isPremium ? 'Premium' : 'Gratuito'}
              </Badge>
            )}
          </div>
          {!isPremium && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium">Plano Gratuito</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• Até {FREE_TX_LIMIT} lançamentos por mês</li>
                <li>• Dashboard básico</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Upgrade para <span className="font-semibold text-primary">Premium</span>: lançamentos ilimitados, projeções, insights de IA e dashboards avançados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações Pessoais</CardTitle>
          <CardDescription>Dados opcionais para personalizar sua experiência</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileLoading ? (
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          ) : (
            <>
              <div className="flex flex-col items-center sm:items-start mb-6">
                <span className="text-sm font-medium mb-3 text-muted-foreground">Foto de Perfil</span>
                <AvatarUpload />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Nome de Exibição</Label>
                  <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Seu nome" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profession">Profissão (opcional)</Label>
                  <Input id="profession" value={profession} onChange={e => setProfession(e.target.value)} placeholder="Ex: Engenheiro, Médica" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gender">Gênero</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger id="gender"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="nao_binario">Não-binário</SelectItem>
                      <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Input id="birthDate" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Perfil
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Invite others */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Compartilhar Acesso
          </CardTitle>
          <CardDescription>Convide outras pessoas para visualizar ou editar seus dados financeiros</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Email do convidado"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <Select value={permission} onValueChange={(v) => setPermission(v as 'view' | 'edit')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Visualizar</SelectItem>
                <SelectItem value="edit">Editar</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={invite.isPending || !email.trim()}>
              {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Convidar'}
            </Button>
          </div>

          {sharesLoading ? (
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          ) : myShares && myShares.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Seus convites</p>
              {myShares.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm">{s.shared_with_email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{s.permission === 'edit' ? 'Editar' : 'Visualizar'}</Badge>
                      <Badge variant={STATUS_VARIANT[s.status]} className="text-[10px]">{STATUS_LABELS[s.status]}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => revoke.mutate(s.id)} className="h-8 w-8">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum acesso compartilhado</p>
          )}
        </CardContent>
      </Card>

      {/* Shared with me */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acessos Recebidos</CardTitle>
          <CardDescription>Convites de outros usuários para acessar dados deles</CardDescription>
        </CardHeader>
        <CardContent>
          {withMeLoading ? (
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          ) : sharedWithMe && sharedWithMe.length > 0 ? (
            <div className="space-y-2">
              {sharedWithMe.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm">{s.shared_with_email === user?.email ? `De: ${s.owner_id.substring(0, 8)}...` : s.shared_with_email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{s.permission === 'edit' ? 'Editar' : 'Visualizar'}</Badge>
                      <Badge variant={STATUS_VARIANT[s.status]} className="text-[10px]">{STATUS_LABELS[s.status]}</Badge>
                    </div>
                  </div>
                  {s.status === 'pending' && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => respond.mutate({ id: s.id, status: 'approved' })}>
                        <Check className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => respond.mutate({ id: s.id, status: 'rejected' })}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum convite recebido</p>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Zona de perigo
          </CardTitle>
          <CardDescription>Ações irreversíveis relacionadas à sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium">Excluir minha conta</p>
              <p className="text-xs text-muted-foreground max-w-md">
                Apaga imediata e definitivamente seu login, lançamentos, categorias, orçamentos, balanço patrimonial, metas e todo o restante dos seus dados. Não há como desfazer.
              </p>
            </div>
            <AlertDialog onOpenChange={(open) => !open && setDeleteConfirmText('')}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Excluir minha conta</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza que quer excluir sua conta?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>
                        Essa ação é <strong>imediata e definitiva</strong>. Todos os seus lançamentos, categorias, orçamentos, balanço patrimonial, metas e o próprio login serão apagados — não há período de recuperação.
                      </p>
                      <p>
                        Para confirmar, digite <strong>EXCLUIR</strong> abaixo:
                      </p>
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="EXCLUIR"
                        autoFocus
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletingAccount}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
                    disabled={deleteConfirmText !== 'EXCLUIR' || deletingAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir definitivamente'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
