import { mkdir, writeFile } from "node:fs/promises";
import { useLocalDatabase } from "./environment.ts";
import fixtures from "../data/rag-evaluation.json" with { type: "json" };
await useLocalDatabase();
const { pool } = await import("../server/db.ts");
try {
  const { contextFor, retrievalQuestion } =
    await import("../server/services/rag/context.ts");
  const { retrieve } = await import("../server/services/rag/retrieve.ts");
  const results = [];
  for (const item of fixtures.cases) {
    const { context } = contextFor(item.question);
    const result =
      context.university === "other"
        ? null
        : await retrieve(
            retrievalQuestion(item.question, context),
            context,
            "",
            { cache: false },
          );
    const ids = result?.sources.map((s) => s.id) || [];
    const rank =
      item.relevant
        ?.map((id) => ids.indexOf(id) + 1)
        .filter((n) => n > 0)
        .sort((a, b) => a - b)[0] || 0;
    const pass = item.reject ? ids.length === 0 : rank > 0;
    results.push({
      question: item.question,
      pass,
      rank,
      ids,
      elapsedMs: result?.diagnostics.elapsedMs || 0,
      mode: result?.diagnostics.mode || "scope-guard",
    });
    console.log(
      `${pass ? "PASS" : "REVIEW"} ${item.question} ${rank ? `(rank ${rank})` : ""}`,
    );
  }
  const report = {
    at: new Date().toISOString(),
    purpose: fixtures.purpose,
    passed: results.filter((r) => r.pass).length,
    total: results.length,
    results,
  };
  await mkdir("var/reports", { recursive: true });
  await writeFile(
    "var/reports/rag-evaluation.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: report.passed,
      total: report.total,
      report: "var/reports/rag-evaluation.json",
    }),
  );
  if (report.passed < report.total) process.exitCode = 1;
} finally {
  await pool.end();
}
