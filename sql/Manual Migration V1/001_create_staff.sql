create table staff (
  id text primary key, -- phone digits, ví dụ 5551234567
  first_name text not null,
  last_name text not null,
  email text,
  phone text not null,
  phone_digits text not null unique,
  role text not null default 'TECHNICIAN', -- OWNER, MANAGER, RECEPTIONIST, TECHNICIAN
  color text,
  password_hash text,
  commission_rate numeric(5,2) default 0,
  availability jsonb default '[]'::jsonb,
  available_service_categories jsonb default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);