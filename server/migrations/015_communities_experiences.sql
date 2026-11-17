ALTER TABLE communities ADD COLUMN kind text NOT NULL DEFAULT 'general'
  CHECK (kind IN ('general','university','program'));
ALTER TABLE communities ADD COLUMN university_id uuid REFERENCES universities(id);
UPDATE communities c SET kind='program', university_id=p.university_id
FROM programs p WHERE p.id=c.program_id;
CREATE UNIQUE INDEX communities_university_idx ON communities(university_id) WHERE kind='university';
CREATE INDEX communities_kind_idx ON communities(kind, university_id);
INSERT INTO communities(id,name,slug,description,kind,university_id)
SELECT gen_random_uuid(), u.name, 'university-' || u.id::text,
 'Kampüs yaşamı, barınma, ulaşım ve üniversite geneliyle ilgili sorular.', 'university', u.id
FROM universities u
WHERE EXISTS (SELECT 1 FROM programs p WHERE p.university_id=u.id AND NOT p.is_sample)
ON CONFLICT (university_id) WHERE kind='university' DO NOTHING;
ALTER TABLE questions ADD COLUMN status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','deleted'));
ALTER TABLE questions ADD COLUMN accepted_answer_id uuid REFERENCES answers(id) ON DELETE SET NULL;
ALTER TABLE questions ADD COLUMN search tsvector GENERATED ALWAYS AS
  (to_tsvector('turkish', title || ' ' || body)) STORED;
CREATE INDEX questions_search_idx ON questions USING GIN (search);
CREATE INDEX questions_tags_idx ON questions USING GIN (tags);
ALTER TABLE answers ADD COLUMN status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','deleted'));
CREATE TABLE experiences (
  id uuid PRIMARY KEY, community_id uuid NOT NULL REFERENCES communities(id),
  author_id uuid NOT NULL REFERENCES users(id), program_id uuid REFERENCES programs(id),
  topic text NOT NULL CHECK (topic IN ('ders','hazirlik','staj','kampus','barinma','kariyer','diger')),
  experience_year integer NOT NULL CHECK (experience_year BETWEEN 1990 AND 2100),
  author_status text NOT NULL CHECK (author_status IN ('student','graduate')),
  title text NOT NULL, body text NOT NULL,
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX experiences_community_idx ON experiences(community_id, created_at DESC);
CREATE INDEX experiences_program_idx ON experiences(program_id);
CREATE TABLE experience_votes (experience_id uuid REFERENCES experiences(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (experience_id, user_id));
