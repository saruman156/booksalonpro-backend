create index if not exists idx_customers_phone_digits on customers(phone_digits);
create index if not exists idx_appointments_customer_id on appointments(customer_id);
create index if not exists idx_appointments_staff_id on appointments(staff_id);
create index if not exists idx_appointments_date on appointments(appointment_date);
create index if not exists idx_payments_appointment_id on payments(appointment_id);