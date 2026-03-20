import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight, Heart, Shield, TrendingUp, ChevronLeft,
  Sparkles, CheckCircle2, Target
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip
} from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

/* ════════════════════════════════════════════
   1 — Teste de Saúde Financeira
   ════════════════════════════════════════════ */
function HealthTest() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ renda: "", gastos: "", reserva: "", dividas: "", investe: "" });
  const [result, setResult] = useState<null | { score: number; label: string; recs: string[] }>(null);

  const calcScore = () => {
    const renda = Number(form.renda) || 1;
    const gastos = Number(form.gastos) || 0;
    const ratio = gastos / renda;

    let score = 0;
    if (ratio <= 0.5) score += 30;
    else if (ratio <= 0.7) score += 22;
    else if (ratio <= 0.9) score += 12;
    else score += 5;

    if (form.reserva === "mais6") score += 25;
    else if (form.reserva === "3a6") score += 18;
    else if (form.reserva === "menos3") score += 8;

    if (form.dividas === "nao") score += 25;
    else if (form.dividas === "pequenas") score += 18;
    else if (form.dividas === "moderadas") score += 10;
    else score += 3;

    if (form.investe === "sim") score += 20;
    else if (form.investe === "asvezes") score += 12;

    const recs: string[] = [];
    if (ratio > 0.7) recs.push("Reduza seus gastos mensais para no máximo 70% da sua renda.");
    if (form.reserva === "nao" || form.reserva === "menos3") recs.push("Comece a construir uma reserva de emergência de pelo menos 6 meses de gastos.");
    if (form.dividas === "altas" || form.dividas === "moderadas") recs.push("Priorize a quitação das dívidas antes de investir.");
    if (form.investe === "nao") recs.push("Comece a investir, mesmo que pouco, para criar o hábito.");
    if (recs.length === 0) recs.push("Continue mantendo sua disciplina financeira!");

    let label = "";
    if (score <= 40) label = "Situação financeira frágil";
    else if (score <= 70) label = "Situação em desenvolvimento";
    else if (score <= 90) label = "Boa organização financeira";
    else label = "Excelente saúde financeira";

    setResult({ score, label, recs: recs.slice(0, 3) });
    setStep(6);
  };

  const scoreColor = (s: number) => {
    if (s <= 40) return "text-destructive";
    if (s <= 70) return "text-warning";
    return "text-primary";
  };

  if (result && step === 6) {
    return (
      <div className="space-y-6">
        <button onClick={() => { setStep(0); setResult(null); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={16} /> Refazer teste
        </button>
        <div className="text-center space-y-4">
          <div className={`text-7xl font-bold font-['Space_Grotesk'] ${scoreColor(result.score)}`}>{result.score}</div>
          <Progress value={result.score} className="h-3 max-w-sm mx-auto" />
          <p className="text-lg font-semibold text-foreground">{result.label}</p>
          <p className="text-sm text-muted-foreground">💪 "Você já começou sua jornada financeira."</p>
        </div>
        <div className="space-y-3 bg-muted/30 rounded-xl p-5">
          <p className="font-semibold text-foreground text-sm">Recomendações para você:</p>
          {result.recs.map((r, i) => (
            <div key={i} className="flex gap-2 items-start text-sm">
              <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{r}</span>
            </div>
          ))}
        </div>
        <Button className="w-full py-6 text-base" onClick={() => navigate("/auth")}>
          Criar conta gratuita para acompanhar sua evolução <ArrowRight size={16} />
        </Button>
      </div>
    );
  }

  const questions = [
    <div key="renda" className="space-y-3">
      <Label className="text-foreground font-medium">Qual sua renda mensal? (R$)</Label>
      <Input type="number" placeholder="Ex: 5000" value={form.renda} onChange={e => setForm(p => ({ ...p, renda: e.target.value }))} className="bg-muted border-border" />
    </div>,
    <div key="gastos" className="space-y-3">
      <Label className="text-foreground font-medium">Quanto você gasta por mês? (R$)</Label>
      <Input type="number" placeholder="Ex: 3500" value={form.gastos} onChange={e => setForm(p => ({ ...p, gastos: e.target.value }))} className="bg-muted border-border" />
    </div>,
    <div key="reserva" className="space-y-3">
      <Label className="text-foreground font-medium">Você possui reserva de emergência?</Label>
      <RadioGroup value={form.reserva} onValueChange={v => setForm(p => ({ ...p, reserva: v }))} className="space-y-2">
        {[["nao", "Não"], ["menos3", "Menos de 3 meses"], ["3a6", "Entre 3 e 6 meses"], ["mais6", "Mais de 6 meses"]].map(([v, l]) => (
          <div key={v} className="flex items-center gap-2"><RadioGroupItem value={v} id={`res-${v}`} /><Label htmlFor={`res-${v}`} className="cursor-pointer text-muted-foreground">{l}</Label></div>
        ))}
      </RadioGroup>
    </div>,
    <div key="dividas" className="space-y-3">
      <Label className="text-foreground font-medium">Você possui dívidas?</Label>
      <RadioGroup value={form.dividas} onValueChange={v => setForm(p => ({ ...p, dividas: v }))} className="space-y-2">
        {[["nao", "Não"], ["pequenas", "Pequenas"], ["moderadas", "Moderadas"], ["altas", "Altas"]].map(([v, l]) => (
          <div key={v} className="flex items-center gap-2"><RadioGroupItem value={v} id={`div-${v}`} /><Label htmlFor={`div-${v}`} className="cursor-pointer text-muted-foreground">{l}</Label></div>
        ))}
      </RadioGroup>
    </div>,
    <div key="investe" className="space-y-3">
      <Label className="text-foreground font-medium">Você investe mensalmente?</Label>
      <RadioGroup value={form.investe} onValueChange={v => setForm(p => ({ ...p, investe: v }))} className="space-y-2">
        {[["nao", "Não"], ["asvezes", "Às vezes"], ["sim", "Sim, regularmente"]].map(([v, l]) => (
          <div key={v} className="flex items-center gap-2"><RadioGroupItem value={v} id={`inv-${v}`} /><Label htmlFor={`inv-${v}`} className="cursor-pointer text-muted-foreground">{l}</Label></div>
        ))}
      </RadioGroup>
    </div>,
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Pergunta {step + 1} de 5</span>
        <span>{Math.round(((step + 1) / 5) * 100)}%</span>
      </div>
      <Progress value={((step + 1) / 5) * 100} className="h-1.5" />
      {questions[step]}
      <div className="flex gap-3">
        {step > 0 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Voltar</Button>}
        {step < 4 ? (
          <Button className="flex-1" onClick={() => setStep(s => s + 1)}>Próximo <ArrowRight size={14} /></Button>
        ) : (
          <Button className="flex-1" onClick={calcScore}>Ver resultado <Sparkles size={14} /></Button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   2 — Calculadora de Reserva de Emergência
   ════════════════════════════════════════════ */
function EmergencyCalc() {
  const navigate = useNavigate();
  const [gastos, setGastos] = useState("");
  const [estabilidade, setEstabilidade] = useState("");
  const [poupanca, setPoupanca] = useState("");
  const [result, setResult] = useState<null | { ideal: number; meses: number; chartData: { mes: number; acumulado: number }[] }>(null);

  const calc = () => {
    const g = Number(gastos) || 0;
    const p = Number(poupanca) || 0;
    const mult = estabilidade === "instavel" ? 12 : estabilidade === "moderada" ? 6 : 3;
    const ideal = g * mult;
    const meses = p > 0 ? Math.ceil(ideal / p) : 999;
    const chartData = [];
    for (let i = 0; i <= Math.min(meses, 60); i++) {
      chartData.push({ mes: i, acumulado: Math.min(p * i, ideal) });
    }
    setResult({ ideal, meses: Math.min(meses, 999), chartData });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label className="text-foreground font-medium">Gasto médio mensal (R$)</Label>
        <Input type="number" placeholder="Ex: 4000" value={gastos} onChange={e => setGastos(e.target.value)} className="bg-muted border-border" />
      </div>
      <div className="space-y-3">
        <Label className="text-foreground font-medium">Estabilidade de renda</Label>
        <RadioGroup value={estabilidade} onValueChange={setEstabilidade} className="space-y-2">
          {[["instavel", "Renda muito instável"], ["moderada", "Renda moderadamente estável"], ["estavel", "Renda muito estável"]].map(([v, l]) => (
            <div key={v} className="flex items-center gap-2"><RadioGroupItem value={v} id={`est-${v}`} /><Label htmlFor={`est-${v}`} className="cursor-pointer text-muted-foreground">{l}</Label></div>
          ))}
        </RadioGroup>
      </div>
      <div className="space-y-3">
        <Label className="text-foreground font-medium">Quanto você consegue guardar por mês? (R$)</Label>
        <Input type="number" placeholder="Ex: 500" value={poupanca} onChange={e => setPoupanca(e.target.value)} className="bg-muted border-border" />
      </div>
      <Button className="w-full" onClick={calc} disabled={!gastos || !estabilidade}>
        Calcular reserva ideal <ArrowRight size={14} />
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-2">
          <div className="bg-muted/30 rounded-xl p-5 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Reserva ideal recomendada</p>
            <p className="text-3xl font-bold text-primary font-['Space_Grotesk']">
              {result.ideal.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
            </p>
            {result.meses < 999 && (
              <p className="text-sm text-muted-foreground">
                Você alcançará sua reserva em aproximadamente <strong className="text-foreground">{result.meses} meses</strong>.
              </p>
            )}
          </div>
          {result.chartData.length > 2 && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.chartData}>
                  <defs>
                    <linearGradient id="emergGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160,78%,49%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(160,78%,49%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,25%,18%)" />
                  <XAxis dataKey="mes" stroke="hsl(207,25%,60%)" fontSize={11} tickFormatter={v => `${v}m`} />
                  <YAxis stroke="hsl(207,25%,60%)" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(200 35% 12%)", border: "1px solid hsl(200 25% 18%)", borderRadius: 8, color: "#fff" }} formatter={(v: number) => [v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }), "Acumulado"]} />
                  <Area type="monotone" dataKey="acumulado" stroke="hsl(160,78%,49%)" fill="url(#emergGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center italic">"Pequenas melhorias geram grandes resultados ao longo do tempo."</p>
          <Button className="w-full py-5" onClick={() => navigate("/auth")}>
            Criar conta e acompanhar sua reserva automaticamente <ArrowRight size={14} />
          </Button>
        </motion.div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   3 — Simulador de Liberdade Financeira
   (Progressive levels + 4% rule)
   ════════════════════════════════════════════ */
function FreedomSimulator() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ renda: "", gastos: "", patrimonio: "", rendimento: "8", investMensal: "500" });
  const [result, setResult] = useState<null | {
    rendaPassiva: number;
    percentual: number;
    levels: { name: string; desc: string; reached: boolean; target: number; icon: string }[];
    metas: { label: string; target: number; reached: boolean }[];
    projecoes: { label: string; anos: number }[];
  }>(null);

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const calc = () => {
    const gastos = Number(form.gastos) || 1;
    const patrimonio = Number(form.patrimonio) || 0;
    const rendAnual = (Number(form.rendimento) || 8) / 100;
    const investMensal = Number(form.investMensal) || 0;
    const rendaPassiva = (patrimonio * rendAnual) / 12;
    const percentual = Math.min(Math.round((rendaPassiva / gastos) * 100), 200);

    // Progressive levels
    const reserva6m = gastos * 6;
    const reserva12m = gastos * 12;
    const independenciaTarget = (gastos * 12) / 0.04; // 4% rule

    const levels = [
      {
        name: "Segurança Financeira Moderada",
        desc: "3 a 6 meses de reserva",
        reached: patrimonio >= gastos * 3,
        target: gastos * 3,
        icon: "🛡️",
      },
      {
        name: "Segurança Financeira Forte",
        desc: "6 a 12 meses de reserva",
        reached: patrimonio >= reserva6m,
        target: reserva6m,
        icon: "💪",
      },
      {
        name: "Renda Complementar",
        desc: "Investimentos pagam parte das despesas",
        reached: percentual >= 10,
        target: (gastos * 0.1 * 12) / rendAnual,
        icon: "📈",
      },
    ];

    // Progressive milestones
    const metas = [
      { label: "Reserva de emergência", target: gastos * 6, reached: patrimonio >= gastos * 6 },
      { label: "Patrimônio financeiro", target: 100000, reached: patrimonio >= 100000 },
      { label: "Patrimônio investido", target: 500000, reached: patrimonio >= 500000 },
    ];

    // Projections: how long to reach each level
    const projecoes: { label: string; anos: number }[] = [];
    const targets = [
      { label: "50% de liberdade financeira", target: (gastos * 0.5 * 12) / rendAnual },
    ];

    for (const t of targets) {
      if (patrimonio >= t.target) {
        projecoes.push({ label: t.label, anos: 0 });
      } else if (investMensal > 0) {
        let p = patrimonio;
        let years = 0;
        while (p < t.target && years < 60) {
          p = p * (1 + rendAnual) + investMensal * 12;
          years++;
        }
        if (years < 60) projecoes.push({ label: t.label, anos: years });
      }
    }

    setResult({ rendaPassiva, percentual, levels, metas, projecoes });
  };

  const progressBarBlocks = (pct: number) => {
    const filled = Math.min(Math.round(pct / 10), 10);
    return "█".repeat(filled) + "░".repeat(10 - filled);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: "renda", label: "Renda mensal (R$)", ph: "10000" },
          { key: "gastos", label: "Gastos mensais (R$)", ph: "7000" },
          { key: "patrimonio", label: "Valor total investido (R$)", ph: "100000" },
          { key: "rendimento", label: "Rendimento anual (%)", ph: "8" },
          { key: "investMensal", label: "Investimento mensal (R$)", ph: "500" },
        ].map(f => (
          <div key={f.key} className={f.key === "investMensal" ? "col-span-2 space-y-1" : "space-y-1"}>
            <Label className="text-xs text-muted-foreground">{f.label}</Label>
            <Input type="number" placeholder={f.ph} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="bg-muted border-border" />
          </div>
        ))}
      </div>
      <Button className="w-full" onClick={calc} disabled={!form.gastos || !form.patrimonio}>
        Calcular liberdade financeira <TrendingUp size={14} />
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pt-2">
          {/* Main score */}
          <div className="bg-muted/30 rounded-xl p-5 space-y-3">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Quanto da sua vida financeira já está livre?</p>
              <p className="text-4xl font-bold text-primary font-['Space_Grotesk'] mt-1">
                {Math.min(result.percentual, 100)}%
              </p>
              <p className="text-lg font-mono text-primary mt-1 tracking-wider">
                {progressBarBlocks(result.percentual)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Renda passiva: {result.rendaPassiva.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}/mês
              </p>
            </div>
          </div>

          {/* Progressive Levels */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target size={16} className="text-primary" /> Níveis de Liberdade Financeira
            </p>
            {result.levels.map((level, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                level.reached
                  ? "bg-primary/10 border-primary/30"
                  : "bg-muted/20 border-border"
              }`}>
                <span className="text-xl">{level.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-medium ${level.reached ? "text-primary" : "text-foreground"}`}>
                      {level.name}
                    </p>
                    {level.reached && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{level.desc}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Meta: {fmtBRL(level.target)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Progressive milestones */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">🎯 Metas Progressivas</p>
            {result.metas.map((meta, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  meta.reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${meta.reached ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmtBRL(meta.target)}</span>
                  </div>
                  <Progress value={Math.min(100, (Number(form.patrimonio) / meta.target) * 100)} className="h-1.5 mt-1" />
                </div>
              </div>
            ))}
          </div>

          {/* Projections */}
          {result.projecoes.length > 0 && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-2">
              {result.projecoes.map((p, i) => (
                <div key={i} className="text-sm text-primary flex items-start gap-2">
                  <span>💡</span>
                  <span>
                    {p.anos === 0
                      ? `Parabéns! Você já atingiu ${p.label}!`
                      : `Investindo ${fmtBRL(Number(form.investMensal))}/mês, você atinge ${p.label} em aproximadamente ${p.anos} anos.`
                    }
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center italic">
            "Isso é mais motivador que 'você precisa de 2 milhões'. Veja seu progresso real."
          </p>

          <Button className="w-full py-5" onClick={() => navigate("/auth")}>
            Criar conta para acompanhar sua evolução automaticamente <ArrowRight size={14} />
          </Button>
        </motion.div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN SECTION
   ════════════════════════════════════════════ */
export default function DiagnosticTools() {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const tools = [
    {
      id: "health",
      icon: Heart,
      title: "Teste de Saúde Financeira",
      desc: "Avalie sua organização financeira com base em 5 perguntas rápidas.",
      component: <HealthTest />,
    },
    {
      id: "emergency",
      icon: Shield,
      title: "Calculadora de Reserva de Emergência",
      desc: "Descubra quanto você deveria ter guardado e quanto tempo leva para chegar lá.",
      component: <EmergencyCalc />,
    },
    {
      id: "freedom",
      icon: TrendingUp,
      title: "Simulador de Liberdade Financeira",
      desc: "Veja seus níveis de liberdade financeira com metas progressivas e motivadoras.",
      component: <FreedomSimulator />,
    },
  ];

  return (
    <section id="ferramentas-gratuitas" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
            <Sparkles size={14} /> Ferramentas gratuitas
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] text-foreground mb-4">
            Descubra sua situação financeira em <span className="text-primary">poucos minutos</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Use nossas ferramentas gratuitas para entender sua saúde financeira, sua segurança financeira e seu nível de liberdade financeira.
          </p>
        </motion.div>

        {!activeTool ? (
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {tools.map((t, i) => (
              <motion.div key={t.id} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.1 }}>
                <Card className="bg-card/60 border-border hover:border-primary/40 transition-all hover:-translate-y-1 h-full cursor-pointer" onClick={() => setActiveTool(t.id)}>
                  <CardContent className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                      <t.icon size={32} className="text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{t.title}</h3>
                    <p className="text-sm text-muted-foreground">{t.desc}</p>
                    <Button variant="outline" className="mt-2">
                      Começar análise <ArrowRight size={14} />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto mt-12">
            <Card className="bg-card/60 border-border">
              <CardContent className="p-8">
                <button onClick={() => setActiveTool(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
                  <ChevronLeft size={16} /> Voltar às ferramentas
                </button>
                <h3 className="text-xl font-bold text-foreground mb-6 font-['Space_Grotesk']">
                  {tools.find(t => t.id === activeTool)?.title}
                </h3>
                {tools.find(t => t.id === activeTool)?.component}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </section>
  );
}
