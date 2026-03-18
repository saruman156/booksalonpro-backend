ALTER TABLE appointment_services

ADD COLUMN IF NOT EXISTS appointment_participant_id uuid
REFERENCES appointment_participants(id)
ON DELETE CASCADE,

ADD COLUMN IF NOT EXISTS service_name_snapshot text,

ADD COLUMN IF NOT EXISTS category_snapshot text,

ADD COLUMN IF NOT EXISTS duration_min_snapshot integer,

ADD COLUMN IF NOT EXISTS price_snapshot numeric,

ADD COLUMN IF NOT EXISTS supply_charge_snapshot numeric,

ADD COLUMN IF NOT EXISTS assigned_staff_id text
REFERENCES staff(id),

ADD COLUMN IF NOT EXISTS assigned_staff_name text,

ADD COLUMN IF NOT EXISTS is_private_booking boolean DEFAULT false,

ADD COLUMN IF NOT EXISTS private_booking_staff_id text
REFERENCES staff(id),

ADD COLUMN IF NOT EXISTS sequence_no integer DEFAULT 1,

ADD COLUMN IF NOT EXISTS parallel_group integer DEFAULT 1,

ADD COLUMN IF NOT EXISTS status text DEFAULT 'SCHEDULED',

ADD COLUMN IF NOT EXISTS started_at timestamptz,

ADD COLUMN IF NOT EXISTS completed_at timestamptz,

ADD COLUMN IF NOT EXISTS override_reason text,

ADD COLUMN IF NOT EXISTS override_by_staff_id text
REFERENCES staff(id),

ADD COLUMN IF NOT EXISTS overridden_at timestamptz,

ADD COLUMN IF NOT EXISTS notes text;