create index if not exists idx_gift_cards_code on gift_cards(code);
create index if not exists idx_gift_cards_customer_id on gift_cards(customer_id);
create index if not exists idx_gift_card_transactions_gift_card_id on gift_card_transactions(gift_card_id);
create index if not exists idx_gift_card_transactions_appointment_id on gift_card_transactions(appointment_id);