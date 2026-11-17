import { qdrantCandidates } from "./qdrant.ts";
import { loadKnowledge, loadKnowledgeCandidates } from "./knowledge.ts";
import { embed, rerank, embeddingKey, rerankerRevision } from "./models.ts";
import { digest } from "./chunking.ts";
import type { LifeArticle } from "../../../shared/life.ts";
import { bm25, dot, eligible, fuse, levelCompatible } from "./search.ts";
import type { RagContext } from "./context.ts";
export type RetrievalDiagnostics = {
  corpusVersion: string;
  chunks: number;
  mode: "hybrid-reranked" | "hybrid" | "lexical";
  embeddingCoverage: number;
  elapsedMs: number;
  cacheHit?: boolean;
  warnings: string[];
  candidates: {
    id: string;
    lexical: number;
    semantic: number;
    rerank: number | null;
  }[];
};
type RagResult = {
  sources: LifeArticle[];
  diagnostics: RetrievalDiagnostics;
  model: string;
};
const cache = new Map<string, { at: number; value: RagResult }>();
export async function retrieve(
  query: string,
  context: RagContext,
  topic = "",
  options: {
    semantic?: boolean;
    reranking?: boolean;
    cache?: boolean;
    // false: BM25 sonuçları kullanılmaz (yalnızca vektör). Varsayılan true; değerlendirme içindir.
    lexical?: boolean;
  } = {},
): Promise<RagResult> {
  const start = performance.now();
  const backend = process.env.RAG_SEARCH_BACKEND || "local";
  if (!["local", "qdrant"].includes(backend))
    throw new Error("Geçersiz RAG_SEARCH_BACKEND.");
  const warnings: string[] = [];
  let remote: Awaited<ReturnType<typeof qdrantCandidates>> | undefined;
  if (backend === "qdrant") {
    let vector: number[] | undefined;
    if (options.semantic !== false) {
      try {
        [vector] = await embed([query], "query");
      } catch {
        warnings.push("semantic-unavailable");
      }
    }
    remote = await qdrantCandidates(query, context, topic, vector);
  }
  const index = remote
    ? {
        version: remote.version,
        embeddingCoverage: 1,
        chunks: await loadKnowledgeCandidates([
          ...new Set([...remote.lexical, ...remote.dense].map((h) => h.id)),
        ]),
      }
    : await loadKnowledge();
  const chunks = index.chunks.filter(
    (c) =>
      eligible(c, context) &&
      levelCompatible(query, c.article.title) &&
      (!topic || c.article.topic === topic),
  );
  const key = digest(
    JSON.stringify({
      query,
      backend,
      context,
      topic,
      version: index.version,
      embeddingKey,
      rerankerRevision,
      semantic: options.semantic,
      reranking: options.reranking,
      lexical: options.lexical,
    }),
  );
  const prior = cache.get(key);
  if (options.cache !== false && prior && Date.now() - prior.at < 300000) {
    const value = structuredClone(prior.value);
    value.diagnostics.cacheHit = true;
    value.diagnostics.elapsedMs = Math.round(performance.now() - start);
    return value;
  }
  const hydrate = (hits: { id: string; score: number }[]) =>
    hits.flatMap((hit) => {
      const chunk = chunks.find((c) => c.id === hit.id);
      return chunk ? [{ chunk, score: hit.score }] : [];
    });
  const lexicalOff = options.lexical === false;
  const lexical = lexicalOff
    ? []
    : remote
      ? hydrate(remote.lexical)
      : bm25(query, chunks).slice(0, 20);
  let dense: { chunk: (typeof chunks)[number]; score: number }[] = [],
    semantic = !!remote?.dense.length;
  if (remote) dense = hydrate(remote.dense);
  if (
    !remote &&
    options.semantic !== false &&
    chunks.some((c) => c.embedding)
  ) {
    try {
      const [vector] = await embed([query], "query");
      dense = chunks
        .filter((c) => c.embedding)
        .map((chunk) => ({ chunk, score: dot(vector, chunk.embedding!) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      semantic = true;
    } catch {
      warnings.push("semantic-unavailable");
    }
  }
  const seenParents = new Set<string>();
  const fused = fuse(lexical, dense);
  const protectedIds = new Set(
    [...lexical.slice(0, 2), ...dense.slice(0, 2)].map((r) => r.chunk.id),
  );
  // Preserve each retriever's strongest hits; RRF overlap alone can crowd out a useful lexical match.
  const candidates = [
    ...fused.filter((r) => protectedIds.has(r.chunk.id)),
    ...fused.filter((r) => !protectedIds.has(r.chunk.id)),
  ];
  let ranked = candidates
    .filter((hit) => {
      if (seenParents.has(hit.chunk.documentId)) return false;
      seenParents.add(hit.chunk.documentId);
      return true;
    })
    .slice(0, 8)
    .map((row) => ({ ...row, rerank: null as number | null }));
  let reranked = false;
  if (options.reranking !== false && ranked.length) {
    try {
      const scores = await rerank(
        query,
        ranked.map((r) => `${r.chunk.article.title}\n${r.chunk.body}`),
      );
      ranked = ranked
        .map((r, i) => ({ ...r, rerank: scores[i] }))
        .sort((a, b) => b.rerank! - a.rerank!);
      reranked = true;
    } catch {
      warnings.push("reranker-unavailable");
    }
  }
  // Cross-encoder values are relevance scores, not confidence probabilities.
  // Keep weak-only candidates out instead of always forcing four sources.
  const floor = reranked ? Math.max(0.12, (ranked[0]?.rerank || 0) * 0.35) : 0;
  const denseLeaders = new Set(dense.slice(0, 2).map((r) => r.chunk.id));
  const accepted = ranked.filter((r) =>
    reranked
      ? r.rerank! >= floor ||
        (denseLeaders.has(r.chunk.id) && r.lexical > 0 && r.rerank! >= 0.05)
      : lexicalOff
        ? r.semantic >= 0.84
        : semantic
          ? r.lexical > 0 && r.semantic >= 0.84
          : r.lexical > 0,
  );
  const parents = new Set<string>();
  let chars = 0;
  const selected = accepted.filter((r) => {
    if (parents.has(r.chunk.documentId) || parents.size >= 4) return false;
    const size = r.chunk.article.text.length;
    if (chars + size > 8500 && parents.size) return false;
    parents.add(r.chunk.documentId);
    chars += size;
    return true;
  });
  const sources = selected.map((r) => r.chunk.article);
  if (sources.some((s) => s.historical)) warnings.push("historical-source");
  if (sources.some((s) => !s.period)) warnings.push("period-unspecified");
  const diagnostics: RetrievalDiagnostics = {
    corpusVersion: index.version,
    chunks: remote?.chunks ?? chunks.length,
    mode: semantic ? (reranked ? "hybrid-reranked" : "hybrid") : "lexical",
    embeddingCoverage: index.embeddingCoverage,
    elapsedMs: Math.round(performance.now() - start),
    warnings,
    candidates: ranked.slice(0, 10).map((r) => ({
      id: r.chunk.article.id,
      lexical: r.lexical,
      semantic: r.semantic,
      rerank: r.rerank,
    })),
  };
  const value = { sources, diagnostics, model: embeddingKey };
  if (options.cache !== false && reranked && semantic) {
    if (cache.size >= 64) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), value: structuredClone(value) });
  }
  return value;
}
