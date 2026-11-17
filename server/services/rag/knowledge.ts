import { pool, transaction } from "../../db.ts";
import { lifeArticles } from "../life-content.ts";
import snapshot from "../../../data/life-knowledge.json" with { type: "json" };
import { chunkText, digest } from "./chunking.ts";
import { embed, embeddingKey } from "./models.ts";
import type { LifeArticle } from "../../../shared/life.ts";

export type KnowledgeChunk = {
  id: string;
  documentId: string;
  hash: string;
  body: string;
  article: LifeArticle;
  embedding: number[] | null;
};
export type KnowledgeIndex = {
  version: string;
  chunks: KnowledgeChunk[];
  sources: number;
  embeddingCoverage: number;
};
let cache: { expires: number; value: KnowledgeIndex } | undefined;
let loading: Promise<KnowledgeIndex> | undefined;
export function invalidateKnowledge() {
  cache = undefined;
}
export async function loadKnowledge(): Promise<KnowledgeIndex> {
  if (cache && cache.expires > Date.now()) return cache.value;
  if (loading) return loading;
  loading = (async () => {
    const rows = await pool.query(
      `SELECT c.id,c.body,c.content_hash,d.id AS document_id,d.external_key,d.title,d.topic,d.body AS parent_body,d.metadata,s.url,s.title AS source_title,s.scope,s.checked_at::date::text AS source_checked,s.active_version_id,e.embedding
     FROM rag_sources s JOIN rag_documents d ON d.version_id=s.active_version_id AND d.source_id=s.id
     JOIN rag_chunks c ON c.document_id=d.id
     LEFT JOIN rag_embeddings e ON e.chunk_id=c.id AND e.model=$1 WHERE s.enabled ORDER BY c.id`,
      [embeddingKey],
    );
    const chunks = mapChunks(rows.rows);
    const value = {
      version: digest(
        rows.rows
          .map(
            (r) => `${r.id}:${r.active_version_id}:${r.embedding ? "e" : ""}`,
          )
          .join("|"),
      ).slice(0, 20),
      chunks,
      sources: new Set(chunks.map((c) => c.article.url)).size,
      embeddingCoverage: chunks.length
        ? chunks.filter((c) => c.embedding).length / chunks.length
        : 0,
    };
    cache = { expires: Date.now() + 15000, value };
    return value;
  })().finally(() => {
    loading = undefined;
  });
  return loading;
}
export async function indexKnowledge(withEmbeddings = true) {
  const gate = await pool.connect();
  await gate.query("SELECT pg_advisory_lock(742389)");
  try {
    const staged: { sourceId: string; versionId: string; checkedAt: string }[] =
      [];
    const articles: LifeArticle[] = [
      ...lifeArticles,
      ...(snapshot.articles as LifeArticle[]),
    ];
    const groups = new Map<string, LifeArticle[]>();
    for (const article of articles) {
      const url = new URL(article.url);
      if (url.protocol !== "https:")
        throw new Error("Only HTTPS sources allowed");
      url.hash = "";
      const key = url.href;
      groups.set(key, [...(groups.get(key) || []), article]);
    }
    await transaction(async (c) => {
      for (const [url, docs] of groups) {
        const sourceId = digest(url).slice(0, 24);
        const content = docs.map((a) => ({
          id: a.id,
          title: a.title,
          text: a.text,
          topic: a.topic,
          period: a.period,
          kind: a.kind,
          scope: a.scope || "isubu",
          keywords: a.keywords,
          page: a.page,
          pageEnd: a.pageEnd,
          section: a.section,
        }));
        const hash = digest(
            JSON.stringify({ schema: "rag-v2", documents: content }),
          ),
          versionId = `${sourceId}:${hash.slice(0, 24)}`;
        const checkedAt = docs
          .map((d) => d.checkedAt)
          .sort()
          .at(-1)!;
        await c.query(
          `INSERT INTO rag_sources(id,url,title,scope,checked_at) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,scope=EXCLUDED.scope,updated_at=now()`,
          [
            sourceId,
            url,
            docs[0].sourceTitle,
            docs[0].scope || "isubu",
            checkedAt,
          ],
        );
        await c.query(
          "INSERT INTO rag_source_versions(id,source_id,content_hash,snapshot,fetched_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_id,content_hash) DO NOTHING",
          [versionId, sourceId, hash, JSON.stringify(content), checkedAt],
        );
        for (const article of docs) {
          const docId = `${versionId}:${digest(article.id).slice(0, 16)}`;
          const metadata = {
            checkedAt: article.checkedAt,
            period: article.period,
            keywords: article.keywords,
            kind: article.kind || "guide",
            campus: null,
            program:
              article.id === "prep" ? "computer" : article.program || null,
            historical: !!article.period && /geçmiş/i.test(article.period),
            page: article.page,
            pageEnd: article.pageEnd,
            section: article.section,
            reviewRequired:
              !!article.period && /doğrulanmalı/i.test(article.period),
          };
          await c.query(
            "INSERT INTO rag_documents(id,source_id,version_id,external_key,title,topic,body,metadata,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING",
            [
              docId,
              sourceId,
              versionId,
              article.id,
              article.title,
              article.topic,
              article.text,
              JSON.stringify(metadata),
              digest(article.text),
            ],
          );
          for (const [position, body] of chunkText(article.text).entries()) {
            const chunkId = `${docId}:${position}`,
              hash = digest(`${article.title}\n${body}`);
            await c.query(
              "INSERT INTO rag_chunks(id,document_id,position,body,content_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",
              [chunkId, docId, position, body, hash],
            );
            await c.query(
              `INSERT INTO rag_embeddings(chunk_id,model,dimensions,embedding)
           SELECT $1,e.model,e.dimensions,e.embedding FROM rag_embeddings e JOIN rag_chunks old ON old.id=e.chunk_id
           WHERE old.content_hash=$2 AND e.model=$3 LIMIT 1 ON CONFLICT DO NOTHING`,
              [chunkId, hash, embeddingKey],
            );
          }
        }
        staged.push({ sourceId, versionId, checkedAt });
      }
    });
    if (withEmbeddings) {
      const missing = await pool.query(
        `SELECT c.id,c.body,d.title FROM rag_chunks c JOIN rag_documents d ON d.id=c.document_id JOIN rag_sources s ON s.id=d.source_id
     LEFT JOIN rag_embeddings e ON e.chunk_id=c.id AND e.model=$1 WHERE d.version_id=ANY($2::text[]) AND e.chunk_id IS NULL ORDER BY c.id`,
        [embeddingKey, staged.map((s) => s.versionId)],
      );
      for (let i = 0; i < missing.rows.length; i += 8) {
        const batch = missing.rows.slice(i, i + 8);
        const vectors = await embed(
          batch.map((r) => `${r.title}\n${r.body}`),
          "passage",
        );
        await transaction(async (c) => {
          for (let n = 0; n < batch.length; n++)
            await c.query(
              "INSERT INTO rag_embeddings(chunk_id,model,dimensions,embedding) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
              [batch[n].id, embeddingKey, vectors[n].length, vectors[n]],
            );
        });
        console.log(
          `Embedding ${Math.min(i + 8, missing.rows.length)}/${missing.rows.length}`,
        );
      }
    }
    await transaction(async (c) => {
      for (const item of staged)
        await c.query(
          "UPDATE rag_sources SET active_version_id=$1,checked_at=$2,enabled=true,updated_at=now() WHERE id=$3",
          [item.versionId, item.checkedAt, item.sourceId],
        );
      await c.query(
        "UPDATE rag_sources SET enabled=false WHERE NOT(id=ANY($1::text[]))",
        [staged.map((s) => s.sourceId)],
      );
    });
    invalidateKnowledge();
    return loadKnowledge();
  } finally {
    await gate.query("SELECT pg_advisory_unlock(742389)");
    gate.release();
  }
}

function mapChunks(rows: any[]): KnowledgeChunk[] {
  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    hash: r.content_hash,
    body: r.body,
    embedding: r.embedding?.map(Number) || null,
    article: {
      ...r.metadata,
      checkedAt: r.source_checked,
      id: r.external_key,
      title: r.title,
      topic: r.topic,
      text: r.parent_body,
      url: r.url,
      sourceTitle: r.source_title,
      scope: r.scope,
      documentId: r.document_id,
      chunkId: r.id,
      sourceVersion: r.active_version_id,
    },
  }));
}
// Bounded hydration: Qdrant supplies IDs; PostgreSQL remains authoritative for active public sources.
export async function loadKnowledgeCandidates(
  ids: string[],
): Promise<KnowledgeChunk[]> {
  if (!ids.length) return [];
  if (ids.length > 40) throw new Error("Too many retrieval candidates");
  const rows = await pool.query(
    `SELECT c.id,c.body,c.content_hash,d.id AS document_id,d.external_key,d.title,d.topic,d.body AS parent_body,d.metadata,s.url,s.title AS source_title,s.scope,s.checked_at::date::text AS source_checked,s.active_version_id
    FROM rag_chunks c JOIN rag_documents d ON d.id=c.document_id
    JOIN rag_sources s ON s.id=d.source_id AND s.active_version_id=d.version_id
    WHERE s.enabled AND c.id=ANY($1::text[])`,
    [ids],
  );
  return mapChunks(rows.rows);
}
