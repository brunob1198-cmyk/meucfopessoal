import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Lancamentos from "./pages/Lancamentos";
import DREDetalhado from "./pages/DREDetalhado";
import DREAjustado from "./pages/DREAjustado";
import Planejador from "./pages/Planejador";
import Dashboard from "./pages/Dashboard";
import Inteligencia from "./pages/Inteligencia";
import Compromissos from "./pages/Compromissos";
import BalancoPatrimonial from "./pages/BalancoPatrimonial";
import Perfil from "./pages/Perfil";
import SimuladorFinanceiro from "./pages/SimuladorFinanceiro";
import Tutorial from "./pages/Tutorial";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/" element={<ProtectedRoute><Lancamentos /></ProtectedRoute>} />
            <Route path="/dre" element={<ProtectedRoute><DREDetalhado /></ProtectedRoute>} />
            <Route path="/dre-ajustado" element={<ProtectedRoute><DREAjustado /></ProtectedRoute>} />
            <Route path="/planejador" element={<ProtectedRoute><Planejador /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inteligencia" element={<ProtectedRoute><Inteligencia /></ProtectedRoute>} />
            <Route path="/compromissos" element={<ProtectedRoute><Compromissos /></ProtectedRoute>} />
            <Route path="/balanco" element={<ProtectedRoute><BalancoPatrimonial /></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
            <Route path="/simulador" element={<ProtectedRoute><SimuladorFinanceiro /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
