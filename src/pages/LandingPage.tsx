import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3, Target, Star, Brain, FileUp, Link2, Map,
  TrendingUp, Eye, Wallet, Landmark, ShieldCheck, ArrowRight,
  CheckCircle2, ChevronRight, ChevronDown, Users, Clock, Zap,
  Instagram, Linkedin, Youtube, Twitter, Building2, X,
  DollarSign, FileText, FileBarChart, CalendarRange, Scale,
  Calculator, UserCircle, Activity, Heart, ArrowDownUp, Sparkles,
  Menu, HelpCircle, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import dashboardMockup from "@/assets/dashboard-mockup.png";
import imgDashboard from "@/assets/landing-dashboard.jpg";
import imgAI from "@/assets/landing-ai-consultant.jpg";
import imgPatrimonio from "@/assets/landing-patrimonio.jpg";
import imgHealthScore from "@/assets/landing-health-score.jpg";
import imgWealthMap from "@/assets/landing-wealth-map.jpg";
import imgTimeline from "@/assets/landing-timeline.jpg";
import DiagnosticTools from "@/components/landing/DiagnosticTools";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const }
  })
};
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

/* Tutorial content extracted for feature descriptions */
const featureDescriptions: Record<string, { title: string; icon: any; content: string }> = {
  lancamentos: {
    title: "Lançamentos",
    icon: DollarSign,
    content: `A tela de **Lançamentos** é o coração do sistema. Registre todas as suas movimentações financeiras — receitas, despesas, custos, investimentos e descontos.

**Recursos principais:**
- Categorias e subcategorias organizadas por tipo DRE (receita, despesa, custo, etc.)
- Lançamentos parcelados com divisão automática
- Importação em massa via Excel com modelo pronto
- Edição inline, movimentação entre categorias e exclusão com um clique
- Limite mensal no plano gratuito com contador visual

**Dica:** Registre seus lançamentos semanalmente para não acumular e ter análises mais precisas do CFO Digital IA.`
  },
  dre: {
    title: "DRE Detalhado",
    icon: FileText,
    content: `O **DRE (Demonstrativo de Resultado do Exercício)** organiza todas as suas receitas e despesas numa estrutura hierárquica padronizada para calcular indicadores como Lucro Bruto, EBITDA e Resultado Líquido.

**Estrutura:** Receita Bruta → Descontos → Receita Líquida → Custos → Lucro Bruto → Despesas → EBITDA → Depreciação → EBIT → Resultado Financeiro → Outras Receitas → Impostos → Resultado Líquido.

**Recursos:** Filtro por período, expansão de categorias, detalhamento com lupa, projeções em verde, exportação para Excel e PDF.`
  },
  dreAjustado: {
    title: "DRE Ajustado",
    icon: FileBarChart,
    content: `Versão **resumida e executiva** do DRE Detalhado. Mostra apenas linhas totais com **margens percentuais** em relação à Receita Bruta e comparativo Realizado vs Projetado lado a lado.

Ideal para quem quer uma visão rápida da saúde financeira sem se perder nos detalhes.`
  },
  planejador: {
    title: "Planejador",
    icon: Target,
    content: `Ferramenta de **orçamento e projeção mensal**. Defina quanto pretende gastar ou receber em cada subcategoria para meses futuros.

**Recursos:** Preenchimento por célula, botão Replicar para copiar valores, meses passados bloqueados, integração com DRE (valores em verde), Dashboard e CFO Digital.

**Dica:** Projete pelo menos 6 meses à frente usando a média dos últimos 3 meses como base.`
  },
  dashboard: {
    title: "Dashboard",
    icon: LayoutDashboard,
    content: `Painel de controle visual com **gráficos e indicadores** que permitem entender sua situação financeira em segundos.

**KPIs:** Receita Total, Despesa Total, Resultado Líquido, Taxa de Economia. **Gráficos:** Evolução mensal, distribuição de gastos por categoria, comparativo realizado vs projetado.

**Meta ideal:** Taxa de economia de pelo menos 20% da receita líquida.`
  },
  inteligencia: {
    title: "CFO Digital IA",
    icon: Brain,
    content: `Usa **inteligência artificial** para analisar automaticamente todos os seus dados financeiros e gerar recomendações personalizadas.

**4 seções da análise:** Insights (tendências e padrões), Alertas (situações que requerem atenção), Sugestões (recomendações acionáveis), Previsão (projeção dos próximos 3 meses).

O histórico de análises é salvo automaticamente para acompanhar evolução ao longo do tempo.`
  },
  compromissos: {
    title: "Mapa de Compromissos",
    icon: CalendarRange,
    content: `Mostra todos os seus **compromissos financeiros futuros** — principalmente parcelas de compras parceladas. Essencial para planejar fluxo de caixa e evitar surpresas.

Para cada compromisso: subcategoria, valor da parcela, número da parcela e comentário. **Regra prática:** compromissos fixos não devem ultrapassar 50% da receita líquida.`
  },
  balanco: {
    title: "Balanço Patrimonial",
    icon: Scale,
    content: `"Fotografia" do seu patrimônio: tudo que você **possui** (ativos), tudo que você **deve** (passivos) e o **patrimônio líquido**.

**Ativos:** Contas, investimentos, imóveis, veículos. **Passivos:** Cartão de crédito, empréstimos, financiamentos. Gráfico de evolução histórica com snapshot mensal automático.`
  },
  simulador: {
    title: "Simulador Financeiro",
    icon: Calculator,
    content: `Projete cenários e entenda como suas decisões de hoje impactarão seu patrimônio nos próximos meses ou anos.

Configure cenários de receita, despesas, investimentos e período. O sistema gera gráficos de evolução, análise de sustentabilidade e comparação de cenários.`
  },
  healthScore: {
    title: "Score de Saúde Financeira",
    icon: Activity,
    content: `Nota de **0 a 100** para sua situação financeira baseada em 5 pilares: Capacidade de Poupança, Controle de Despesas, Liquidez, Endividamento e Reserva de Emergência.

Calculado automaticamente com dados do DRE e Balanço Patrimonial. Histórico mensal para acompanhar evolução.`
  },
  mapaSonhos: {
    title: "Mapa de Sonhos Financeiros",
    icon: Star,
    content: `Vincule sua disciplina financeira a **objetivos de vida concretos** — casa, viagem, independência financeira.

**Recursos:** Categorias personalizadas, cálculo automático de status (Em Progresso, Próximo, Em Risco, Concluído), valor mensal necessário e detecção inteligente de conquistas.`
  },
  mapaRiqueza: {
    title: "Mapa da Riqueza",
    icon: Map,
    content: `Visualize seu **patrimônio completo** com distribuição por categorias, evolução ao longo do tempo e análise da composição dos seus investimentos e bens.`
  },
  openFinance: {
    title: "Open Finance",
    icon: Landmark,
    content: `Conecte contas bancárias e cartões via **Open Finance (Pluggy)** para importação automática de transações.

**Categorização em 3 níveis:** Regras personalizadas → Regras padrão → Revisão manual. Credenciais bancárias nunca são armazenadas no sistema.`
  },
  revisarTransacoes: {
    title: "Revisar Transações",
    icon: ArrowDownUp,
    content: `Valide transações importadas via Open Finance antes de alimentar o DRE. Confirme, altere categorias ou ignore transações. O sistema aprende com suas escolhas.`
  },
  perfil: {
    title: "Meu Perfil",
    icon: UserCircle,
    content: `Configure preferências pessoais, personalize a aparência com logo próprio e gerencie compartilhamento de dados com cônjuge, contador ou consultor financeiro.`
  },
  fluxoCaixa: {
    title: "Fluxo de Caixa",
    icon: Heart,
    content: `Visão consolidada das entradas e saídas financeiras ao longo do tempo, complementando o DRE com foco na movimentação real de dinheiro.`
  },
};

const faqItems = [
  {
    q: "Como lançar meu patrimônio?",
    a: "Acesse o **Balanço Patrimonial** no menu lateral. Clique em 'Novo Ativo' para cadastrar bens (imóveis, investimentos, veículos) ou 'Novo Passivo' para dívidas (financiamentos, cartão de crédito). Informe nome, categoria, valor atual e data de aquisição. O patrimônio líquido é calculado automaticamente."
  },
  {
    q: "Como fazer lançamentos?",
    a: "Na tela de **Lançamentos**, localize a subcategoria desejada (ex: Combustível em AUTOMÓVEL). Clique no '+' à direita, preencha valor, data e comentário opcional, e clique em Salvar. Para compras parceladas, ative o switch 'Parcelado', informe o valor total e o número de parcelas."
  },
  {
    q: "Como importar extratos bancários?",
    a: "Você tem duas opções: 1) **Importar Excel**: Clique em 'Importar Excel', baixe o modelo, preencha com seus dados e faça upload. 2) **Open Finance**: Conecte suas contas bancárias automaticamente via 'Contas Conectadas' no menu."
  },
  {
    q: "Como funciona o CFO Digital IA?",
    a: "Acesse **Inteligência** no menu, selecione o período desejado (recomendado: últimos 6-12 meses) e clique em 'Gerar Análise'. A IA analisa seus lançamentos e gera insights, alertas, sugestões e previsões personalizadas com números concretos dos seus dados."
  },
  {
    q: "Como criar metas financeiras?",
    a: "Use o **Mapa de Sonhos Financeiros** para criar objetivos de vida (casa, viagem, aposentadoria). Defina nome, valor necessário, valor acumulado e data desejada. O sistema calcula automaticamente o valor mensal necessário e monitora seu progresso."
  },
  {
    q: "Como acompanhar minha saúde financeira?",
    a: "O **Score de Saúde Financeira** calcula uma nota de 0 a 100 baseada em 5 pilares: poupança, controle de despesas, liquidez, endividamento e reserva de emergência. Acesse pelo menu lateral e acompanhe a evolução mensal."
  },
  {
    q: "Como compartilhar meus dados com um contador?",
    a: "Em **Meu Perfil**, use a seção 'Compartilhamento de Acesso'. Informe o e-mail da pessoa, selecione a permissão (Visualização ou Edição) e envie o convite. A pessoa precisa ter conta no sistema."
  },
  {
    q: "O que é o planejador e para que serve?",
    a: "O **Planejador** é sua ferramenta de orçamento mensal. Defina quanto pretende gastar em cada categoria para meses futuros. Os valores aparecem em verde no DRE para comparar planejado vs realizado. Projete pelo menos 6 meses à frente."
  },
];

/* ───── NAVBAR ───── */
function Navbar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [featuresSubmenu, setFeaturesSubmenu] = useState(false);
  const [featureDetail, setFeatureDetail] = useState<string | null>(null);
  const [companyDialog, setCompanyDialog] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDropdown = (name: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveDropdown(name);
  };
  const closeDropdown = () => {
    timeoutRef.current = setTimeout(() => { setActiveDropdown(null); setFeaturesSubmenu(false); }, 200);
  };
  const keepOpen = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };

  const featureKeys = Object.keys(featureDescriptions);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-xl font-['Space_Grotesk'] text-foreground cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Meu CFO <span className="text-primary">Pessoal</span>
          </span>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {/* Produto */}
            <div className="relative" onMouseEnter={() => openDropdown("produto")} onMouseLeave={closeDropdown}>
              <button className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                Produto <ChevronDown size={14} />
              </button>
              {activeDropdown === "produto" && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-2xl py-2 min-w-[200px]" onMouseEnter={keepOpen} onMouseLeave={closeDropdown}>
                  <div
                    className="relative"
                    onMouseEnter={() => setFeaturesSubmenu(true)}
                    onMouseLeave={() => setFeaturesSubmenu(false)}
                  >
                    <button className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-between">
                      Funcionalidades <ChevronRight size={14} />
                    </button>
                    {featuresSubmenu && (
                      <div className="absolute left-full top-0 ml-1 bg-card border border-border rounded-xl shadow-2xl py-2 min-w-[220px] max-h-[420px] overflow-y-auto">
                        {featureKeys.map(key => {
                          const f = featureDescriptions[key];
                          const Icon = f.icon;
                          return (
                            <button key={key} onClick={() => { setFeatureDetail(key); setActiveDropdown(null); setFeaturesSubmenu(false); }}
                              className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center gap-2">
                              <Icon size={14} className="text-primary shrink-0" /> {f.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })} className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    Como funciona
                  </button>
                  <button onClick={() => document.getElementById("ferramentas-gratuitas")?.scrollIntoView({ behavior: "smooth" })} className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    Ferramentas gratuitas
                  </button>
                </div>
              )}
            </div>

            {/* Empresa */}
            <div className="relative" onMouseEnter={() => openDropdown("empresa")} onMouseLeave={closeDropdown}>
              <button className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                Empresa <ChevronDown size={14} />
              </button>
              {activeDropdown === "empresa" && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-2xl py-2 min-w-[180px]" onMouseEnter={keepOpen} onMouseLeave={closeDropdown}>
                  <button onClick={() => { setCompanyDialog(true); setActiveDropdown(null); }} className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    Sobre
                  </button>
                  <button className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    Contato
                  </button>
                </div>
              )}
            </div>

            {/* Legal */}
            <div className="relative" onMouseEnter={() => openDropdown("legal")} onMouseLeave={closeDropdown}>
              <button className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                Legal <ChevronDown size={14} />
              </button>
              {activeDropdown === "legal" && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-2xl py-2 min-w-[200px]" onMouseEnter={keepOpen} onMouseLeave={closeDropdown}>
                  <button className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">Política de privacidade</button>
                  <button className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">Termos de uso</button>
                </div>
              )}
            </div>

            {/* FAQ link */}
            <button onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => navigate("/auth")}>Entrar</Button>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-foreground"><Menu size={22} /></button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-card border-t border-border p-4 space-y-3">
            <button onClick={() => { setCompanyDialog(true); setMobileOpen(false); }} className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-2">Sobre a Empresa</button>
            <button onClick={() => { document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" }); setMobileOpen(false); }} className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-2">FAQ</button>
            <button onClick={() => { document.getElementById("ferramentas-gratuitas")?.scrollIntoView({ behavior: "smooth" }); setMobileOpen(false); }} className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-2">Ferramentas gratuitas</button>
          </div>
        )}
      </nav>

      {/* Company Dialog */}
      <Dialog open={companyDialog} onOpenChange={setCompanyDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-['Space_Grotesk'] flex items-center gap-3">
              <Building2 className="text-primary" size={28} /> BSS Assessoria
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-foreground leading-relaxed">
            <p>A <strong>BSS Assessoria</strong> atua no apoio estratégico a empresas que buscam maior organização financeira, controle operacional e eficiência na gestão de contratos e faturamento.</p>
            <p>Nosso trabalho é focado na estruturação de processos, melhoria de controles e geração de informações gerenciais confiáveis, permitindo que a empresa tenha maior previsibilidade financeira, melhor gestão das operações e maior segurança na tomada de decisões.</p>
            <p>A atuação da BSS Assessoria é voltada principalmente para empresas que operam com contratos, projetos ou obras, onde o alinhamento entre produção, faturamento e gestão contratual é essencial para garantir resultados financeiros consistentes.</p>
            <p className="text-primary font-medium">Nosso objetivo é atuar como parceiro estratégico da gestão, contribuindo para a profissionalização dos processos internos e para a melhoria contínua da performance da empresa.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feature Detail Dialog */}
      <Dialog open={!!featureDetail} onOpenChange={() => setFeatureDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {featureDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-['Space_Grotesk'] flex items-center gap-3">
                  {(() => { const Icon = featureDescriptions[featureDetail].icon; return <Icon className="text-primary" size={24} />; })()}
                  {featureDescriptions[featureDetail].title}
                </DialogTitle>
              </DialogHeader>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {featureDescriptions[featureDetail].content.split("**").map((part, i) =>
                  i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
                )}
              </div>
              <Button className="mt-4" onClick={() => { setFeatureDetail(null); navigate("/auth"); }}>
                Experimentar agora <ArrowRight size={14} />
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ───── HERO ───── */
function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/40" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center w-full">
        <motion.div initial="hidden" animate="visible" variants={stagger}>
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
            <Zap size={14} /> Gestão financeira inteligente com IA
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl font-bold font-['Space_Grotesk'] leading-tight text-foreground mb-6">
            Controle total da sua{" "}
            <span className="text-primary">vida financeira.</span>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-muted-foreground max-w-lg mb-4">
            Lance seus gastos em segundos, planeje seu futuro com o Planejador e receba análises personalizadas da nossa <strong className="text-primary">IA financeira</strong>.
          </motion.p>
          <motion.div variants={fadeUp} custom={2.5} className="flex flex-col gap-2 mb-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-primary" /> Lançamentos rápidos e intuitivos</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-primary" /> Planejador para visão clara do futuro</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-primary" /> Consultor IA que analisa seus dados em tempo real</span>
          </motion.div>
          <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-4">
            <Button size="lg" className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/20" onClick={() => navigate("/auth")}>
              Começar gratuitamente <ArrowRight size={18} />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 py-6 rounded-xl border-border" onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}>
              Ver como funciona
            </Button>
          </motion.div>
          <motion.div variants={fadeUp} custom={4} className="flex items-center gap-6 mt-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-primary" /> Grátis para começar</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-primary" /> Dados seguros</span>
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="hidden lg:block">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl blur-xl" />
            <img src={dashboardMockup} alt="Dashboard do Meu CFO Pessoal mostrando gráficos financeiros" className="relative rounded-2xl border border-border shadow-2xl shadow-primary/10 w-full" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───── AI HIGHLIGHT ───── */
function AIHighlight() {
  const navigate = useNavigate();
  return (
    <section className="py-24 bg-secondary/20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
              <Brain size={14} /> Carro-chefe
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] text-foreground mb-6">
              Inteligência Artificial que <span className="text-primary">entende suas finanças</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-muted-foreground text-lg mb-6">
              Nosso CFO Digital IA analisa automaticamente todos os seus dados financeiros e gera recomendações personalizadas — como um consultor financeiro que conhece cada detalhe dos seus gastos.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="space-y-3 mb-8">
              {[
                "Insights com números concretos dos seus dados reais",
                "Alertas automáticos quando algo requer atenção",
                "Sugestões acionáveis e específicas para sua realidade",
                "Previsão dos próximos 3 meses baseada no histórico"
              ].map((item, i) => (
                <div key={i} className="flex gap-2 items-start text-sm">
                  <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </motion.div>
            <motion.div variants={fadeUp} custom={4}>
              <Button onClick={() => navigate("/auth")}>Experimentar a IA <ArrowRight size={14} /></Button>
            </motion.div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <img src={imgAI} alt="Consultor Financeiro IA analisando dados" className="rounded-2xl border border-border shadow-2xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ───── SHOWCASE GALLERY ───── */
function Showcase() {
  const images = [
    { src: imgDashboard, title: "Dashboard Financeiro", desc: "Visão completa com gráficos e KPIs" },
    { src: imgPatrimonio, title: "Gráfico de Patrimônio", desc: "Evolução patrimonial ao longo do tempo" },
    { src: imgHealthScore, title: "Score de Saúde Financeira", desc: "Nota de 0 a 100 com 5 pilares" },
    { src: imgWealthMap, title: "Mapa da Riqueza", desc: "Distribuição de ativos e investimentos" },
    { src: imgTimeline, title: "Timeline de Gastos", desc: "Todas as atividades em ordem cronológica" },
  ];

  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] text-foreground mb-4">
            Veja o app em <span className="text-primary">ação</span>
          </h2>
          <p className="text-muted-foreground">Telas reais do seu futuro painel financeiro.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((img, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
              <Card className="bg-card/60 border-border overflow-hidden hover:border-primary/40 transition-all hover:-translate-y-1">
                <img src={img.src} alt={img.title} className="w-full h-44 object-cover" loading="lazy" />
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground text-sm">{img.title}</h3>
                  <p className="text-xs text-muted-foreground">{img.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───── FEATURES ───── */
function Features() {
  const features = [
    { icon: DollarSign, title: "Lançamentos intuitivos", desc: "Registre gastos em segundos com categorização automática e parcelamento inteligente." },
    { icon: BarChart3, title: "Dashboard financeiro", desc: "Visão completa com gráficos, KPIs e evolução patrimonial." },
    { icon: Target, title: "Planejador de futuro", desc: "Crie orçamentos mensais e compare planejado vs realizado." },
    { icon: Brain, title: "Consultor IA", desc: "Análises automáticas com insights, alertas e recomendações personalizadas." },
    { icon: FileUp, title: "Importação automática", desc: "Importe extratos em Excel ou conecte via Open Finance." },
    { icon: Star, title: "Mapa de Sonhos", desc: "Transforme objetivos de vida em metas acompanháveis." },
    { icon: Map, title: "Mapa de riqueza", desc: "Visualize patrimônio, dívidas e evolução completa." },
    { icon: Activity, title: "Score de saúde financeira", desc: "Nota de 0 a 100 baseada em 5 pilares fundamentais." },
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

/* ───── HOW IT WORKS ───── */
function HowItWorks() {
  const steps = [
    { num: "01", title: "Lance seus gastos", desc: "Registre manualmente ou conecte suas contas via Open Finance." },
    { num: "02", title: "Planeje o futuro", desc: "Use o Planejador para definir orçamentos e metas por categoria." },
    { num: "03", title: "Receba análises da IA", desc: "O CFO Digital analisa seus dados e gera recomendações personalizadas." },
  ];
  return (
    <section id="como-funciona" className="py-24">
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

/* ───── FAQ ───── */
function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <section id="faq" className="py-24 bg-secondary/20">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
            <HelpCircle size={14} /> Perguntas frequentes
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] text-foreground">
            Tire suas <span className="text-primary">dúvidas</span>
          </h2>
        </motion.div>
        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.05}>
              <Card className="bg-card/60 border-border overflow-hidden">
                <button
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                >
                  <span className="font-medium text-foreground text-sm">{item.q}</span>
                  {openIdx === i ? <ChevronDown size={18} className="text-primary shrink-0" /> : <ChevronRight size={18} className="text-muted-foreground shrink-0" />}
                </button>
                {openIdx === i && (
                  <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {item.a.split("**").map((part, j) =>
                      j % 2 === 1 ? <strong key={j} className="text-foreground">{part}</strong> : <span key={j}>{part}</span>
                    )}
                  </div>
                )}
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
    <section className="py-24">
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
    <section className="py-24 bg-secondary/20">
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
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} CFO Pessoal — BSS Assessoria. Todos os direitos reservados.</p>
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
      <Navbar />
      <Hero />
      <AIHighlight />
      <Showcase />
      <Features />
      <HowItWorks />
      <DiagnosticTools />
      <FAQ />
      <SocialProof />
      <FinalCTA />
      <Footer />
    </div>
  );
}
