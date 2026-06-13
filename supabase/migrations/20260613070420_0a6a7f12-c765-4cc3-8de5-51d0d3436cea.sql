
-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- ===== updated_at helper =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== new user handling =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::public.app_role ELSE 'staff'::public.app_role END);

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- profiles & roles policies
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Team views roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ===== products =====
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team manage products" ON public.products FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== customers =====
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT,
  email TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  segment TEXT NOT NULL DEFAULT 'new',
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_order_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team manage customers" ON public.customers FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== orders =====
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_reference TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team manage orders" ON public.orders FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== conversations =====
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'active',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team manage conversations" ON public.conversations FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== messages =====
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL DEFAULT 'customer',
  content TEXT NOT NULL,
  intent TEXT,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team manage messages" ON public.messages FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));

-- ===== campaigns =====
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  audience TEXT,
  audience_count INTEGER NOT NULL DEFAULT 0,
  channels TEXT[] NOT NULL DEFAULT ARRAY['whatsapp'],
  type TEXT NOT NULL DEFAULT 'inactive',
  status TEXT NOT NULL DEFAULT 'draft',
  auto_enabled BOOLEAN NOT NULL DEFAULT false,
  message_template TEXT,
  sent_count INTEGER NOT NULL DEFAULT 0,
  response_rate NUMERIC(5,2),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team manage campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== reminders =====
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'inactive',
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team manage reminders" ON public.reminders FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));

-- ===== integration_settings =====
CREATE TABLE public.integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'not_connected',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_settings TO authenticated;
GRANT ALL ON public.integration_settings TO service_role;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team manage integrations" ON public.integration_settings FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE TRIGGER update_integration_settings_updated_at BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
