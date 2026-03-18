-- 027_report_v1.sql
-- Report support migration for dashboard + owner report
-- Safe to run on Supabase Postgres after your current 026 schema

begin;

-- =========================================================
-- 1) SUPPORT COLUMN FOR UPSELL METRICS
-- =========================================================
alter table appointment_services
add column if not exists is_upsell boolean not null default false;

comment on column appointment_services.is_upsell is
'Flag to indicate this appointment service line was added as an upsell.';

-- =========================================================
-- 2) INDEXES FOR REPORT PERFORMANCE
-- =========================================================

-- appointments
create index if not exists idx_appointments_date_status
  on appointments (appointment_date, status);

create index if not exists idx_appointments_date_source
  on appointments (appointment_date, source);

create index if not exists idx_appointments_date_payment_status
  on appointments (appointment_date, payment_status);

create index if not exists idx_appointments_updated_at
  on appointments (updated_at);

create index if not exists idx_appointments_start_at
  on appointments (start_at);

-- appointment_services
create index if not exists idx_appointment_services_appointment_id
  on appointment_services (appointment_id);

create index if not exists idx_appointment_services_status
  on appointment_services (status);

create index if not exists idx_appointment_services_assigned_staff_id
  on appointment_services (assigned_staff_id);

create index if not exists idx_appointment_services_service_id
  on appointment_services (service_id);

create index if not exists idx_appointment_services_upsell
  on appointment_services (is_upsell);

create index if not exists idx_appointment_services_overridden_at
  on appointment_services (overridden_at);

create index if not exists idx_appointment_services_participant_id
  on appointment_services (appointment_participant_id);

-- appointment_participants
create index if not exists idx_appointment_participants_appointment_customer
  on appointment_participants (appointment_id, customer_id);

create index if not exists idx_appointment_participants_customer_id
  on appointment_participants (customer_id);

create index if not exists idx_appointment_participants_vip_snapshot
  on appointment_participants (is_vip_snapshot);

-- customers
create index if not exists idx_customers_created_at
  on customers (created_at);

create index if not exists idx_customers_is_active
  on customers (is_active);

-- payments
create index if not exists idx_payments_paid_at_status
  on payments (paid_at, status);

create index if not exists idx_payments_method
  on payments (method);

-- gift cards
create index if not exists idx_gift_cards_created_at
  on gift_cards (created_at);

create index if not exists idx_gift_cards_status
  on gift_cards (status);

-- gift card transactions
create index if not exists idx_gift_card_transactions_created_type
  on gift_card_transactions (created_at, transaction_type);

-- commissions
create index if not exists idx_service_commissions_staff_created
  on service_commissions (staff_id, created_at);

create index if not exists idx_service_commissions_service_line
  on service_commissions (appointment_service_id);

commit;