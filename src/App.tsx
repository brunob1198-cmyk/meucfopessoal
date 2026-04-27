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
import FluxoCaixa from "./pages/FluxoCaixa";
import Tutorial from "./pages/Tutorial";
import FinancialHealthScorePage from "./pages/FinancialHealthScore";

import MapaSonhos from "./pages/MapaSonhos";

import ContasConectadas from "./pages/ContasConectadas";
import RevisarTransacoes from "./pages/RevisarTransacoes";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";

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
  if (user) return <Navigate to="/app" replace />;
  return <Auth />;
}

function LandingRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/app" replace />;
  return <LandingPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingRoute />} />
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/app" element={<ProtectedRoute><Lancamentos /></ProtectedRoute>} />
            <Route path="/dre" element={<ProtectedRoute><DREDetalhado /></ProtectedRoute>} />
            <Route path="/dre-ajustado" element={<ProtectedRoute><DREAjustado /></ProtectedRoute>} />
            <Route path="/planejador" element={<ProtectedRoute><Planejador /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/fluxo-caixa" element={<ProtectedRoute><FluxoCaixa /></ProtectedRoute>} />
            <Route path="/inteligencia" element={<ProtectedRoute><Inteligencia /></ProtectedRoute>} />
            <Route path="/compromissos" element={<ProtectedRoute><Compromissos /></ProtectedRoute>} />
            <Route path="/balanco" element={<ProtectedRoute><BalancoPatrimonial /></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
            <Route path="/simulador" element={<ProtectedRoute><SimuladorFinanceiro /></ProtectedRoute>} />
            <Route path="/health-score" element={<ProtectedRoute><FinancialHealthScorePage /></ProtectedRoute>} />
            <Route path="/mapa-riqueza" element={<ProtectedRoute><MapaRiqueza /></ProtectedRoute>} />
            <Route path="/mapa-sonhos" element={<ProtectedRoute><MapaSonhos /></ProtectedRoute>} />
            
            <Route path="/contas-conectadas" element={<ProtectedRoute><ContasConectadas /></ProtectedRoute>} />
            <Route path="/revisar-transacoes" element={<ProtectedRoute><RevisarTransacoes /></ProtectedRoute>} />
            <Route path="/tutorial" element={<ProtectedRoute><Tutorial /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
