CREATE INDEX IF NOT EXISTS idx_appointments_date
ON appointments(appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointment_services_staff
ON appointment_services(assigned_staff_id);

CREATE INDEX IF NOT EXISTS idx_appointment_services_appt
ON appointment_services(appointment_id);

CREATE INDEX IF NOT EXISTS idx_appointment_participants_appt
ON appointment_participants(appointment_id);