CREATE TABLE notifications (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL, payload jsonb NOT NULL, read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX notifications_user_idx ON notifications(user_id, created_at DESC);
