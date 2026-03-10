import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { LogoUpload } from '@/components/LogoUpload';
import { BigBAssistant } from '@/components/BigBAssistant';
import fintechBg from '@/assets/fintech-bg.jpg';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full relative">
        {/* Background layers */}
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-20"
          style={{ backgroundImage: `url(${fintechBg})` }}
        />
        <div className="fixed inset-0 -z-10 fintech-gradient-deep" style={{ opacity: 0.92 }} />
        <div className="fixed inset-0 -z-10 grid-bg" />

        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/30 px-4 shrink-0 relative" style={{ background: 'hsl(200 45% 6% / 0.8)', backdropFilter: 'blur(12px)' }}>
            <SidebarTrigger className="mr-4 text-muted-foreground hover:text-foreground transition-colors" />
            <LogoUpload />
            <div className="absolute left-1/2 -translate-x-1/2 text-[13px] font-display font-medium tracking-[0.4em] uppercase text-muted-foreground whitespace-nowrap hidden sm:block">
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
