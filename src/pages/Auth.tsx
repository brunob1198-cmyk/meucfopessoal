import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { BarChart3, TrendingUp, DollarSign, Shield, Zap, LineChart } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) toast.error(error.message);
      else toast.success('Conta criada! Verifique seu email.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center fintech-gradient p-4 relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-11 w-11 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center glow-border">
              <TrendingUp className="h-6 w-6 text-primary" style={{ color: 'hsl(173 58% 45%)' }} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-primary-foreground">
              CFO <span className="text-gradient">Pessoal</span>
            </h1>
          </div>
          <p className="text-sm text-primary-foreground/50 font-light tracking-wide">
            Gerencie suas finanças com mentalidade empresarial
          </p>
        </div>

        <Card className="glass-card border-primary/10 glow-border bg-card/10 backdrop-blur-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-primary-foreground">{isLogin ? 'Entrar' : 'Criar conta'}</CardTitle>
            <CardDescription className="text-primary-foreground/40">
              {isLogin ? 'Acesse sua demonstração de resultados pessoal' : 'Comece a controlar seu CFO pessoal'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-primary-foreground/5 border-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/30 focus:border-primary/50 focus:ring-primary/20"
              />
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-primary-foreground/5 border-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/30 focus:border-primary/50 focus:ring-primary/20"
              />
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold tracking-wide transition-all duration-300 hover:shadow-lg hover:shadow-primary/25" 
                disabled={loading}
              >
                {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar conta'}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-sm text-primary-foreground/40 hover:text-primary transition-colors duration-300"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-xl bg-primary-foreground/5 border border-primary-foreground/10 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-primary/5">
            <Zap className="h-5 w-5 mx-auto mb-1.5 text-primary" style={{ color: 'hsl(173 58% 45%)' }} />
            <p className="text-[11px] text-primary-foreground/50 font-medium">Lançamento rápido</p>
          </div>
          <div className="p-3 rounded-xl bg-primary-foreground/5 border border-primary-foreground/10 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-primary/5">
            <LineChart className="h-5 w-5 mx-auto mb-1.5 text-primary" style={{ color: 'hsl(173 58% 45%)' }} />
            <p className="text-[11px] text-primary-foreground/50 font-medium">DRE Completo</p>
          </div>
          <div className="p-3 rounded-xl bg-primary-foreground/5 border border-primary-foreground/10 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-primary/5">
            <Shield className="h-5 w-5 mx-auto mb-1.5 text-primary" style={{ color: 'hsl(173 58% 45%)' }} />
            <p className="text-[11px] text-primary-foreground/50 font-medium">Projeções IA</p>
          </div>
        </div>

        <p className="text-center text-[10px] text-primary-foreground/20 tracking-widest uppercase">
          Tecnologia financeira de alto padrão
        </p>
      </div>
    </div>
  );
}
