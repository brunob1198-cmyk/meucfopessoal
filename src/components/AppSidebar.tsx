import {
  DollarSign,
  FileText,
  FileBarChart,
  Target,
  LayoutDashboard,
  LogOut,
  TrendingUp,
  Sparkles,
  CalendarRange,
  UserCircle,
  Scale,
  Calculator,
  HelpCircle,
  Banknote,
  HeartPulse } from
'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar } from
'@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const items = [
{ title: 'Lançamentos', url: '/', icon: DollarSign },
{ title: 'DRE Detalhado', url: '/dre', icon: FileText },
{ title: 'DRE Ajustado', url: '/dre-ajustado', icon: FileBarChart },
{ title: 'Planejador', url: '/planejador', icon: Target },
{ title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
{ title: 'Fluxo de Caixa', url: '/fluxo-caixa', icon: Banknote },
{ title: 'Financial Health Score', url: '/health-score', icon: HeartPulse },
{ title: 'CFO Digital IA', url: '/inteligencia', icon: Sparkles },
{ title: 'Mapa de Compromissos', url: '/compromissos', icon: CalendarRange },
{ title: 'Balanço Patrimonial', url: '/balanco', icon: Scale },
{ title: 'Visão Futuro Financeiro', url: '/simulador', icon: Calculator },
{ title: 'Tutorial & Ajuda', url: '/tutorial', icon: HelpCircle },
{ title: 'Meu Perfil', url: '/perfil', icon: UserCircle }];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="gap-2 py-5">
            <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 text-sidebar-primary" />
            </div>
            {!collapsed && (
              <span className="font-bold text-sm tracking-tight text-sidebar-foreground">
                CFO <span className="text-sidebar-primary">Pessoal</span>
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) =>
              <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                    to={item.url}
                    end={item.url === '/'}
                    className="hover:bg-sidebar-accent transition-all duration-200 rounded-lg"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium border-l-2 border-sidebar-primary">
                    
                      <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span className="font-medium text-sidebar-foreground text-[13px]">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200">
          
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && 'Sair'}
        </Button>
      </SidebarFooter>
    </Sidebar>);

}
