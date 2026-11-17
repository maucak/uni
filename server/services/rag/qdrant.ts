import { createHash } from "node:crypto";
import { embeddingKey } from "./models.ts";
import { tokens } from "./search.ts";
import type { RagContext } from "./context.ts";

export function qdrantConfig() {
  const url = new URL(process.env.QDRANT_URL || "http://127.0.0.1:6333");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Geçersiz Qdrant adresi.");
  if (
    url.protocol !== "https:" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  )
    throw new Error("Uzak Qdrant bağlantısı HTTPS gerektirir.");
  const alias = process.env.QDRANT_COLLECTION || "kampus_knowledge";
  if (!/^[a-zA-Z0-9_-]+$/.test(alias))
    throw new Error("Geçersiz Qdrant koleksiyon adı.");
  return {
    url: url.href.replace(/\/$/, ""),
    alias,
    key: process.env.QDRANT_API_KEY,
  };
}
export async function qdrant<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const config = qdrantConfig();
  const response = await fetch(`${config.url}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(config.key ? { "api-key": config.key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`Qdrant işlemi başarısız (${response.status}).`);
  return ((await response.json()) as { result: T }).result;
}
export function pointId(chunkId: string) {
  const hex = createHash("sha256").update(chunkId).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
// Stable, versioned sparse term features. Qdrant applies collection IDF at query time.
// This is TF-IDF retrieval, not BM25; Turkish token normalization is shared with local search.
export function sparseVector(text: string) {
  const counts = new Map<number, number>();
  for (const term of tokens(text)) {
    const id = createHash("sha256").update(term).digest().readUInt32BE(0);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const entries = [...counts].sort((a, b) => a[0] - b[0]);
  return {
    indices: entries.map(([id]) => id),
    values: entries.map(([, tf]) => 1 + Math.log(tf)),
  };
}
export function scopeFilter(context: RagContext, topic = "") {
  const must: unknown[] = [
    { key: "model", match: { value: embeddingKey } },
    {
      key: "scope",
      match: {
        any:
          context.university !== "other" && context.university !== "unknown"
            ? ["national", context.university]
            : ["national"],
      },
    },
  ];
  const must_not: unknown[] = [];
  if (topic) must.push({ key: "topic", match: { value: topic } });
  if (!context.year) must.push({ key: "historical", match: { value: false } });
  else
    must.push({
      should: [
        { key: "years", match: { value: context.year } },
        { is_empty: { key: "years" } },
      ],
    });
  must.push({
    key: "program",
    match: { any: ["", ...(context.program ? [context.program] : [])] },
  });
  if (context.subject === "scholarship") {
    if (context.scholarshipType === "kyk")
      must.push({ key: "national_scholarship", match: { value: true } });
    if (context.scholarshipType !== "meal")
      must_not.push({ key: "meal_scholarship", match: { value: true } });
  }
  if (context.subject === "housing")
    must_not.push({ key: "national_scholarship", match: { value: true } });
  return { must, must_not };
}
export async function qdrantCandidates(
  query: string,
  context: RagContext,
  topic: string,
  vector?: number[],
) {
  const { alias } = qdrantConfig();
  // Resolve once and query the immutable concrete collection so an alias swap cannot mix versions.
  const aliases = await qdrant<{
    aliases: { alias_name: string; collection_name: string }[];
  }>("/aliases");
  const collection = aliases.aliases.find(
    (a) => a.alias_name === alias,
  )?.collection_name;
  if (!collection)
    throw new Error(
      "Qdrant indeksi hazır değil; rag:qdrant:index çalıştırılmalı.",
    );
  const path = `/collections/${collection}`;
  const info = await qdrant<{ points_count: number }>(path);
  const filter = scopeFilter(context, topic);
  type Hit = { score: number; payload: { chunk_id: string } };
  const search = async (using: string, query: unknown) => {
    const result = await qdrant<{ points: Hit[] }>(
      `${path}/points/query`,
      "POST",
      { using, query, filter, limit: 20, with_payload: ["chunk_id"] },
    );
    return result.points.map((h) => ({
      id: h.payload.chunk_id,
      score: h.score,
    }));
  };
  const sparse = sparseVector(query);
  const [lexical, dense] = await Promise.all([
    sparse.indices.length ? search("terms", sparse) : Promise.resolve([]),
    vector ? search("dense", vector) : Promise.resolve([]),
  ]);
  return { lexical, dense, version: collection, chunks: info.points_count };
}
