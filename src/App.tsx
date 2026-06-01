import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import Index from "./pages/Index";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";

// Public routes — lazy para reduzir o bundle inicial
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin — separado do bundle público
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout"));
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage"));
const AdminStockPage = lazy(() => import("./pages/admin/AdminStockPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"));
const AdminBannersPage = lazy(() => import("./pages/admin/AdminBannersPage"));
const AdminCouponsPage = lazy(() => import("./pages/admin/AdminCouponsPage"));
const AdminReviewsPage = lazy(() => import("./pages/admin/AdminReviewsPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminBlingPage = lazy(() => import("./pages/admin/AdminBlingPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Index />} />
                    <Route path="/produtos" element={<ProductsPage />} />
                    <Route path="/produto/:id" element={<ProductDetailPage />} />
                    <Route path="/carrinho" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/sobre" element={<AboutPage />} />
                    <Route path="/favoritos" element={<WishlistPage />} />

                    {/* Admin routes */}
                    <Route path="/admin/login" element={<AdminLoginPage />} />
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route path="dashboard" element={<AdminDashboardPage />} />
                      <Route path="products" element={<AdminProductsPage />} />
                      <Route path="categories" element={<AdminCategoriesPage />} />
                      <Route path="stock" element={<AdminStockPage />} />
                      <Route path="orders" element={<AdminOrdersPage />} />
                      <Route path="banners" element={<AdminBannersPage />} />
                      <Route path="coupons" element={<AdminCouponsPage />} />
                      <Route path="reviews" element={<AdminReviewsPage />} />
                      <Route path="users" element={<AdminUsersPage />} />
                      <Route path="bling" element={<AdminBlingPage />} />
                      <Route path="settings" element={<AdminSettingsPage />} />
                    </Route>

                    {/* Catch-all */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <WhatsAppButton />
              </BrowserRouter>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
