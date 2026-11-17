CREATE TABLE life_conversations (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL,
 busy_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX life_conversations_owner_idx ON life_conversations(user_id,updated_at DESC);
CREATE TABLE life_messages (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 conversation_id uuid NOT NULL REFERENCES life_conversations(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('user','assistant')),
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX life_messages_conversation_idx ON life_messages(conversation_id,id);
