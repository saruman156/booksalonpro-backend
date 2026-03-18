create table if not exists service_commissions (
  id uuid primary key default gen_random_uuid(),

  appointment_id uuid not null references appointments(id) on delete cascade,
  appointment_service_id uuid not null references appointment_services(id) on delete cascade,
  appointment_participant_id uuid references appointment_participants(id) on delete set null,

  staff_id text not null references staff(id),
  staff_name_snapshot text,

  service_id uuid references services(id),
  service_name_snapshot text,

  line_price numeric(12,2) not null default 0,
  commission_rate numeric(6,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,

  note text,
  created_at timestamptz not null default now()
);