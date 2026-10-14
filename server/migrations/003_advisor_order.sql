ALTER TABLE advisor_messages ADD COLUMN sequence bigint GENERATED ALWAYS AS IDENTITY;
CREATE INDEX advisor_messages_order_idx ON advisor_messages(conversation_id,sequence);
