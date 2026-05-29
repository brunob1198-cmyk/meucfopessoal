import { useState, useEffect } from 'react';
import {
  DollarSign, FileText, FileBarChart, Target, LayoutDashboard,
  LogOut, TrendingUp, Sparkles, CalendarRange, UserCircle,
  Scale, Calculator, HelpCircle, Banknote, HeartPulse, Star,
  Landmark, ArrowDownUp, GripVertical
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';

const defaultItems = [
  { id: 'lancamentos', title: 'Lançamentos', url: '/', icon: DollarSign },
  { id: 'dre-detalhado', title: 'DRE Detalhado', url: '/dre', icon: FileText },
  { id: 'dre-ajustado', title: 'DRE Ajustado', url: '/dre-ajustado', icon: FileBarChart },
  { id: 'planejador', title: 'Planejador', url: '/planejador', icon: Target },
  { id: 'dashboard', title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { id: 'fluxo-caixa', title: 'Fluxo de Caixa', url: '/fluxo-caixa', icon: Banknote },
  { id: 'health-score', title: 'Score de Saúde Financeira', url: '/health-score', icon: HeartPulse },
  { id: 'inteligencia', title: 'Consultor Financeiro IA', url: '/inteligencia', icon: Sparkles },
  { id: 'compromissos', title: 'Mapa de Compromissos', url: '/compromissos', icon: CalendarRange },
  { id: 'balanco', title: 'Balanço Patrimonial', url: '/balanco', icon: Scale },
  { id: 'mapa-sonhos', title: 'Mapa de Sonhos', url: '/mapa-sonhos', icon: Star },
  { id: 'contas-conectadas', title: 'Contas Conectadas', url: '/contas-conectadas', icon: Landmark },
  { id: 'revisar-transacoes', title: 'Revisar Transações', url: '/revisar-transacoes', icon: ArrowDownUp },
  { id: 'simulador', title: 'Simulador Financeiro', url: '/simulador', icon: Calculator },
  { id: 'tutorial', title: 'Tutorial & Ajuda', url: '/tutorial', icon: HelpCircle },
  { id: 'perfil', title: 'Meu Perfil', url: '/perfil', icon: UserCircle },
];

interface SortableMenuItemProps {
  item: typeof defaultItems[0];
  collapsed: boolean;
}

function SortableMenuItem({ item, collapsed }: SortableMenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/sortable">
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <div className="flex items-center w-full">
            <NavLink
              to={item.url}
              end={item.url === '/'}
              className="hover:bg-sidebar-accent transition-all duration-200 rounded-lg group flex-grow flex items-center"
              activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary"
            >
              <item.icon className="mr-2 h-4 w-4 flex-shrink-0 group-hover:text-primary transition-colors" />
              {!collapsed && (
                <span className="font-medium text-sidebar-foreground text-[13px] group-hover:text-foreground transition-colors">
                  {item.title}
                </span>
              )}
            </NavLink>
            
            {!collapsed && (
              <div
                {...attributes}
                {...listeners}
                className="opacity-0 group-hover/sortable:opacity-100 cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-opacity"
                title="Arraste para reordenar"
              >
                <GripVertical className="h-3 w-3" />
              </div>
            )}
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </div>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, user } = useAuth();
  const [menuItems, setMenuItems] = useState(defaultItems);

  useEffect(() => {
    if (user?.id) {
      const savedOrder = localStorage.getItem(`sidebar-order-${user.id}`);
      if (savedOrder) {
        try {
          const orderIds = JSON.parse(savedOrder) as string[];
          const orderedItems = [...defaultItems].sort((a, b) => {
            return orderIds.indexOf(a.id) - orderIds.indexOf(b.id);
          });
          
          // Only use saved order if it contains all current items (to handle menu updates)
          if (orderedItems.length === defaultItems.length) {
            setMenuItems(orderedItems);
          }
        } catch (e) {
          console.error("Error loading sidebar order", e);
        }
      }
    }
  }, [user?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setMenuItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        if (user?.id) {
          localStorage.setItem(`sidebar-order-${user.id}`, JSON.stringify(newItems.map(i => i.id)));
        }
        
        return newItems;
      });
    }
  };

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
                Meu CFO <span className="text-gradient">Pessoal</span>
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
            >
              <SidebarMenu>
                <SortableContext
                  items={menuItems.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {menuItems.map((item) => (
                    <SortableMenuItem key={item.id} item={item} collapsed={collapsed} />
                  ))}
                </SortableContext>
              </SidebarMenu>
            </DndContext>
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
