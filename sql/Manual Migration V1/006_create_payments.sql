create table payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id),
  customer_id uuid references customers(id),
  amount numeric(12,2) not null default 0,
  tip_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  method text not null, -- CASH, CARD, GIFT_CARD, SPLIT
  status text not null default 'PAID', -- PENDING, PAID, VOIDED, REFUNDED
  reference_no text,
  notes text,
  paid_at timestamptz not null default now(),
  created_by_staff_id text references staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);