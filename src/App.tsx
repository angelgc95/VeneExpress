import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Index";
import Customers from "./pages/Customers";
import Shipments from "./pages/Shipments";
import CreateShipment from "./pages/CreateShipment";
import ShipmentDetail from "./pages/ShipmentDetail";
import ScanPage from "./pages/ScanPage";
import Settings from "./pages/Settings";
import TrackingPublic from "./pages/TrackingPublic";
import UserApprovals from "./pages/UserApprovals";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/track/:trackingCode" element={<TrackingPublic />} />
            <Route path="/track" element={<TrackingPublic />} />
            <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/customers" element={<ProtectedLayout><Customers /></ProtectedLayout>} />
            <Route path="/shipments" element={<ProtectedLayout><Shipments /></ProtectedLayout>} />
            <Route path="/shipments/new" element={<ProtectedLayout><CreateShipment /></ProtectedLayout>} />
            <Route path="/shipments/:id" element={<ProtectedLayout><ShipmentDetail /></ProtectedLayout>} />
            <Route path="/scan" element={<ProtectedLayout><ScanPage /></ProtectedLayout>} />
            <Route path="/admin/approvals" element={<ProtectedLayout><UserApprovals /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
