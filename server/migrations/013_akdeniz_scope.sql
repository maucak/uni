ALTER TABLE rag_sources DROP CONSTRAINT rag_sources_scope_check;
ALTER TABLE rag_sources ADD CONSTRAINT rag_sources_scope_check CHECK(scope IN ('isubu','sdu','pau','akdeniz','national'));
