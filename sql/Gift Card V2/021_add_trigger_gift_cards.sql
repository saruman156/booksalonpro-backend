CREATE TRIGGER update_gift_cards_updated_at
BEFORE UPDATE ON gift_cards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();