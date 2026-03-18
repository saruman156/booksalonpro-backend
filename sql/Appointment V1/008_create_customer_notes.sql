create table customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  staff_id text references staff(id),
  type text not null default 'GENERAL', -- GENERAL, ALLERGY, PREFERENCE, WARNING
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);