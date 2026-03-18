alter table gift_cards
add column if not exists created_by_staff_id text references staff(id);

alter table gift_card_transactions
add column if not exists created_by_staff_id text references staff(id);