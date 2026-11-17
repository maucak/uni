CREATE TABLE mentor_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  accepting boolean NOT NULL DEFAULT true,
  topics text[] NOT NULL DEFAULT '{}',
  bio text NOT NULL DEFAULT '',
  university_id uuid REFERENCES universities(id),
  program_id uuid REFERENCES programs(id),
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX mentor_profiles_university_idx ON mentor_profiles(university_id, program_id);

CREATE TABLE mentorship_requests (
  id uuid PRIMARY KEY,
  mentee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic text NOT NULL, message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled','completed')),
  created_at timestamptz NOT NULL DEFAULT now(), responded_at timestamptz,
  CHECK (mentee_id <> mentor_id));
-- Aynı çift için aynı anda tek açık (beklemede veya kabul edilmiş) talep olabilir.
CREATE UNIQUE INDEX mentorship_open_pair ON mentorship_requests(mentee_id, mentor_id)
  WHERE status IN ('pending','accepted');
CREATE INDEX mentorship_requests_mentor_idx ON mentorship_requests(mentor_id, created_at DESC);
CREATE INDEX mentorship_requests_mentee_idx ON mentorship_requests(mentee_id, created_at DESC);
