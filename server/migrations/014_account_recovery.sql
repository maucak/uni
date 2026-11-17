-- Hesap güvenliği: e-posta doğrulama ve parola sıfırlama belirteçleri.
-- Belirteçlerin kendisi saklanmaz; yalnızca sha256 özeti tutulur.
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
CREATE TABLE account_tokens (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK(purpose IN ('verify_email','reset_password')),
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_tokens_user_idx ON account_tokens(user_id,purpose);
