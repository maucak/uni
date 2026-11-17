import { useLocalDatabase } from "./environment.ts";
await useLocalDatabase();
const { pool } = await import("../server/db.ts");
const { qdrant, qdrantConfig, pointId, sparseVector } =
  await import("../server/services/rag/qdrant.ts");
const { loadKnowledgeCandidates } =
  await import("../server/services/rag/knowledge.ts");
const { embeddingKey } = await import("../server/services/rag/models.ts");
const { digest } = await import("../server/services/rag/chunking.ts");
const gate = await pool.connect();
try {
  // Same lock as the source indexer: a publication cannot change halfway through export.
  await gate.query("SELECT pg_advisory_lock(742389)");
  const state = await pool.query(
    `SELECT s.id,s.active_version_id FROM rag_sources s WHERE s.enabled ORDER BY s.id`,
  );
  if (!state.rowCount) throw new Error("Önce rag:index çalıştırılmalı.");
  const { alias } = qdrantConfig();
  const collection = `${alias}_${digest(JSON.stringify(state.rows) + embeddingKey + "tfidf-v1").slice(0, 12)}_${Date.now()}`;
  await qdrant(`/collections/${collection}`, "PUT", {
    vectors: { dense: { size: 384, distance: "Cosine", on_disk: true } },
    sparse_vectors: { terms: { modifier: "idf", index: { on_disk: true } } },
    on_disk_payload: true,
  });
  for (const [field_name, field_schema] of Object.entries({
    model: "keyword",
    scope: "keyword",
    topic: "keyword",
    program: "keyword",
    historical: "bool",
    years: "integer",
    national_scholarship: "bool",
    meal_scholarship: "bool",
  })) {
    await qdrant(`/collections/${collection}/index?wait=true`, "PUT", {
      field_name,
      field_schema,
    });
  }
  let after = "",
    count = 0;
  while (true) {
    const rows = await pool.query(
      `SELECT c.id,e.embedding FROM rag_chunks c
      JOIN rag_documents d ON d.id=c.document_id JOIN rag_sources s ON s.id=d.source_id AND s.active_version_id=d.version_id
      LEFT JOIN rag_embeddings e ON e.chunk_id=c.id AND e.model=$1
      WHERE s.enabled AND c.id>$2 ORDER BY c.id LIMIT 40`,
      [embeddingKey, after],
    );
    if (!rows.rowCount) break;
    const chunks = await loadKnowledgeCandidates(rows.rows.map((r) => r.id));
    const points = rows.rows.map((row) => {
      const c = chunks.find((c) => c.id === row.id)!;
      const a = c.article;
      const vector = row.embedding?.map(Number);
      if (!vector || vector.length !== 384 || !vector.every(Number.isFinite))
        throw new Error(
          "Embedding eksik veya geçersiz; önce rag:index çalıştırılmalı.",
        );
      return {
        id: pointId(c.id),
        vector: {
          dense: vector,
          terms: sparseVector(
            `${a.title} ${a.title} ${a.keywords.join(" ")} ${c.body}`,
          ),
        },
        payload: {
          chunk_id: c.id,
          model: embeddingKey,
          scope: a.scope || "isubu",
          topic: a.topic,
          program: a.program || "",
          historical: !!a.historical,
          years: (a.period?.match(/20\d\d/g) || []).map(Number),
          national_scholarship:
            a.scope === "national" && /burs|kredi/i.test(a.sourceTitle),
          meal_scholarship: /yemek.*burs|burs.*yemek|beslenme.*burs/i.test(
            a.title,
          ),
        },
      };
    });
    await qdrant(`/collections/${collection}/points?wait=true`, "PUT", {
      points,
    });
    count += points.length;
    after = rows.rows.at(-1)!.id;
  }
  const verified = await qdrant<{ count: number }>(
    `/collections/${collection}/points/count`,
    "POST",
    { exact: true },
  );
  if (!count || verified.count !== count)
    throw new Error(
      "İndeks sayım kontrolü başarısız. Önceki indeks korunuyor.",
    );
  const aliases = await qdrant<{ aliases: { alias_name: string }[] }>(
    "/aliases",
  );
  await qdrant("/collections/aliases", "POST", {
    actions: [
      ...(aliases.aliases.some((a) => a.alias_name === alias)
        ? [{ delete_alias: { alias_name: alias } }]
        : []),
      { create_alias: { collection_name: collection, alias_name: alias } },
    ],
  });
  console.log(
    JSON.stringify({
      backend: "qdrant",
      collection,
      chunks: count,
      published: true,
    }),
  );
} finally {
  await gate.query("SELECT pg_advisory_unlock(742389)");
  gate.release();
  await pool.end();
}
