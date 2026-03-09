import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { LogoUpload } from '@/components/LogoUpload';
import { BigBAssistant } from '@/components/BigBAssistant';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/30 px-4 shrink-0 fintech-gradient relative">
            <SidebarTrigger className="mr-4 text-primary-foreground/70 hover:text-primary-foreground" />
            <LogoUpload />
            <div className="absolute left-1/2 -translate-x-1/2 text-[15px] font-medium tracking-[0.3em] uppercase text-primary-foreground/60 whitespace-nowrap hidden sm:block">
              Sistema Operacional da Vida Financeira
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </div>
        <BigBAssistant />
      </div>
    </SidebarProvider>
  );
}
