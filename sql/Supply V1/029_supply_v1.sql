-- 029_supply_v1.sql
begin;

-- =========================================================
-- 1) SUPPLIES MASTER
-- =========================================================
create table if not exists supplies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  category text,
  unit text not null, -- ml / oz / pcs / g / bottle / pack
  brand text,
  cost_per_unit numeric(12,4) not null default 0,
  stock_on_hand numeric(12,4) not null default 0,
  reorder_level numeric(12,4) not null default 0,
  reorder_qty numeric(12,4) not null default 0,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supplies_name
  on supplies (name);

create index if not exists idx_supplies_category
  on supplies (category);

create index if not exists idx_supplies_active
  on supplies (is_active);

-- =========================================================
-- 2) SERVICE -> SUPPLY USAGE MAP
-- service_id is uuid in your schema
-- =========================================================
create table if not exists service_supply_usage (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  supply_id uuid not null references supplies(id) on delete cascade,
  qty_per_service numeric(12,4) not null default 0,
  waste_pct numeric(8,4) not null default 0, -- 0.10 = 10%
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, supply_id)
);

create index if not exists idx_service_supply_usage_service
  on service_supply_usage (service_id);

create index if not exists idx_service_supply_usage_supply
  on service_supply_usage (supply_id);

commit;