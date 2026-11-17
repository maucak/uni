-- 016: yetki rolleri, öğrenci/mezun doğrulaması ve itibar (docs/veri-modeli-v2.md).
ALTER TABLE users ADD COLUMN roles text[] NOT NULL DEFAULT '{}'
  CHECK (roles <@ ARRAY['reviewer','moderator','admin']::text[]);
CREATE TABLE university_email_domains (
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  domain text PRIMARY KEY CHECK (domain = lower(domain) AND domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'));
CREATE INDEX university_email_domains_university_idx ON university_email_domains(university_id);
-- Yalnızca kaynağı kesin alan adları; katalogda tam adla eşleşmeyen satır atlanır.
-- Katalog bu migration'dan sonra yüklenirse API açılışı aynı eklemeyi yeniden dener.
INSERT INTO university_email_domains(university_id, domain)
SELECT u.id, d.domain FROM (VALUES
  ('Isparta Uygulamalı Bilimler Üniversitesi','isparta.edu.tr'),
  ('Süleyman Demirel Üniversitesi','sdu.edu.tr'),
  ('Pamukkale Üniversitesi','pau.edu.tr'),
  ('Akdeniz Üniversitesi','akdeniz.edu.tr')) AS d(name, domain)
JOIN universities u ON u.name = d.name
ON CONFLICT (domain) DO NOTHING;
CREATE TABLE verification_requests (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim text NOT NULL CHECK (claim IN ('student','graduate')),
  university_id uuid NOT NULL REFERENCES universities(id), program_id uuid REFERENCES programs(id),
  method text NOT NULL CHECK (method IN ('institution_email','document')),
  institution_email text, email_token_hash text UNIQUE, email_token_expires_at timestamptz,
  document_path text, document_mime text CHECK (document_mime IN ('application/pdf','image/jpeg','image/png')),
  document_bytes integer CHECK (document_bytes BETWEEN 1 AND 5242880),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','revoked')),
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL, reviewed_at timestamptz, decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reviewer_id IS NULL OR reviewer_id <> user_id));
-- Aynı iddia için tek açık başvuru.
CREATE UNIQUE INDEX verification_requests_open_idx ON verification_requests(user_id, claim) WHERE status='pending';
CREATE INDEX verification_requests_status_idx ON verification_requests(status, created_at);
CREATE INDEX verification_requests_user_idx ON verification_requests(user_id, status);
-- Belgedeki UNIQUE (kind, source_type, source_id, actor_id) uygulanmadı: oy → geri al → yeniden oy
-- aynı anahtarla birden çok olay gerektirir. Tekrarı uygulama katmanı net toplamla engeller.
CREATE TABLE reputation_events (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL, source_type text NOT NULL, source_id uuid NOT NULL, actor_id uuid,
  delta integer NOT NULL, rule_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX reputation_events_user_idx ON reputation_events(user_id);
CREATE INDEX reputation_events_source_idx ON reputation_events(kind, source_type, source_id, actor_id);
