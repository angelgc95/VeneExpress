import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";

// Lazy-loaded routes for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Index"));
const Customers = lazy(() => import("./pages/Customers"));
const Shipments = lazy(() => import("./pages/Shipments"));
const CreateShipment = lazy(() => import("./pages/CreateShipment"));
const ShipmentDetail = lazy(() => import("./pages/ShipmentDetail"));
const ScanPage = lazy(() => import("./pages/ScanPage"));
const Settings = lazy(() => import("./pages/Settings"));
const TrackingPublic = lazy(() => import("./pages/TrackingPublic"));
const UserApprovals = lazy(() => import("./pages/UserApprovals"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
  </div>
);

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
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
