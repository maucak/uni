CREATE TABLE rag_feedback (
 user_id uuid NOT NULL,
 request_key uuid NOT NULL,
 rating smallint NOT NULL CHECK(rating IN (-1,1)),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_key),
 FOREIGN KEY(user_id,request_key) REFERENCES rag_requests(user_id,request_key) ON DELETE CASCADE
);
