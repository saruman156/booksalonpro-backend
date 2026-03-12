create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  duration_min integer not null default 30,
  price numeric(12,2) not null default 0,
  supply_charge numeric(12,2) not null default 0,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);