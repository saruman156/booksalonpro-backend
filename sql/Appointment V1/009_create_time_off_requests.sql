create table time_off_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references staff(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  status text not null default 'PENDING', -- PENDING, APPROVED, REJECTED
  reviewed_by_staff_id text references staff(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);