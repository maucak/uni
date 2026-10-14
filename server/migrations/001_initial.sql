CREATE TABLE users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
 profile jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE universities (
 id uuid PRIMARY KEY, name text NOT NULL UNIQUE, city text NOT NULL,
 university_type text NOT NULL CHECK(university_type IN ('Devlet','Vakıf'))
);
CREATE TABLE programs (
 id uuid PRIMARY KEY, university_id uuid NOT NULL REFERENCES universities(id),
 name text NOT NULL, language text NOT NULL, score_type text NOT NULL,
 scholarship text NOT NULL, description text NOT NULL, subjects jsonb NOT NULL,
 is_sample boolean NOT NULL DEFAULT true,
 UNIQUE(university_id,name,language,scholarship)
);
CREATE TABLE program_year_data (
 program_id uuid NOT NULL REFERENCES programs(id), year integer NOT NULL,
 rank integer CHECK(rank>0), quota integer CHECK(quota>=0), source text NOT NULL,
 source_url text, PRIMARY KEY(program_id,year)
);
CREATE TABLE preference_lists (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name text NOT NULL, revision integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX preference_lists_user_idx ON preference_lists(user_id);
CREATE TABLE preference_items (
 id uuid PRIMARY KEY, list_id uuid NOT NULL REFERENCES preference_lists(id) ON DELETE CASCADE,
 program_id uuid NOT NULL REFERENCES programs(id), position integer NOT NULL CHECK(position>=0),
 note text NOT NULL DEFAULT '', UNIQUE(list_id,program_id)
);
CREATE INDEX preference_items_order_idx ON preference_items(list_id,position);
CREATE TABLE communities (
 id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE, description text NOT NULL
);
CREATE TABLE questions (
 id uuid PRIMARY KEY, community_id uuid NOT NULL REFERENCES communities(id),
 author_id uuid NOT NULL REFERENCES users(id), title text NOT NULL, body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_community_idx ON questions(community_id,created_at DESC);
CREATE TABLE answers (
 id uuid PRIMARY KEY, question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES users(id), body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX answers_question_idx ON answers(question_id);
CREATE TABLE answer_votes (
 answer_id uuid NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(answer_id,user_id)
);
CREATE TABLE recommendation_runs (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), algorithm_version text NOT NULL,
 input jsonb NOT NULL, results jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
