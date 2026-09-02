import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

// Code-split all page components
const Storefront = lazy(() => import("./pages/Storefront"));
const Admin = lazy(() => import("./pages/Admin"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const Install = lazy(() => import("./pages/Install"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
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
              <Route path="/" element={<Storefront />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/manager" element={<ManagerDashboard />} />
              <Route path="/customer" element={<CustomerDashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/track-order" element={<OrderTracking />} />
              <Route path="/install" element={<Install />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
