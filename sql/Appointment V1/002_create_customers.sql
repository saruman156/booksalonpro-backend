create extension if not exists pgcrypto;

create table customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text,
  phone_digits text,
  email text,
  birthday date,
  notes text,
  internal_notes text,
  loyalty_points integer not null default 0,
  visit_count integer not null default 0,
  total_spent numeric(12,2) not null default 0,
  preferred_staff_id text references staff(id),
  last_visit_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);