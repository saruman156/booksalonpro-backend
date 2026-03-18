CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ language 'plpgsql';


-- trigger for appointment_participants

CREATE TRIGGER update_participants_updated_at
BEFORE UPDATE ON appointment_participants
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- trigger for appointment_services

CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON appointment_services
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- trigger for appointments

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

create trigger update_gift_cards_updated_at
before update on gift_cards
for each row
execute function update_updated_at_column();