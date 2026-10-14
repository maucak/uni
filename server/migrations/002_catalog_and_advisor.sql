ALTER TABLE programs ADD COLUMN external_key text UNIQUE;
ALTER TABLE programs ADD COLUMN official_code text UNIQUE;
ALTER TABLE programs ADD COLUMN scholarship_percent numeric CHECK(scholarship_percent BETWEEN 0 AND 100);
ALTER TABLE programs ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE program_year_data ADD COLUMN tuition numeric CHECK(tuition>=0);
ALTER TABLE program_year_data ADD COLUMN currency text;
CREATE TABLE data_sources (
 id uuid PRIMARY KEY, source_key text NOT NULL UNIQUE, title text NOT NULL,
 url text NOT NULL, publisher text NOT NULL, retrieved_at date NOT NULL,
 notes text NOT NULL, content_hash text NOT NULL
);
CREATE TABLE program_sources (
 program_id uuid NOT NULL REFERENCES programs(id), source_id uuid NOT NULL REFERENCES data_sources(id),
 PRIMARY KEY(program_id,source_id)
);
CREATE TABLE import_batches (
 id uuid PRIMARY KEY, version text NOT NULL UNIQUE, checksum text NOT NULL UNIQUE,
 manifest jsonb NOT NULL, record_count integer NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recommendation_runs ADD COLUMN catalog_version text NOT NULL DEFAULT 'sample-v1';
CREATE TABLE recommendation_feedback (
 user_id uuid NOT NULL REFERENCES users(id), run_id uuid NOT NULL REFERENCES recommendation_runs(id),
 program_id uuid NOT NULL REFERENCES programs(id), rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
 note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,run_id,program_id)
);
CREATE TABLE advisor_conversations (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE advisor_messages (
 id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES advisor_conversations(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('user','assistant')), payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE advisor_requests (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_key uuid NOT NULL, state text NOT NULL CHECK(state IN ('pending','complete','failed')),
 response jsonb, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,request_key)
);
CREATE INDEX advisor_requests_daily_idx ON advisor_requests(user_id,created_at);
