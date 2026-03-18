create table if not exists gift_card_transactions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references gift_cards(id) on delete cascade,
  appointment_id uuid references appointments(id),
  transaction_type text not null,
  amount numeric(12,2) not null default 0,
  balance_before numeric(12,2) not null default 0,
  balance_after numeric(12,2) not null default 0,
  note text,
  created_by_staff_id text references staff(id),
  created_at timestamptz not null default now()
);