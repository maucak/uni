CREATE TABLE rag_sources (
 id text PRIMARY KEY, url text NOT NULL UNIQUE, title text NOT NULL,
 scope text NOT NULL CHECK(scope IN ('isubu','national')),
 active_version_id text, enabled boolean NOT NULL DEFAULT true,
 checked_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rag_source_versions (
 id text PRIMARY KEY, source_id text NOT NULL REFERENCES rag_sources(id),
 content_hash text NOT NULL, snapshot jsonb NOT NULL,
 fetched_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_id,content_hash), UNIQUE(source_id,id)
);
ALTER TABLE rag_sources ADD CONSTRAINT rag_source_active_fk
 FOREIGN KEY(id,active_version_id) REFERENCES rag_source_versions(source_id,id);
CREATE TABLE rag_documents (
 id text PRIMARY KEY, source_id text NOT NULL REFERENCES rag_sources(id),
 version_id text NOT NULL, external_key text NOT NULL,
 title text NOT NULL, topic text NOT NULL, body text NOT NULL,
 metadata jsonb NOT NULL, content_hash text NOT NULL,
 FOREIGN KEY(source_id,version_id) REFERENCES rag_source_versions(source_id,id),
 UNIQUE(version_id,external_key)
);
CREATE TABLE rag_chunks (
 id text PRIMARY KEY, document_id text NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
 position integer NOT NULL, body text NOT NULL, content_hash text NOT NULL,
 UNIQUE(document_id,position)
);
CREATE INDEX rag_chunks_doc_idx ON rag_chunks(document_id);
CREATE TABLE rag_embeddings (
 chunk_id text NOT NULL REFERENCES rag_chunks(id) ON DELETE CASCADE,
 model text NOT NULL, dimensions integer NOT NULL CHECK(dimensions>0),
 embedding real[] NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(cardinality(embedding)=dimensions), PRIMARY KEY(chunk_id,model)
);
ALTER TABLE life_conversations ADD COLUMN context jsonb NOT NULL DEFAULT '{}';
ALTER TABLE life_conversations ADD COLUMN busy_token uuid;
CREATE TABLE rag_requests (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_key uuid NOT NULL, conversation_id uuid NOT NULL REFERENCES life_conversations(id) ON DELETE CASCADE,
 state text NOT NULL CHECK(state IN ('pending','complete','failed')),
 response jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_key)
);
CREATE TABLE rag_retrieval_runs (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES life_conversations(id) ON DELETE CASCADE,
 request_key uuid NOT NULL, corpus_version text NOT NULL, query_hash text NOT NULL,
 diagnostics jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
