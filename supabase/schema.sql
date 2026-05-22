CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  image text,
  wholesale_price numeric NOT NULL,
  retail_price numeric NOT NULL,
  unit text DEFAULT 'кг',
  min_order numeric DEFAULT 1,
  status text,
  freshness text,
  location text,
  description text,
  origin text,
  in_stock boolean DEFAULT true,
  stock_amount numeric DEFAULT 0,
  is_in_transit boolean DEFAULT false,
  delivery_eta text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.products
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to products"
  ON public.products;

CREATE POLICY "Allow public read access to products"
  ON public.products
  FOR SELECT
  USING (true);

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS variant text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS client_note text;

CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'worker')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_profiles
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_profiles
    WHERE id = auth.uid()
      AND role = 'owner'
  );
$$;

DROP POLICY IF EXISTS "Admins can read own profile"
  ON public.admin_profiles;

CREATE POLICY "Admins can read own profile"
  ON public.admin_profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Owners can read all admin profiles"
  ON public.admin_profiles;

CREATE POLICY "Owners can read all admin profiles"
  ON public.admin_profiles
  FOR SELECT
  USING (public.is_admin_owner());

INSERT INTO public.products (
  name,
  category,
  image,
  wholesale_price,
  retail_price,
  unit,
  min_order,
  status,
  freshness,
  location,
  description,
  origin,
  in_stock,
  stock_amount,
  is_in_transit,
  delivery_eta
) VALUES
  (
    'Картофель',
    'Местный, КХ',
    '/products/potato.jpg',
    150,
    240,
    'т',
    1,
    'Свежий привоз',
    'Цена стабильна',
    'Склад №1 (Уральск)',
    'Стабильный объем местного картофеля. Запасы на складе в избытке.',
    'Уральск',
    true,
    42,
    false,
    null
  ),

  (
    'Лук репчатый',
    'Оптовая партия',
    '/products/onion.jpg',
    110,
    200,
    'т',
    1,
    'В наличии',
    'Сезонное снижение цены',
    'Склад №1 (Уральск)',
    'Крупная партия репчатого лука высокого качества.',
    'Казахстан',
    true,
    38,
    false,
    null
  ),

  (
    'Морковь',
    'Мытая',
    '/products/carrot.jpg',
    130,
    220,
    'т',
    1,
    'В пути',
    'Ожидается подорожание',
    'Таможенный пост Маштаково / Самарская трасса',
    'Доступно бронирование партии в пути.',
    'Узбекистан',
    true,
    25,
    true,
    'Ожидается завтра'
  ),

  (
    'Томаты',
    'Тепличные',
    '/products/tomato.jpg',
    650,
    740,
    'кг',
    5,
    'Свежий привоз',
    'Высокий спрос',
    'Склад №2 (Охлаждаемый)',
    'Тепличные томаты пользуются повышенным спросом перед выходными.',
    'Казахстан',
    true,
    50,
    false,
    null
  ),

  (
    'Капуста',
    'Белокочанная',
    '/products/cabbage.jpg',
    95,
    185,
    'т',
    1,
    'Свежий привоз',
    'Цена стабильна',
    'Склад №1 (Уральск)',
    'Качество партии отличное, товар готов к длительной транспортировке.',
    'Казахстан',
    true,
    44,
    false,
    null
  );
