import { useLocalDatabase } from "./environment.ts";
await useLocalDatabase();
const { pool } = await import("../server/db.ts");
try {
  const { loadKnowledge } = await import("../server/services/rag/knowledge.ts");
  const index = await loadKnowledge();
  const runs =
    await pool.query(`SELECT count(*)::int AS count,round(avg((diagnostics->>'elapsedMs')::numeric)) AS average_ms,
   count(*) FILTER(WHERE diagnostics->>'mode'='hybrid-reranked')::int AS hybrid_reranked FROM rag_retrieval_runs`);
  const feedback = await pool.query(
    "SELECT rating,count(*)::int AS count FROM rag_feedback GROUP BY rating",
  );
  const sources = await pool.query(
    "SELECT title,url,checked_at,enabled FROM rag_sources ORDER BY title",
  );
  console.log(
    JSON.stringify(
      {
        corpus: {
          version: index.version,
          chunks: index.chunks.length,
          sources: index.sources,
          embeddingCoverage: index.embeddingCoverage,
        },
        runs: runs.rows[0],
        feedback: feedback.rows,
        sources: sources.rows,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
