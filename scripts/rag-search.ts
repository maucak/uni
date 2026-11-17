import { useLocalDatabase } from "./environment.ts";
await useLocalDatabase();
const { pool } = await import("../server/db.ts");
try {
  const { contextFor, retrievalQuestion } =
    await import("../server/services/rag/context.ts");
  const { retrieve } = await import("../server/services/rag/retrieve.ts");
  const query =
    process.argv.slice(2).join(" ") ||
    "İngilizceyi geçersem hazırlığı atlayabilir miyim?";
  const { context, clarification } = contextFor(query);
  const result = await retrieve(retrievalQuestion(query, context), context);
  console.log(
    JSON.stringify(
      {
        query,
        clarification,
        mode: result.diagnostics.mode,
        elapsedMs: result.diagnostics.elapsedMs,
        sources: result.sources.map((s) => ({ id: s.id, title: s.title })),
        candidates: result.diagnostics.candidates,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
