-- ============================================================
-- Integrity Admin OS — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── 1. User Profiles (linked to auth.users) ─────────────────
create table if not exists public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text not null,
  full_name   text,
  role        text not null default 'crew_boss'
                check (role in ('admin', 'supervisor', 'crew_boss', 'planter')),
  employee_id text,
  avatar      text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'crew_boss'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. Row Level Security ────────────────────────────────────
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can read all profiles
create policy "profiles: admin read all"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can update any profile (for role management)
create policy "profiles: admin update"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Users can update their own non-role fields
create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (role = (select role from public.profiles where id = auth.uid()));

-- ── 3. Production Entries ────────────────────────────────────
create table if not exists public.production_entries (
  id                   text primary key,
  date                 text not null,
  crew_boss            text,
  project              text,
  block                text,
  camp                 text,
  shift                text,
  notes                text,
  employee_id          text,
  employee_name        text,
  role                 text,
  production           jsonb default '[]'::jsonb,
  total_trees          integer default 0,
  total_earnings       numeric(10,4) default 0,
  avg_price_per_tree   numeric(10,6) default 0,
  hours_worked         numeric(5,2) default 0,
  vac_pay              numeric(10,4) default 0,
  total_with_vac       numeric(10,4) default 0,
  equipment_fuel_level text,
  vehicle_fuel_level   text,
  plan_for_tomorrow    text,
  needs_notes          text,
  equipment_on_block   text,
  created_by           uuid references auth.users,
  created_at           timestamptz default now()
);

alter table public.production_entries enable row level security;

create policy "production_entries: crew boss insert own"
  on public.production_entries for insert
  with check (auth.uid() = created_by);

create policy "production_entries: supervisor and admin read all"
  on public.production_entries for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'supervisor')
    )
    or auth.uid() = created_by
  );

create policy "production_entries: own update"
  on public.production_entries for update
  using (auth.uid() = created_by);

create policy "production_entries: admin delete"
  on public.production_entries for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── 4. Supervisor Deliveries ─────────────────────────────────
create table if not exists public.supervisor_deliveries (
  id           text primary key,
  date         text not null,
  project      text,
  block        text,
  load_number  text,
  delivered_by text,
  notes        text,
  lines        jsonb default '[]'::jsonb,
  total_trees  integer default 0,
  created_by   uuid references auth.users,
  created_at   timestamptz default now()
);

alter table public.supervisor_deliveries enable row level security;

create policy "supervisor_deliveries: supervisor and admin full"
  on public.supervisor_deliveries for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'supervisor')
    )
  );

create policy "supervisor_deliveries: crew boss read"
  on public.supervisor_deliveries for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'crew_boss'
    )
  );

-- ── 5. Tree Transfers ────────────────────────────────────────
create table if not exists public.tree_transfers (
  id          text primary key,
  date        text not null,
  from_block  text,
  to_block    text,
  lines       jsonb default '[]'::jsonb,
  total_trees integer default 0,
  notes       text,
  created_by  uuid references auth.users,
  created_at  timestamptz default now()
);

alter table public.tree_transfers enable row level security;

create policy "tree_transfers: supervisor and admin full"
  on public.tree_transfers for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'supervisor')
    )
  );

create policy "tree_transfers: crew boss read"
  on public.tree_transfers for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'crew_boss'
    )
  );

-- ── 6. Tree Orders ───────────────────────────────────────────
create table if not exists public.tree_orders (
  id           text primary key,
  order_date   text,
  created_date text,
  block        text,
  project      text,
  crew_boss    text,
  lines        jsonb default '[]'::jsonb,
  notes        text,
  created_by   uuid references auth.users,
  created_at   timestamptz default now()
);

alter table public.tree_orders enable row level security;

create policy "tree_orders: all roles read"
  on public.tree_orders for select
  using (auth.uid() is not null);

create policy "tree_orders: crew boss insert own"
  on public.tree_orders for insert
  with check (auth.uid() = created_by);

create policy "tree_orders: supervisor admin manage"
  on public.tree_orders for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'supervisor')
    )
  );

-- ── 7. Delivery Plans ────────────────────────────────────────
create table if not exists public.delivery_plans (
  id          text primary key,
  plan_date   text not null,
  block_name  text,
  driver_name text,
  truck_id    text,
  block_notes text,
  notes       text,
  lines       jsonb default '[]'::jsonb,
  total_trees integer default 0,
  status      text default 'planned'
                check (status in ('planned', 'dispatched', 'delivered')),
  created_by  uuid references auth.users,
  created_at  timestamptz default now()
);

alter table public.delivery_plans enable row level security;

create policy "delivery_plans: all roles read"
  on public.delivery_plans for select
  using (auth.uid() is not null);

create policy "delivery_plans: supervisor admin manage"
  on public.delivery_plans for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'supervisor')
    )
  );

-- ── 8. Upcoming Block Plans ──────────────────────────────────
create table if not exists public.upcoming_block_plans (
  id         text primary key,
  block_name text,
  crew_name  text,
  notes      text,
  sort_order integer default 0,
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

alter table public.upcoming_block_plans enable row level security;

create policy "upcoming_block_plans: all roles read"
  on public.upcoming_block_plans for select
  using (auth.uid() is not null);

create policy "upcoming_block_plans: supervisor admin manage"
  on public.upcoming_block_plans for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'supervisor')
    )
  );

-- ── 9. Species Rates ─────────────────────────────────────────
create table if not exists public.species_rates (
  id                    text primary key,
  species               text not null,
  code                  text not null,
  rate_bucket           text default '',
  rate_type             text default 'flat' check (rate_type in ('flat', 'tiered')),
  rate_per_tree         numeric(8,4) default 0,
  tier_threshold        integer,
  rate_below_threshold  numeric(8,4),
  rate_above_threshold  numeric(8,4),
  created_at            timestamptz default now()
);

alter table public.species_rates enable row level security;

create policy "species_rates: all roles read"
  on public.species_rates for select
  using (auth.uid() is not null);

create policy "species_rates: admin manage"
  on public.species_rates for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Seed default species rates
insert into public.species_rates (id, species, code, rate_per_tree) values
  ('sr-001', 'Jack Pine',    'PJ', 0.16),
  ('sr-002', 'Black Spruce', 'SB', 0.18),
  ('sr-003', 'White Spruce', 'SW', 0.20),
  ('sr-004', 'White Pine',   'PW', 0.22),
  ('sr-005', 'Red Pine',     'PR', 0.19),
  ('sr-006', 'Larch',        'LA', 0.21),
  ('sr-007', 'Poplar',       'PP', 0.14),
  ('sr-008', 'Other',        'OT', 0.15)
on conflict (id) do nothing;

-- ── 10. Session Drafts ───────────────────────────────────────
create table if not exists public.session_drafts (
  id           text primary key,
  name         text,
  saved_at     timestamptz default now(),
  session_data jsonb default '{}'::jsonb,
  planters     jsonb default '[]'::jsonb,
  created_by   uuid references auth.users,
  created_at   timestamptz default now()
);

alter table public.session_drafts enable row level security;

create policy "session_drafts: own"
  on public.session_drafts for all
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- ── 11. Unified App Data Store (cross-device sync) ───────────
-- Single JSONB table used by productionDb.ts for all production
-- data that must be accessible from any device.
create table if not exists public.app_data (
  table_name  text not null,
  id          text not null,
  data        jsonb not null,
  updated_at  timestamptz default now(),
  primary key (table_name, id)
);

alter table public.app_data enable row level security;

create policy "app_data: authenticated full access"
  on public.app_data for all
  using  (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ============================================================
-- Done. Now go to Authentication → Settings and set:
--   Site URL: http://localhost:3010
--   Redirect URLs: http://localhost:3010/auth/callback
-- ============================================================
