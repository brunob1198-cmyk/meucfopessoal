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
  Scale } from
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
{ title: 'CFO Digital', url: '/inteligencia', icon: Sparkles },
{ title: 'Compromissos', url: '/compromissos', icon: CalendarRange },
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
          <SidebarGroupLabel className="gap-2">
            <TrendingUp className="h-4 w-4" />
            {!collapsed && <span className="font-bold">DRE Pessoal</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) =>
              <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                    to={item.url}
                    end={item.url === '/'}
                    className="hover:bg-sidebar-accent"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                    
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span className="font-medium text-neutral-50">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
          
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && 'Sair'}
        </Button>
      </SidebarFooter>
    </Sidebar>);

}