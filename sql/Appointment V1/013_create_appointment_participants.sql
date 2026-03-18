CREATE TABLE IF NOT EXISTS appointment_participants (

id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

appointment_id uuid NOT NULL
REFERENCES appointments(id)
ON DELETE CASCADE,

customer_id uuid
REFERENCES customers(id),

customer_name_snapshot text NOT NULL,

customer_phone_snapshot text,

is_vip_snapshot boolean DEFAULT false,

position_no integer DEFAULT 1,

created_at timestamptz DEFAULT now(),

updated_at timestamptz DEFAULT now()

);