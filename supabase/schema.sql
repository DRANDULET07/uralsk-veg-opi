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
-- 5. NOTES
-- ============================================================
-- If the admin panel can read products but cannot save changes,
-- check owner_update_products first.
-- If photo upload succeeds but image_url cannot be saved,
-- check owner_update_products on public.products.
-- If photo upload fails before saving the product, check
-- product_images_owner_insert/update/delete on storage.objects.
