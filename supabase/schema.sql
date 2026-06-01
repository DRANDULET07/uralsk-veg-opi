-- Supabase schema and RLS reference for uralsk-veg-opi.
-- This file is documentation and a backup setup guide.
-- Do not run it blindly on production: review each section first.

create extension if not exists pgcrypto;

-- ============================================================
-- 1. ADMIN PROFILES / ROLES
-- ============================================================
-- admin_profiles is needed for owner/worker roles.
-- The app checks this table after Supabase auth login.

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'worker')),
  created_at timestamptz default now()
);

alter table public.admin_profiles
  enable row level security;

drop policy if exists admin_read_own_profile
  on public.admin_profiles;

create policy admin_read_own_profile
  on public.admin_profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- ============================================================
-- 2. ROLE CREATION CHEATSHEET
-- ============================================================
-- Run these manually in Supabase SQL editor after the user signs up.
-- Keep them commented here so this file can be pasted safely.

-- Add owner:
-- insert into admin_profiles (id, email, role)
-- select id, email, 'owner'
-- from auth.users
-- where email = 'email@gmail.com';

-- Add worker:
-- insert into admin_profiles (id, email, role)
-- select id, email, 'worker'
-- from auth.users
-- where email = 'email@gmail.com';

-- Check roles:
-- select * from admin_profiles;

-- Change role:
-- update admin_profiles
-- set role = 'owner'
-- where email = 'email@gmail.com';

-- Remove access:
-- delete from admin_profiles
-- where email = 'email@gmail.com';

-- ============================================================
-- 3. PRODUCT IMAGES STORAGE POLICIES
-- ============================================================
-- Bucket: product-images
-- Storage policies are needed so clients can view product photos
-- and the owner can upload, replace and delete product images.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists product_images_public_select
  on storage.objects;

create policy product_images_public_select
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists product_images_owner_insert
  on storage.objects;

create policy product_images_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  );

drop policy if exists product_images_owner_update
  on storage.objects;

create policy product_images_owner_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  )
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  );

drop policy if exists product_images_owner_delete
  on storage.objects;

create policy product_images_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  );

-- ============================================================
-- 4. PRODUCTS POLICIES
-- ============================================================
-- Main catalog table used by the public site and admin panel.
-- public_read_products is needed so clients can see products.
-- owner_update_products is needed so the owner can change prices,
-- stock_amount, status, image_url and other product fields.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  variant text,
  category text,
  image text,
  image_url text,
  wholesale_price numeric not null,
  retail_price numeric not null,
  unit text default 'kg',
  min_order numeric default 1,
  status text,
  freshness text,
  location text,
  description text,
  origin text,
  in_stock boolean default true,
  stock_amount numeric default 0,
  is_in_transit boolean default false,
  delivery_eta text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.products
  enable row level security;

drop policy if exists public_read_products
  on public.products;

create policy public_read_products
  on public.products
  for select
  to anon, authenticated
  using (is_active is distinct from false);

drop policy if exists owner_insert_products
  on public.products;

create policy owner_insert_products
  on public.products
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  );

drop policy if exists owner_update_products
  on public.products;

create policy owner_update_products
  on public.products
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  );

drop policy if exists owner_delete_products
  on public.products;

create policy owner_delete_products
  on public.products
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  );

-- ============================================================
-- 5. CLIENTS POLICIES
-- ============================================================
-- Admins need to read clients in the "Clients" tab.
-- Only the owner can update client notes or delete client records.
-- Deleting a client must not delete related orders.

alter table public.clients
  add column if not exists client_status text default 'regular';

alter table public.clients
  enable row level security;

drop policy if exists "admin_read_clients"
  on public.clients;

create policy "admin_read_clients"
  on public.clients
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role in ('owner', 'worker')
    )
  );

drop policy if exists "owner_update_clients"
  on public.clients;

create policy "owner_update_clients"
  on public.clients
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  );

drop policy if exists "owner_delete_clients"
  on public.clients;

create policy "owner_delete_clients"
  on public.clients
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  );

-- ============================================================
-- 6. ORDERS POLICIES
-- ============================================================
-- Admins need to read orders and order_items in the Orders tab.
-- Workers can update order status and staff notes.
-- The app UI keeps archive/restore actions owner-only.
-- Public storefront clients create orders only through create_public_order().
-- Direct public insert/select/update/delete on orders and order_items is not allowed.

alter table public.orders
  enable row level security;

drop policy if exists "public_insert_orders"
  on public.orders;

drop policy if exists "admin_insert_orders"
  on public.orders;

create policy "admin_insert_orders"
  on public.orders
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role in ('owner', 'worker')
    )
  );

drop policy if exists "admin_read_orders"
  on public.orders;

create policy "admin_read_orders"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role in ('owner', 'worker')
    )
  );

drop policy if exists "admin_update_orders"
  on public.orders;

create policy "admin_update_orders"
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role in ('owner', 'worker')
    )
  )
  with check (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role in ('owner', 'worker')
    )
  );

drop policy if exists "owner_delete_orders"
  on public.orders;

create policy "owner_delete_orders"
  on public.orders
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  );

alter table public.order_items
  enable row level security;

drop policy if exists "public_insert_order_items"
  on public.order_items;

drop policy if exists "admin_insert_order_items"
  on public.order_items;

create policy "admin_insert_order_items"
  on public.order_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role in ('owner', 'worker')
    )
  );

drop policy if exists "admin_read_order_items"
  on public.order_items;

create policy "admin_read_order_items"
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role in ('owner', 'worker')
    )
  );

drop policy if exists "owner_delete_order_items"
  on public.order_items;

create policy "owner_delete_order_items"
  on public.order_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles
      where id = auth.uid()
        and role = 'owner'
    )
  );

-- ============================================================
-- 7. PUBLIC ORDER RPC
-- ============================================================
-- The storefront calls this function instead of inserting directly into
-- orders/order_items. It runs in one transaction, gets the integer order id
-- from the database, inserts order_items with that id, and returns the order id.

create or replace function public.create_public_order(
  p_customer_name text,
  p_customer_phone text,
  p_client_type text,
  p_order_type text,
  p_receiving_type text,
  p_delivery_address text,
  p_comment text,
  p_total_weight_kg numeric,
  p_total_amount numeric,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id public.clients.id%type;
  v_order_id public.orders.id%type;
  v_item jsonb;
begin
  if nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'customer_name is required';
  end if;

  if nullif(trim(coalesce(p_customer_phone, '')), '') is null then
    raise exception 'customer_phone is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order items are required';
  end if;

  insert into public.clients (
    name,
    phone,
    client_type,
    updated_at
  )
  values (
    trim(p_customer_name),
    trim(p_customer_phone),
    p_client_type,
    now()
  )
  on conflict (phone) do update
  set
    name = excluded.name,
    client_type = excluded.client_type,
    updated_at = excluded.updated_at
  returning id into v_client_id;

  insert into public.orders (
    client_id,
    customer_name,
    customer_phone,
    client_type,
    order_type,
    receiving_type,
    delivery_address,
    comment,
    total_weight_kg,
    total_amount,
    status,
    archived_at,
    created_at
  )
  values (
    v_client_id,
    trim(p_customer_name),
    trim(p_customer_phone),
    p_client_type,
    p_order_type,
    p_receiving_type,
    p_delivery_address,
    p_comment,
    p_total_weight_kg,
    p_total_amount,
    'new',
    null,
    now()
  )
  returning id into v_order_id;

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity_kg,
      price_per_kg,
      total_amount
    )
    values (
      v_order_id,
      nullif(v_item->>'product_id', '')::integer,
      v_item->>'product_name',
      (v_item->>'quantity_kg')::numeric,
      (v_item->>'price_per_kg')::numeric,
      (v_item->>'total_amount')::numeric
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_public_order(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  jsonb
) from public;

grant execute on function public.create_public_order(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  jsonb
) to anon, authenticated;

-- ============================================================
-- 8. NOTES
-- ============================================================
-- If the admin panel can read products but cannot save changes,
-- check owner_update_products first.
-- If photo upload succeeds but image_url cannot be saved,
-- check owner_update_products on public.products.
-- If order status or archive actions reset after page refresh,
-- check admin_update_orders on public.orders.
-- If photo upload fails before saving the product, check
-- product_images_owner_insert/update/delete on storage.objects.
