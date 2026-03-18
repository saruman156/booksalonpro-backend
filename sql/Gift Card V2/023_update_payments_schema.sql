alter table payments
add column if not exists appointment_id uuid references appointments(id);

alter table payments
add column if not exists amount numeric(12,2) not null default 0;

alter table payments
add column if not exists tip_amount numeric(12,2) not null default 0;

alter table payments
add column if not exists tax_amount numeric(12,2) not null default 0;

alter table payments
add column if not exists method text;

alter table payments
add column if not exists status text not null default 'PAID';

alter table payments
add column if not exists note text;

alter table payments
add column if not exists paid_at timestamptz not null default now();

alter table payments
add column if not exists created_by_staff_id text references staff(id);

alter table payments
add column if not exists gift_card_id uuid references gift_cards(id);