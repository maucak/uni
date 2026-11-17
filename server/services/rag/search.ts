import type { KnowledgeChunk } from "./knowledge.ts";
import type { RagContext } from "./context.ts";
export function educationLevel(text: string): "graduate" | "undergraduate" | null {
  const value = text.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g,"i");
  if (/\blisansustu\b|\byuksek lisans\b|\bdoktora\b|\bmaster\b/.test(value)) return "graduate";
  if (/\bonlisans\b|\blisans\b/.test(value)) return "undergraduate";
  return null;
}
export function levelCompatible(query: string, title: string) {
  const requested=educationLevel(query), source=educationLevel(title);
  return !requested || !source || requested===source;
}
export function tokens(text: string) {
  const stop = new Set([
    "icin",
    "nasil",
    "nerede",
    "hangi",
    "daha",
    "bana",
    "benim",
    "bunu",
    "bunun",
    "olan",
    "olarak",
    "bir",
    "var",
    "nedir",
    "yapabilirim",
    "peki",
    "mi",
    "miyim",
  ]);
  return (
    text
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .match(/[a-z0-9]+/g) || []
  )
    .filter((t) => t.length > 2 && !stop.has(t))
    // These productive domain terms otherwise split by Turkish possessive/case suffixes
    // (başvurusu/başvuruları, burs/bursu). Keep ordinary tokens intact for dense reranking.
    .map(t => {
      const root=["basvur","burs","kredi","yurt"].find(root=>t.startsWith(root));
      return root || (t.length > 8 ? t.slice(0, 8) : t);
    });
}
export function eligible(chunk: KnowledgeChunk, context: RagContext) {
  const a = chunk.article;
  if (a.scope !== "national" && a.scope !== context.university) return false;
  if(context.subject === "scholarship" && context.scholarshipType === "kyk" && (a.scope !== "national" || !/burs|kredi/i.test(a.sourceTitle)))return false;
  if(context.subject === "housing" && /GSB.*Burs ve öğrenim kredisi/i.test(a.sourceTitle))return false;
  const mealScholarship = /yemek.*burs|burs.*yemek|beslenme.*burs/i.test(a.title);
  if (context.subject === "scholarship" && context.scholarshipType !== "meal" && mealScholarship) return false;
  if (a.historical && !context.year) return false;
  if (context.year && a.period) {
    const years = a.period.match(/20\d\d/g)?.map(Number) || [];
    if (years.length && !years.includes(context.year)) return false;
  }
  const program = (a as any).program;
  if (program && (!context.program || context.program !== program))
    return false;
  return true;
}
export function bm25(query: string, chunks: KnowledgeChunk[]) {
  const docs = chunks.map((c) =>
    tokens(
      `${c.article.title} ${c.article.title} ${c.article.keywords.join(" ")} ${c.body}`,
    ),
  );
  const avg = docs.reduce((s, d) => s + d.length, 0) / Math.max(1, docs.length),
    df = new Map<string, number>();
  for (const d of docs)
    for (const t of new Set(d)) df.set(t, (df.get(t) || 0) + 1);
  const terms = [...new Set(tokens(query))];
  return chunks
    .map((chunk, i) => {
      const count = new Map<string, number>();
      for (const t of docs[i]) count.set(t, (count.get(t) || 0) + 1);
      let score = 0;
      for (const t of terms) {
        const tf = count.get(t) || 0;
        if (tf)
          score +=
            (Math.log(
              1 +
                (docs.length - (df.get(t) || 0) + 0.5) /
                  ((df.get(t) || 0) + 0.5),
            ) *
              tf *
              2.2) /
            (tf + 1.2 * (0.25 + (0.75 * docs[i].length) / Math.max(1, avg)));
      }
      return { chunk, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
export function dot(a: number[], b: number[]) {
  if (a.length !== b.length) return 0;
  return a.reduce((sum, n, i) => sum + n * b[i], 0);
}
export function fuse(
  lexical: { chunk: KnowledgeChunk; score: number }[],
  dense: { chunk: KnowledgeChunk; score: number }[],
) {
  const candidates = new Map<
    string,
    { chunk: KnowledgeChunk; score: number; lexical: number; semantic: number }
  >();
  for (const [list, field] of [
    [lexical, "lexical"],
    [dense, "semantic"],
  ] as const) {
    for (const [i, hit] of list.slice(0, 20).entries()) {
      const row = candidates.get(hit.chunk.id) || {
        chunk: hit.chunk,
        score: 0,
        lexical: 0,
        semantic: 0,
      };
      row.score += 1 / (60 + i + 1);
      row[field] = hit.score;
      candidates.set(hit.chunk.id, row);
    }
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score);
}
