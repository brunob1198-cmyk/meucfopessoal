import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3, Target, Star, Brain, FileUp, Link2, Map,
  TrendingUp, Eye, Wallet, Landmark, ShieldCheck, ArrowRight,
  CheckCircle2, ChevronRight, Users, Clock, Zap,
  Instagram, Linkedin, Youtube, Twitter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import dashboardMockup from "@/assets/dashboard-mockup.png";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" }
  })
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};

/* ───── HERO ───── */
function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* BG gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/40" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center w-full">
        <motion.div initial="hidden" animate="visible" variants={stagger}>
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
            <Zap size={14} /> Gestão financeira inteligente
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl font-bold font-['Space_Grotesk'] leading-tight text-foreground mb-6">
            Controle total da sua{" "}
            <span className="text-primary">vida financeira.</span>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-muted-foreground max-w-lg mb-8">
            Visualize seu dinheiro, planeje seus sonhos e construa sua independência financeira.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-4">
            <Button size="lg" className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/20" onClick={() => navigate("/auth")}>
              Começar gratuitamente <ArrowRight size={18} />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 py-6 rounded-xl border-border" onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}>
              Ver como funciona
            </Button>
          </motion.div>
          <motion.div variants={fadeUp} custom={4} className="flex items-center gap-6 mt-10 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-primary" /> Grátis para começar</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-primary" /> Dados seguros</span>
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="hidden lg:block">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl blur-xl" />
            <img src={dashboardMockup} alt="Dashboard do CFO Pessoal" className="relative rounded-2xl border border-border shadow-2xl shadow-primary/10 w-full" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───── PROBLEM ───── */
function Problem() {
  const items = [
    { icon: Eye, text: "Não sabem para onde o dinheiro está indo" },
    { icon: Target, text: "Não planejam metas financeiras" },
    { icon: TrendingUp, text: "Não sabem quanto precisam para a independência financeira" },
  ];
  return (
    <section className="py-24 bg-secondary/20">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] text-foreground mb-6">
          A maioria das pessoas <span className="text-destructive">não sabe</span> para onde o dinheiro está indo.
        </motion.h2>
        <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1} className="text-muted-foreground text-lg mb-12 max-w-2xl mx-auto">
          Sem controle financeiro, sonhos ficam cada vez mais distantes.
        </motion.p>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 2}>
              <Card className="bg-card/50 border-border backdrop-blur-sm hover:border-destructive/40 transition-colors">
                <CardContent className="p-8 text-center">
                  <item.icon size={40} className="mx-auto mb-4 text-destructive/70" />
                  <p className="text-foreground font-medium">{item.text}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── SOLUTION ───── */
function Solution() {
  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
          A solução
        </motion.div>
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] text-foreground mb-6">
          Um verdadeiro <span className="text-primary">CFO</span> para sua vida financeira.
        </motion.h2>
        <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2} className="text-muted-foreground text-lg max-w-2xl mx-auto">
          O CFO Pessoal funciona como um consultor financeiro automatizado, analisando seus dados em tempo real e guiando suas decisões com inteligência artificial.
        </motion.p>
      </div>
    </section>
  );
}

/* ───── FEATURES ───── */
function Features() {
  const features = [
    { icon: BarChart3, title: "Dashboard financeiro inteligente", desc: "Visão completa das finanças, gráficos claros e evolução patrimonial." },
    { icon: Clock, title: "Timeline financeira", desc: "Todas as atividades financeiras em ordem cronológica." },
    { icon: Star, title: "Mapa de Sonhos Financeiros", desc: "Transforme objetivos de vida em metas: casa, carro, viagens, cirurgias." },
    { icon: Target, title: "Sistema de metas financeiras", desc: "Acompanhe o progresso de cada objetivo com barras de progresso automáticas." },
    { icon: Brain, title: "Consultor com IA", desc: "Análises automáticas sobre gastos, poupança e evolução patrimonial." },
    { icon: FileUp, title: "Importação automática de extratos", desc: "Importe extratos bancários em CSV, OFX ou PDF." },
    { icon: Link2, title: "Integração com Open Finance", desc: "Conecte contas bancárias e cartões para atualização automática." },
    { icon: Map, title: "Mapa de riqueza pessoal", desc: "Visualize patrimônio, dívidas, investimentos e evolução financeira." },
  ];

  return (
    <section className="py-24 bg-secondary/20">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
            Funcionalidades
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] text-foreground">
            Tudo que você precisa em um só lugar.
          </h2>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
              <Card className="bg-card/60 border-border backdrop-blur-sm hover:border-primary/40 transition-all hover:-translate-y-1 h-full">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <f.icon size={24} className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── CALCULATOR ───── */
function Calculator() {
  const [form, setForm] = useState({
    renda: "", gastos: "", patrimonio: "", investimento: "", rentabilidade: "8", idadeAtual: "", idadeMeta: ""
  });
  const [result, setResult] = useState<null | {
    patrimonioNecessario: number;
    anosFaltam: number;
    chartData: { ano: number; patrimonio: number }[];
    extraMsg: string;
  }>(null);

  const calc = () => {
    const renda = Number(form.renda) || 0;
    const gastos = Number(form.gastos) || 0;
    const pat = Number(form.patrimonio) || 0;
    const inv = Number(form.investimento) || 0;
    const rent = (Number(form.rentabilidade) || 8) / 100;
    const idadeAt = Number(form.idadeAtual) || 30;
    const idadeMet = Number(form.idadeMeta) || 60;

    const gastoAnual = gastos * 12;
    const patrimonioNecessario = gastoAnual / (rent || 0.08);
    const anos = idadeMet - idadeAt;

    const chartData: { ano: number; patrimonio: number }[] = [];
    let p = pat;
    for (let i = 0; i <= anos; i++) {
      chartData.push({ ano: idadeAt + i, patrimonio: Math.round(p) });
      p = p * (1 + rent) + inv * 12;
    }

    // extra msg
    const invExtra = 500;
    let pExtra = pat;
    let anosExtra = 0;
    for (let i = 0; i < 80; i++) {
      if (pExtra >= patrimonioNecessario) break;
      pExtra = pExtra * (1 + rent) + (inv + invExtra) * 12;
      anosExtra++;
    }

    let pNormal = pat;
    let anosNormal = 0;
    for (let i = 0; i < 80; i++) {
      if (pNormal >= patrimonioNecessario) break;
      pNormal = pNormal * (1 + rent) + inv * 12;
      anosNormal++;
    }

    const diff = anosNormal - anosExtra;

    setResult({
      patrimonioNecessario,
      anosFaltam: anosNormal > 80 ? 80 : anosNormal,
      chartData,
      extraMsg: diff > 0 ? `Se você investir R$ 500 a mais por mês, poderá alcançar sua independência ${diff} anos antes.` : ""
    });
  };

  const fields = [
    { key: "renda", label: "Renda mensal (R$)" },
    { key: "gastos", label: "Gastos mensais (R$)" },
    { key: "patrimonio", label: "Patrimônio atual (R$)" },
    { key: "investimento", label: "Investimento mensal (R$)" },
    { key: "rentabilidade", label: "Rentabilidade anual (%)" },
    { key: "idadeAtual", label: "Idade atual" },
    { key: "idadeMeta", label: "Idade desejada para independência" },
  ];

  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
            <Landmark size={14} /> Ferramenta interativa
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-['Space_Grotebs'] text-foreground mb-4">
            Calculadora de Independência Financeira
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Descubra quando você pode alcançar a liberdade financeira.</p>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
          <Card className="bg-card/60 border-border backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {fields.map(f => (
                  <div key={f.key}>
                    <Label className="text-xs text-muted-foreground mb-1">{f.label}</Label>
                    <Input
                      type="number"
                      value={(form as any)[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="bg-muted border-border"
                    />
                  </div>
                ))}
              </div>
              <Button className="w-full md:w-auto px-10 py-5" onClick={calc}>
                Calcular <ArrowRight size={16} />
              </Button>

              {result && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-muted rounded-xl p-6 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Patrimônio necessário</p>
                      <p className="text-3xl font-bold text-primary">
                        {result.patrimonioNecessario.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="bg-muted rounded-xl p-6 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Anos restantes</p>
                      <p className="text-3xl font-bold text-primary">{result.anosFaltam} anos</p>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.chartData}>
                        <defs>
                          <linearGradient id="calcGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(160,78%,49%)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(160,78%,49%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,25%,18%)" />
                        <XAxis dataKey="ano" stroke="hsl(207,25%,60%)" fontSize={12} />
                        <YAxis stroke="hsl(207,25%,60%)" fontSize={12} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ background: "hsl(200 35% 12% / 0.95)", border: "1px solid hsl(200 25% 18%)", borderRadius: 8, color: "#fff" }}
                          formatter={(v: number) => [v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }), "Patrimônio"]}
                        />
                        <Area type="monotone" dataKey="patrimonio" stroke="hsl(160,78%,49%)" fill="url(#calcGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {result.extraMsg && (
                    <div className="mt-6 bg-primary/10 border border-primary/30 rounded-xl p-4 text-center text-primary font-medium">
                      💡 {result.extraMsg}
                    </div>
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

/* ───── HOW IT WORKS ───── */
function HowItWorks() {
  const steps = [
    { num: "01", title: "Conecte suas contas", desc: "Importe seus extratos ou conecte via Open Finance." },
    { num: "02", title: "Organização automática", desc: "O sistema categoriza e organiza automaticamente suas finanças." },
    { num: "03", title: "Análises inteligentes", desc: "Receba insights e acompanhe seus objetivos em tempo real." },
  ];
  return (
    <section id="como-funciona" className="py-24 bg-secondary/20">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
            Como funciona
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] text-foreground">
            Simples como <span className="text-primary">1, 2, 3.</span>
          </h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i} className="relative text-center">
              <div className="text-6xl font-bold text-primary/10 font-['Space_Grotesk'] mb-2">{s.num}</div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-muted-foreground">{s.desc}</p>
              {i < 2 && <ChevronRight size={24} className="hidden md:block absolute top-8 -right-4 text-primary/30" />}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── BENEFITS ───── */
function Benefits() {
  const benefits = [
    { icon: Eye, title: "Clareza financeira", desc: "Entenda exatamente para onde vai cada centavo." },
    { icon: Wallet, title: "Controle de gastos", desc: "Identifique desperdícios e otimize seus gastos." },
    { icon: Target, title: "Planejamento de metas", desc: "Defina e acompanhe seus objetivos financeiros." },
    { icon: TrendingUp, title: "Evolução patrimonial", desc: "Veja seu patrimônio crescer mês a mês." },
    { icon: Landmark, title: "Independência financeira", desc: "Construa o caminho para a liberdade financeira." },
  ];
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] text-foreground">
            Benefícios que transformam sua <span className="text-primary">vida financeira</span>
          </h2>
        </motion.div>
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
          {benefits.map((b, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
              <Card className="bg-card/60 border-border hover:border-primary/40 transition-all hover:-translate-y-1 h-full text-center">
                <CardContent className="p-6">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <b.icon size={26} className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{b.title}</h3>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── SOCIAL PROOF ───── */
function SocialProof() {
  const testimonials = [
    { name: "Mariana S.", role: "Empresária", text: "Com o CFO Pessoal, finalmente consigo visualizar para onde vai cada centavo. Já organizei minhas metas e estou a caminho da minha independência financeira." },
    { name: "Lucas R.", role: "Desenvolvedor", text: "A importação automática de extratos e a inteligência artificial mudaram completamente minha relação com o dinheiro. Recomendo!" },
    { name: "Camila F.", role: "Médica", text: "O Mapa de Sonhos me ajudou a planejar minha viagem dos sonhos com disciplina. Realizei em 8 meses!" },
  ];
  return (
    <section className="py-24 bg-secondary/20">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
            <Users size={14} /> Depoimentos
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] text-foreground">
            Quem usa, <span className="text-primary">recomenda.</span>
          </h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
              <Card className="bg-card/60 border-border h-full">
                <CardContent className="p-8">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => <Star key={j} size={16} className="text-primary fill-primary" />)}
                  </div>
                  <p className="text-muted-foreground mb-6 italic">"{t.text}"</p>
                  <div>
                    <p className="font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── FINAL CTA ───── */
function FinalCTA() {
  const navigate = useNavigate();
  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl font-bold font-['Space_Grotesk'] text-foreground mb-6">
            Comece hoje a transformar sua <span className="text-primary">vida financeira.</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground mb-8">
            Milhares de pessoas já estão no caminho da independência financeira. Junte-se a elas.
          </motion.p>
          <motion.div variants={fadeUp} custom={2}>
            <Button size="lg" className="text-lg px-12 py-7 rounded-xl shadow-lg shadow-primary/20" onClick={() => navigate("/auth")}>
              Criar conta gratuita <ArrowRight size={20} />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───── FOOTER ───── */
function Footer() {
  return (
    <footer className="border-t border-border py-12 bg-card/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-foreground text-lg font-['Space_Grotesk'] mb-3">CFO Pessoal</h3>
            <p className="text-sm text-muted-foreground">Seu consultor financeiro pessoal inteligente.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Produto</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="hover:text-primary cursor-pointer transition-colors">Funcionalidades</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Preços</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Atualizações</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Empresa</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="hover:text-primary cursor-pointer transition-colors">Sobre</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Contato</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Blog</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="hover:text-primary cursor-pointer transition-colors">Política de privacidade</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Termos de uso</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} CFO Pessoal. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Instagram size={20} className="text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
            <Linkedin size={20} className="text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
            <Youtube size={20} className="text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
            <Twitter size={20} className="text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ───── MAIN PAGE ───── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Hero />
      <Problem />
      <Solution />
      <Features />
      <Calculator />
      <HowItWorks />
      <Benefits />
      <SocialProof />
      <FinalCTA />
      <Footer />
    </div>
  );
}
