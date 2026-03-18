create index if not exists idx_service_commissions_appointment_id
on service_commissions(appointment_id);

create index if not exists idx_service_commissions_staff_id
on service_commissions(staff_id);

create index if not exists idx_service_commissions_service_line_id
on service_commissions(appointment_service_id);