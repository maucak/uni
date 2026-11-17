import { useLocalDatabase } from "./environment.ts";
await useLocalDatabase();
const { pool } = await import("../server/db.ts");
try {
  const { indexKnowledge } =
    await import("../server/services/rag/knowledge.ts");
  const result = await indexKnowledge(!process.argv.includes("--lexical-only"));
  console.log(
    JSON.stringify({
      version: result.version,
      chunks: result.chunks.length,
      sources: result.sources,
      embeddingCoverage: result.embeddingCoverage,
    }),
  );
} finally {
  await pool.end();
}
