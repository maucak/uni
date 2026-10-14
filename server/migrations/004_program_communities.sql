ALTER TABLE communities ADD COLUMN program_id uuid REFERENCES programs(id);
CREATE UNIQUE INDEX communities_program_idx ON communities(program_id) WHERE program_id IS NOT NULL;
ALTER TABLE questions ADD COLUMN tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(tags)='array');
INSERT INTO communities(id,name,slug,description,program_id)
SELECT p.id,u.name || ' · ' || p.name || ' (' || p.language || ')','program-' || p.id::text,
'Dersler, hazırlık, staj ve kampüs yaşamı hakkında programla ilgili sorular.',p.id
FROM programs p JOIN universities u ON u.id=p.university_id WHERE NOT p.is_sample;
