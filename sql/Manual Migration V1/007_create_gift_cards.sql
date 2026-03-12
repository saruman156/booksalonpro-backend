create table gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid references customers(id),
  initial_balance numeric(12,2) not null default 0,
  remaining_balance numeric(12,2) not null default 0,
  status text not null default 'ACTIVE', -- ACTIVE, USED, EXPIRED, VOIDED
  notes text,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);