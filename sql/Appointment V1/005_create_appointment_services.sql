create table appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  service_id uuid references services(id),
  service_name_snapshot text not null,
  category_snapshot text,
  duration_min_snapshot integer not null default 30,
  price_snapshot numeric(12,2) not null default 0,
  supply_charge_snapshot numeric(12,2) not null default 0,
  assigned_staff_id text references staff(id),
  assigned_staff_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);