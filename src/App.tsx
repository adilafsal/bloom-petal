import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import AdminRoute from "./components/AdminRoute";
import { AnimatedRoutes } from "./components/PageTransition";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage";
import SignUpPage from "./pages/SignUpPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import AdminOrders from "./pages/AdminOrders";
import AdminDelivery from "./pages/AdminDelivery";
import { StoreProvider } from "./store";
import NeonCart from "./pages/NeonCart";
import NeonBuilder from "./pages/NeonBuilder";
import PaymentCheckout from "./pages/PaymentCheckout";
import SavedAddresses from "./pages/SavedAddresses";
import { NeonConfirmation, NeonProductDetail, NeonShop } from "./pages/StorefrontPages";
import OrderDetails from "./pages/OrderDetails";
import { About, Contact, Delivery, Tracking } from "./pages/More";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <StoreProvider>
            <AnimatedRoutes>
              {location => (
                <Routes location={location}>
                  <Route path="/" element={<Index />} />
                  <Route path="/shop" element={<NeonShop />} />
                  <Route path="/product/:id" element={<NeonProductDetail />} />
                  <Route path="/builder" element={<NeonBuilder />} />
                  <Route path="/cart" element={<NeonCart />} />
                  <Route path="/checkout" element={<PaymentCheckout />} />
                  <Route path="/account/addresses" element={<SavedAddresses />} />
                  <Route path="/confirmation/:ref" element={<OrderDetails />} />
                  <Route path="/order/:ref" element={<OrderDetails />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/delivery" element={<Delivery />} />
                  <Route path="/track" element={<Tracking />} />
                  <Route path="/admin" element={<Navigate to="/admin/orders" replace />} />
                  <Route path="/admin/login" element={<Navigate to="/auth/sign-in" replace />} />
                  <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
                  <Route path="/admin/delivery" element={<AdminRoute><AdminDelivery /></AdminRoute>} />
                  <Route path="/auth/sign-up" element={<SignUpPage />} />
                  <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/auth/:path" element={<AuthPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              )}
            </AnimatedRoutes>
          </StoreProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;