import {
  DollarSign, FileText, FileBarChart, Target, LayoutDashboard,
  LogOut, TrendingUp, Sparkles, CalendarRange, UserCircle,
  Scale, Calculator, HelpCircle, Banknote, HeartPulse, Gem, Brain, Star
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const items = [
  { title: 'Lançamentos', url: '/', icon: DollarSign },
  { title: 'DRE Detalhado', url: '/dre', icon: FileText },
  { title: 'DRE Ajustado', url: '/dre-ajustado', icon: FileBarChart },
  { title: 'Planejador', url: '/planejador', icon: Target },
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Fluxo de Caixa', url: '/fluxo-caixa', icon: Banknote },
  { title: 'Score de Saúde Financeira', url: '/health-score', icon: HeartPulse },
  { title: 'Consultor Financeiro IA', url: '/inteligencia', icon: Sparkles },
  { title: 'Mapa de Compromissos', url: '/compromissos', icon: CalendarRange },
  { title: 'Balanço Patrimonial', url: '/balanco', icon: Scale },
  { title: 'Mapa de Riqueza', url: '/mapa-riqueza', icon: Gem },
  { title: 'Mapa de Sonhos', url: '/mapa-sonhos', icon: Star },
  { title: 'Inteligência de Dados', url: '/data-intelligence', icon: Brain },
  { title: 'Visão Futuro Financeiro', url: '/simulador', icon: Calculator },
  { title: 'Tutorial & Ajuda', url: '/tutorial', icon: HelpCircle },
  { title: 'Meu Perfil', url: '/perfil', icon: UserCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="relative" style={{ background: 'hsl(200 45% 5%)' }}>
        {/* Subtle glow at top */}
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" style={{ background: 'linear-gradient(180deg, hsl(160 78% 49% / 0.04) 0%, transparent 100%)' }} />

        <SidebarGroup>
          <SidebarGroupLabel className="gap-2 py-5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 glow-border" style={{ background: 'hsl(160 78% 49% / 0.15)' }}>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            {!collapsed && (
              <span className="font-display font-bold text-sm tracking-tight text-foreground">
                CFO <span className="text-gradient">Pessoal</span>
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-sidebar-accent transition-all duration-200 rounded-lg group"
                      activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary"
                    >
                      <item.icon className="mr-2 h-4 w-4 flex-shrink-0 group-hover:text-primary transition-colors" />
                      {!collapsed && <span className="font-medium text-sidebar-foreground text-[13px] group-hover:text-foreground transition-colors">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/30" style={{ background: 'hsl(200 45% 5%)' }}>
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          onClick={signOut}
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all duration-200"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && 'Sair'}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
