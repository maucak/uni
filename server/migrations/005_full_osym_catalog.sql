ALTER TABLE universities DROP CONSTRAINT universities_university_type_check;
ALTER TABLE universities ADD CONSTRAINT universities_university_type_check CHECK(university_type IN ('Devlet','Vakıf','Yurt dışı'));
CREATE TABLE program_admissions (
 program_id uuid NOT NULL REFERENCES programs(id), year integer NOT NULL,
 table_number text NOT NULL CHECK(table_number IN ('3','4')), source_row integer NOT NULL CHECK(source_row>0),
 source_id uuid NOT NULL REFERENCES data_sources(id), details jsonb NOT NULL,
 PRIMARY KEY(program_id,year)
);
