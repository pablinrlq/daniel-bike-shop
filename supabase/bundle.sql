-- ============================================================================
-- Daniel Bike Shop — bundle único do schema completo
-- Gerado a partir de supabase/migrations/*.sql na ordem cronológica.
-- Cole TODO esse arquivo no SQL Editor do Supabase (uma única execução).
-- Roda apenas em projeto VAZIO. Para alterações posteriores, prefira
-- escrever uma nova migration em supabase/migrations/.
-- ============================================================================


-- ============================================================================
-- migrations/20260130202730_af886cba-f779-4911-8235-18b480b70a8b.sql
-- ============================================================================

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'editor');

-- Create enum for stock movement types
CREATE TYPE public.stock_movement_type AS ENUM ('entrada', 'saida', 'ajuste');

-- ========================
-- USER ROLES TABLE
-- ========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ========================
-- PROFILES TABLE (for user display info)
-- ========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========================
-- CATEGORIES TABLE
-- ========================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ========================
-- PRODUCTS TABLE
-- ========================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  brand TEXT,
  model TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  promotional_price DECIMAL(10, 2),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  aro TEXT,
  material_quadro TEXT,
  marchas TEXT,
  suspensao TEXT,
  tamanho_quadro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ========================
-- PRODUCT IMAGES TABLE
-- ========================
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- ========================
-- STOCK MOVEMENTS TABLE
-- ========================
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  movement_type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- ========================
-- BANNERS TABLE
-- ========================
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- ========================
-- STORE SETTINGS TABLE
-- ========================
CREATE TABLE public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL DEFAULT 'Daniel Bike Shop',
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  whatsapp TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  working_hours TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- ========================
-- SECURITY DEFINER FUNCTIONS
-- ========================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Check if user is editor
CREATE OR REPLACE FUNCTION public.is_editor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'editor')
$$;

-- Check if user has admin or editor role
CREATE OR REPLACE FUNCTION public.has_admin_or_editor_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'editor')
  )
$$;

-- ========================
-- RLS POLICIES
-- ========================

-- USER ROLES POLICIES
CREATE POLICY "Admins and editors can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- PROFILES POLICIES
CREATE POLICY "Admins and editors can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- CATEGORIES POLICIES
CREATE POLICY "Anyone can view active categories"
  ON public.categories FOR SELECT
  USING (is_active = true OR public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can insert categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can update categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can delete categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

-- PRODUCTS POLICIES
CREATE POLICY "Anyone can view active products"
  ON public.products FOR SELECT
  USING (is_active = true OR public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

-- PRODUCT IMAGES POLICIES
CREATE POLICY "Anyone can view product images"
  ON public.product_images FOR SELECT
  USING (true);

CREATE POLICY "Admins and editors can insert product images"
  ON public.product_images FOR INSERT
  TO authenticated
  WITH CHECK (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can update product images"
  ON public.product_images FOR UPDATE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can delete product images"
  ON public.product_images FOR DELETE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

-- STOCK MOVEMENTS POLICIES
CREATE POLICY "Admins and editors can view stock movements"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can insert stock movements"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (public.has_admin_or_editor_role(auth.uid()));

-- BANNERS POLICIES
CREATE POLICY "Anyone can view active banners"
  ON public.banners FOR SELECT
  USING (is_active = true OR public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can insert banners"
  ON public.banners FOR INSERT
  TO authenticated
  WITH CHECK (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can update banners"
  ON public.banners FOR UPDATE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can delete banners"
  ON public.banners FOR DELETE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

-- STORE SETTINGS POLICIES
CREATE POLICY "Anyone can view store settings"
  ON public.store_settings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert store settings"
  ON public.store_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can update store settings"
  ON public.store_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ========================
-- TRIGGERS
-- ========================

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update stock on movement
CREATE OR REPLACE FUNCTION public.handle_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Update product stock quantity
  UPDATE public.products
  SET stock_quantity = NEW.new_quantity
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_stock_movement_created
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.handle_stock_movement();

-- ========================
-- STORAGE BUCKETS
-- ========================
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('store-assets', 'store-assets', true);

-- Storage policies for product images
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Admins and editors can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.has_admin_or_editor_role(auth.uid()));

-- Storage policies for banners
CREATE POLICY "Anyone can view banners"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

CREATE POLICY "Admins and editors can upload banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'banners' AND public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can update banners storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'banners' AND public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can delete banners storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'banners' AND public.has_admin_or_editor_role(auth.uid()));

-- Storage policies for store assets
CREATE POLICY "Anyone can view store assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets');

CREATE POLICY "Admins can upload store assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'store-assets' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update store assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'store-assets' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete store assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'store-assets' AND public.is_admin(auth.uid()));

-- ========================
-- DEFAULT DATA
-- ========================

-- Insert default categories
INSERT INTO public.categories (name, slug, description) VALUES
  ('Bicicletas', 'bicicletas', 'Bicicletas completas de diversos tipos'),
  ('Peças', 'pecas', 'Peças e componentes para bicicletas'),
  ('Acessórios', 'acessorios', 'Acessórios para ciclistas'),
  ('Equipamentos de Segurança', 'seguranca', 'Capacetes, luvas e proteções');

-- Insert default store settings
INSERT INTO public.store_settings (store_name, currency) VALUES
  ('Daniel Bike Shop', 'BRL');

-- ============================================================================
-- migrations/20260203033918_8b527722-b9fd-452c-b8fb-b8a0f3280362.sql
-- ============================================================================

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  customer_city TEXT NOT NULL,
  customer_state TEXT NOT NULL,
  customer_zip TEXT NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  product_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Policies for orders - anyone can create orders (public store)
CREATE POLICY "Anyone can create orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (true);

-- Admins and editors can view all orders
CREATE POLICY "Admins and editors can view orders" 
ON public.orders 
FOR SELECT 
USING (has_admin_or_editor_role(auth.uid()));

-- Admins and editors can update orders
CREATE POLICY "Admins and editors can update orders" 
ON public.orders 
FOR UPDATE 
USING (has_admin_or_editor_role(auth.uid()));

-- Policies for order_items
CREATE POLICY "Anyone can create order items" 
ON public.order_items 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins and editors can view order items" 
ON public.order_items 
FOR SELECT 
USING (has_admin_or_editor_role(auth.uid()));

-- Trigger to update orders timestamp
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update product stock after order
CREATE OR REPLACE FUNCTION public.decrease_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to decrease stock when order item is created
CREATE TRIGGER decrease_stock_on_order
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.decrease_product_stock();

-- ============================================================================
-- migrations/20260204175044_c8d18d91-fdb5-46d1-aaf5-2b026924a096.sql
-- ============================================================================

-- Fix security vulnerability: Add SELECT policy to profiles table
-- This prevents public access to user email addresses

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id OR has_admin_or_editor_role(auth.uid()));

-- ============================================================================
-- migrations/20260205031339_271b7bfa-6677-4799-8a32-9ac741099fe3.sql
-- ============================================================================

-- Drop existing restrictive INSERT policies on orders and order_items
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

-- Recreate as PERMISSIVE policies (which is the default and allows unauthenticated inserts)
CREATE POLICY "Anyone can create orders" 
ON public.orders 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can create order items" 
ON public.order_items 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- ============================================================================
-- migrations/20260205035540_66c8b201-6af5-440c-8c74-0173ec5a22e4.sql
-- ============================================================================

-- Adicionar campo SKU para integração com Bling
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku VARCHAR(50);

-- Criar índice único para SKU (permitindo nulos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON public.products (sku) WHERE sku IS NOT NULL;

-- Comentário para documentar o propósito
COMMENT ON COLUMN public.products.sku IS 'Código SKU para integração com sistema Bling';

-- ============================================================================
-- migrations/20260205191728_3712539b-0399-4a51-a61b-3bd6113758b5.sql
-- ============================================================================

-- Tabela para armazenar tokens OAuth do Bling
CREATE TABLE public.bling_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar pedidos sincronizados com Bling
CREATE TABLE public.bling_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  bling_order_id TEXT NOT NULL,
  bling_nfe_id TEXT,
  bling_nfe_number TEXT,
  bling_contact_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para cache de produtos do Bling
CREATE TABLE public.bling_products_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bling_product_id TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.bling_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bling_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bling_products_cache ENABLE ROW LEVEL SECURITY;

-- Políticas para bling_oauth_tokens (apenas service role pode acessar)
CREATE POLICY "Service role access only for tokens"
  ON public.bling_oauth_tokens
  FOR ALL
  USING (false);

-- Políticas para bling_orders (leitura pública para consulta de status)
CREATE POLICY "Public read for bling_orders"
  ON public.bling_orders
  FOR SELECT
  USING (true);

CREATE POLICY "Service insert for bling_orders"
  ON public.bling_orders
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service update for bling_orders"
  ON public.bling_orders
  FOR UPDATE
  USING (true);

-- Políticas para bling_products_cache (leitura pública)
CREATE POLICY "Public read for bling_products_cache"
  ON public.bling_products_cache
  FOR SELECT
  USING (true);

CREATE POLICY "Service write for bling_products_cache"
  ON public.bling_products_cache
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service update for bling_products_cache"
  ON public.bling_products_cache
  FOR UPDATE
  USING (true);

-- Índices
CREATE INDEX idx_bling_orders_order_id ON public.bling_orders(order_id);
CREATE INDEX idx_bling_orders_bling_order_id ON public.bling_orders(bling_order_id);
CREATE INDEX idx_bling_products_cache_synced ON public.bling_products_cache(synced_at);

-- Trigger para updated_at
CREATE TRIGGER update_bling_oauth_tokens_updated_at
  BEFORE UPDATE ON public.bling_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bling_orders_updated_at
  BEFORE UPDATE ON public.bling_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- migrations/20260205194718_458addd4-2788-405c-b638-23b3f67a2215.sql
-- ============================================================================

-- Add is_store_open field to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS is_store_open boolean NOT NULL DEFAULT true;

-- Add comment
COMMENT ON COLUMN public.store_settings.is_store_open IS 'Controls whether the store is open for customers to make purchases';

-- ============================================================================
-- migrations/20260205195403_ee13c8ba-8eae-4409-a06c-469de51201f3.sql
-- ============================================================================

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload product images
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Create policy to allow public read access to product images
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Create policy to allow authenticated users to update product images
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Create policy to allow authenticated users to delete product images
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- ============================================================================
-- migrations/20260205203746_ffb2dcd5-e8db-4034-92cb-aed39ad72b49.sql
-- ============================================================================

-- Create newsletter subscribers table
CREATE TABLE public.newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow public insert for newsletter subscription
CREATE POLICY "Anyone can subscribe to newsletter"
  ON public.newsletter_subscribers
  FOR INSERT
  WITH CHECK (true);

-- Only admins can view subscribers
CREATE POLICY "Admins can view newsletter subscribers"
  ON public.newsletter_subscribers
  FOR SELECT
  USING (public.has_admin_or_editor_role(auth.uid()));

-- Create discount coupons table
CREATE TABLE public.discount_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  min_order_value NUMERIC DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;

-- Anyone can read active coupons (for validation)
CREATE POLICY "Anyone can view active coupons"
  ON public.discount_coupons
  FOR SELECT
  USING (is_active = true);

-- Only admins can manage coupons
CREATE POLICY "Admins can manage coupons"
  ON public.discount_coupons
  FOR ALL
  USING (public.has_admin_or_editor_role(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_discount_coupons_updated_at
  BEFORE UPDATE ON public.discount_coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create product reviews table
CREATE TABLE public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved reviews
CREATE POLICY "Anyone can view approved reviews"
  ON public.product_reviews
  FOR SELECT
  USING (is_approved = true);

-- Anyone can submit a review
CREATE POLICY "Anyone can submit a review"
  ON public.product_reviews
  FOR INSERT
  WITH CHECK (true);

-- Admins can manage reviews
CREATE POLICY "Admins can manage reviews"
  ON public.product_reviews
  FOR ALL
  USING (public.has_admin_or_editor_role(auth.uid()));

-- ============================================================================
-- migrations/20260601000000_phase2_coupon_server_side.sql
-- ============================================================================

-- Phase 2 — Coupon validation server-side
-- 1) Add discount / payment / customer columns to orders
-- 2) Remove public SELECT on discount_coupons (force validation via RPC)
-- 3) RPC validate_coupon(code, subtotal) — pure read, anon-callable
-- 4) RPC consume_coupon(code) — security definer, used by edge functions

-- ============================================================
-- 1) Orders: discount + payment + customer linkage
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS orders_payment_provider_id_idx ON public.orders(payment_provider_id);

-- ============================================================
-- 2) Lock down direct read of discount_coupons
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.discount_coupons;
-- (admins/editors policy stays — managed in admin UI)

-- ============================================================
-- 3) RPC: validate_coupon (anon-callable, read-only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code TEXT,
  _subtotal NUMERIC
)
RETURNS TABLE (
  valid BOOLEAN,
  error TEXT,
  code TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  min_order_value NUMERIC,
  discount_amount NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _coupon public.discount_coupons%ROWTYPE;
  _now TIMESTAMPTZ := now();
  _normalized TEXT := upper(trim(_code));
  _discount NUMERIC := 0;
BEGIN
  IF _normalized IS NULL OR _normalized = '' THEN
    RETURN QUERY SELECT false, 'invalid_code'::TEXT, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  SELECT * INTO _coupon
  FROM public.discount_coupons
  WHERE upper(public.discount_coupons.code) = _normalized
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found'::TEXT, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  IF _coupon.starts_at IS NOT NULL AND _coupon.starts_at > _now THEN
    RETURN QUERY SELECT false, 'not_started'::TEXT, _coupon.code, _coupon.discount_type, _coupon.discount_value, _coupon.min_order_value, 0::NUMERIC;
    RETURN;
  END IF;

  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < _now THEN
    RETURN QUERY SELECT false, 'expired'::TEXT, _coupon.code, _coupon.discount_type, _coupon.discount_value, _coupon.min_order_value, 0::NUMERIC;
    RETURN;
  END IF;

  IF _coupon.max_uses IS NOT NULL AND _coupon.current_uses >= _coupon.max_uses THEN
    RETURN QUERY SELECT false, 'max_uses_reached'::TEXT, _coupon.code, _coupon.discount_type, _coupon.discount_value, _coupon.min_order_value, 0::NUMERIC;
    RETURN;
  END IF;

  IF _coupon.min_order_value IS NOT NULL AND _subtotal < _coupon.min_order_value THEN
    RETURN QUERY SELECT false, 'below_minimum'::TEXT, _coupon.code, _coupon.discount_type, _coupon.discount_value, _coupon.min_order_value, 0::NUMERIC;
    RETURN;
  END IF;

  IF _coupon.discount_type = 'percentage' THEN
    _discount := round((_subtotal * _coupon.discount_value / 100)::numeric, 2);
  ELSE
    _discount := least(_coupon.discount_value, _subtotal);
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT, _coupon.code, _coupon.discount_type, _coupon.discount_value, _coupon.min_order_value, _discount;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC) TO anon, authenticated;

-- ============================================================
-- 4) RPC: consume_coupon (server-only, increments current_uses)
-- ============================================================

CREATE OR REPLACE FUNCTION public.consume_coupon(_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated INTEGER;
  _normalized TEXT := upper(trim(_code));
BEGIN
  IF _normalized IS NULL OR _normalized = '' THEN
    RETURN false;
  END IF;

  UPDATE public.discount_coupons
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE upper(code) = _normalized
    AND is_active = true
    AND (max_uses IS NULL OR current_uses < max_uses);

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_coupon(TEXT) FROM PUBLIC;
-- service_role bypasses RLS and has execute by default

-- ============================================================
-- 5) BEFORE INSERT trigger on orders — recompute discount + total
--    Client cannot tamper with the final amount.
-- ============================================================

CREATE OR REPLACE FUNCTION public.orders_recompute_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result RECORD;
BEGIN
  NEW.subtotal := COALESCE(NEW.subtotal, 0);
  NEW.shipping_cost := COALESCE(NEW.shipping_cost, 0);

  IF NEW.coupon_code IS NOT NULL AND length(trim(NEW.coupon_code)) > 0 THEN
    SELECT * INTO _result
    FROM public.validate_coupon(NEW.coupon_code, NEW.subtotal);

    IF _result.valid THEN
      NEW.coupon_code := _result.code;
      NEW.discount_amount := _result.discount_amount;
    ELSE
      -- Invalid coupon at insertion time: discard it (do not block the order).
      NEW.coupon_code := NULL;
      NEW.discount_amount := 0;
    END IF;
  ELSE
    NEW.discount_amount := 0;
  END IF;

  NEW.total := GREATEST(NEW.subtotal - NEW.discount_amount + NEW.shipping_cost, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_recompute_totals_trg ON public.orders;
CREATE TRIGGER orders_recompute_totals_trg
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_recompute_totals();

-- ============================================================
-- 6) AFTER INSERT trigger on orders — consume coupon (idempotent)
-- ============================================================

CREATE OR REPLACE FUNCTION public.orders_consume_coupon()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coupon_code IS NOT NULL THEN
    PERFORM public.consume_coupon(NEW.coupon_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_consume_coupon_trg ON public.orders;
CREATE TRIGGER orders_consume_coupon_trg
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_consume_coupon();


-- ============================================================================
-- migrations/20260601000100_phase3_customer_orders_rls.sql
-- ============================================================================

-- Phase 3 — Customer access to their own orders + email fallback

-- Customers can SELECT their own orders (by user_id, set on insert)
-- (select auth.uid()) is the recommended pattern: Postgres caches the
-- function result per query instead of evaluating it per row.
CREATE POLICY "Customers can view their own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Customers can SELECT items of orders they own
CREATE POLICY "Customers can view their own order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = (select auth.uid())
    )
  );

-- (The "Users can view own profile" SELECT policy already exists from an
-- earlier migration — not recreated here to avoid a "policy exists" error.)

-- Backfill: link existing orders to users when the email matches an auth user
-- (best-effort; safe to re-run)
UPDATE public.orders o
SET user_id = u.id
FROM auth.users u
WHERE o.user_id IS NULL
  AND lower(o.customer_email) = lower(u.email);

