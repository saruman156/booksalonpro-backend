create table appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  staff_id text references staff(id),
  staff_name text,
  appointment_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'BOOKED', 
  notes text,
  reception_note text,
  source text default 'MANUAL', -- MANUAL, WALK_IN, ONLINE
  service_total numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  tip_total numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  payment_status text not null default 'UNPAID', -- UNPAID, PARTIAL, PAID
  created_by_staff_id text references staff(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);