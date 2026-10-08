-- Run this whole file once in Supabase > SQL Editor.
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null default 'Cabin',
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  colors jsonb not null default '[]',
  sizes jsonb not null default '[]',
  images jsonb not null default '[]',
  description text not null default '',
  status text not null default 'published' check (status in ('published','draft')),
  created_at timestamptz not null default now()
);
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity (start with 1001),
  email text not null,
  shipping jsonb not null,
  items jsonb not null,
  subtotal numeric(10,2) not null,
  shipping_cost numeric(10,2) not null,
  tax numeric(10,2) not null,
  total numeric(10,2) not null,
  delivery text not null default 'standard',
  status text not null default 'new' check (status in ('new','packed','shipped','delivered','cancelled')),
  visitor_id text,
  created_at timestamptz not null default now()
);
create table if not exists visitors (
  id text primary key,
  visits int not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create table if not exists site_content (
  key text primary key,
  value text not null default ''
);

-- Only the backend (service_role key) can touch data. No public policies on purpose.
alter table products enable row level security;
alter table orders enable row level security;
alter table visitors enable row level security;
alter table site_content enable row level security;

-- Public bucket for product photos (uploads go through the backend).
insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict (id) do nothing;

-- Starter products (photos ship in public/images). Edit prices and stock in the admin.
insert into products (slug, name, category, price, stock, colors, sizes, images, description) values
('atelier-cabin-silver','Atelier Cabin','Cabin',295,12,'["Silver"]','["Cabin"]','["images/atelier-cabin-silver.jpg"]','Brushed silver hard shell with a quiet-roll four-wheel base and a built-in TSA lock. Fits overhead on most airlines.'),
('voyage-cabin-champagne','Voyage Cabin','Cabin',245,20,'["Champagne"]','["Cabin"]','["images/voyage-cabin-champagne.jpg","images/voyage-cabin-handle.jpg","images/detail-wheel.jpg","images/details-packed.jpg"]','Our carry-on for the long way round. Lightweight polycarbonate, a telescoping handle, and a lined interior with compression straps.'),
('voyage-duo-champagne','Voyage Duo','Sets',420,8,'["Champagne"]','["Cabin + Medium"]','["images/voyage-duo-champagne.jpg","images/tile-pair.jpg"]','A cabin and a medium case in matching champagne. Nest them at home, split them on the way.'),
('voyage-medium-sage','Voyage Medium','Check-in',295,15,'["Sage"]','["Medium"]','["images/voyage-medium-sage.jpg"]','The medium check-in in sage. Room for a week away, with the same quiet wheels and TSA lock.'),
('voyage-large-onyx','Voyage Large','Check-in',345,10,'["Onyx"]','["Large"]','["images/voyage-large-onyx.jpg"]','Matte onyx large case for longer trips. Strong frame, deep packing space, easy to steer.'),
('packing-cube-set','Packing Cube Set','Accessories',65,40,'["Sand"]','["Set of 3"]','["images/packing-cube-set.jpg"]','Three mesh-panel cubes in small, medium and large. Keeps shirts, socks and chargers where you can find them.')
on conflict (slug) do nothing;
