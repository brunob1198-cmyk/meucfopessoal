import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { TrendingUp, Zap, LineChart, Shield } from 'lucide-react';
import fintechBg from '@/assets/fintech-bg.jpg';

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${fintechBg})` }}
      />
      <div className="absolute inset-0 bg-background/85 fintech-gradient-deep" style={{ mixBlendMode: 'multiply' }} />
      <div className="absolute inset-0 grid-bg" />

      {/* Ambient glow effects */}
      <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none" style={{ background: 'hsl(160 78% 49% / 0.08)' }} />
      <div className="absolute bottom-1/4 -right-40 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none" style={{ background: 'hsl(160 60% 42% / 0.06)' }} />
      <div className="absolute top-10 right-1/4 w-[300px] h-[300px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'hsl(28 100% 63% / 0.04)' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md space-y-8 relative z-10 p-4"
      >
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            <div className="h-12 w-12 rounded-xl flex items-center justify-center glow-border pulse-glow" style={{ background: 'hsl(160 78% 49% / 0.15)', borderColor: 'hsl(160 78% 49% / 0.3)' }}>
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              CFO <span className="text-gradient">Pessoal</span>
            </h1>
          </motion.div>
          <p className="text-sm text-muted-foreground font-light tracking-wide">
            Gerencie suas finanças com mentalidade empresarial
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="glass-card-strong glow-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-display text-foreground">{isLogin ? 'Entrar' : 'Criar conta'}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {isLogin ? 'Acesse sua demonstração de resultados pessoal' : 'Comece a controlar seu Meu CFO Pessoal'}
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
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20"
                />
                <Input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20"
                />
                <Button
                  type="submit"
                  className="w-full btn-gradient text-primary-foreground font-semibold tracking-wide"
                  disabled={loading}
                >
                  {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar conta'}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="grid grid-cols-3 gap-3 text-center"
        >
          {[
            { icon: Zap, label: 'Lançamento rápido', color: 'primary' },
            { icon: LineChart, label: 'DRE Completo', color: 'secondary' },
            { icon: Shield, label: 'Projeções IA', color: 'warning' },
          ].map(({ icon: Icon, label }, i) => (
            <div
              key={i}
              className="p-3 rounded-xl glass-card float-card cursor-default"
            >
              <Icon className="h-5 w-5 mx-auto mb-1.5 text-primary" />
              <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center text-[10px] text-muted-foreground/50 tracking-widest uppercase"
        >
          Tecnologia financeira de alto padrão
        </motion.p>
      </motion.div>
    </div>
  );
}
