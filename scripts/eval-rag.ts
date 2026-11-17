// Danışman arama katmanı değerlendirmesi (issue #7): BM25 / vektör / RRF hibrit /
// hibrit + yeniden sıralama düzeneklerini aynı soru ve aynı korpus sürümüyle ölçer.
// LLM çağrılmaz; yalnızca server/services/rag/retrieve.ts aramasının çıktısı ölçülür.
// Soruları ekip yazar: data/eval/rag-sorular.json (şema: docs/degerlendirme.md).
import { parseArgs } from "node:util";
import { z } from "zod";
import { useLocalDatabase } from "./environment.ts";
import {
  EvalError,
  fmt,
  gitInfo,
  mdTable,
  readEvalFile,
  timestamp,
  writeReports,
} from "./eval-common.ts";
import {
  mean,
  percentile,
  recallAtK,
  reciprocalRank,
  wrongScopeSources,
} from "./eval-metrics.ts";

const DEFAULT_FILE = "data/eval/rag-sorular.json";
const EXAMPLE_FILE = "data/eval/rag-sorular.ornek.json";
const ALL_MODES = ["bm25", "vector", "hybrid", "hybrid_rerank"] as const;
type Mode = (typeof ALL_MODES)[number];
const MODE_LABEL: Record<Mode, string> = {
  bm25: "Yalnızca BM25",
  vector: "Yalnızca vektör",
  hybrid: "RRF hibrit",
  hybrid_rerank: "Hibrit + yeniden sıralama",
};
// retrieve() seçenekleri; hiçbiri varsayılan davranışı değiştirmez.
const MODE_OPTIONS: Record<Mode, object> = {
  bm25: { semantic: false, reranking: false },
  vector: { lexical: false, reranking: false },
  hybrid: { reranking: false },
  hybrid_rerank: {},
};
const EXPECTED_ENGINE: Record<Mode, string> = {
  bm25: "lexical",
  vector: "hybrid",
  hybrid: "hybrid",
  hybrid_rerank: "hybrid-reranked",
};
const CLASSES = [
  "acik",
  "belirsiz",
  "cok_turlu",
  "kurum_degisimi",
  "ulusal",
  "kaynaksiz",
  "guncel_ucret_tarih",
  "yazim_hatali",
  "yaniltici_belge",
] as const;
const INSTITUTIONS = ["isubu", "sdu", "pau", "akdeniz"] as const;

const fileSchema = z.object({
  surum: z.string().min(1),
  aciklama: z.string().optional(),
  ornek: z.boolean().optional(),
  sorular: z
    .array(
      z
        .object({
          id: z.string().min(1),
          soru: z.string().min(2),
          // Çok turlu sorularda son sorudan önceki kullanıcı mesajları, sırayla.
          onceki_turlar: z.array(z.string()).default([]),
          // Sorunun ait olduğu kurum; "diger" korpusta olmayan bir kurum demektir.
          kurum: z.enum([...INSTITUTIONS, "national", "diger"]),
          ilgili_kaynaklar: z.array(z.string()),
          // Dönmemesi gereken kaynaklar (ör. yanıltıcı/eski belge). İsteğe bağlı.
          kacinilacak_kaynaklar: z.array(z.string()).default([]),
          sinif: z.enum(CLASSES),
          not: z.string().optional(),
        })
        .superRefine((q, ctx) => {
          if (q.sinif === "kaynaksiz" && q.ilgili_kaynaklar.length)
            ctx.addIssue({
              code: "custom",
              message: `${q.id}: kaynaksiz sınıfında ilgili_kaynaklar boş olmalı.`,
            });
          if (
            !["kaynaksiz", "belirsiz"].includes(q.sinif) &&
            !q.ilgili_kaynaklar.length
          )
            ctx.addIssue({
              code: "custom",
              message: `${q.id}: ilgili_kaynaklar boş olamaz (yalnızca kaynaksiz ve belirsiz sınıfları boş olabilir).`,
            });
          if (q.sinif === "cok_turlu" && !q.onceki_turlar.length)
            ctx.addIssue({
              code: "custom",
              message: `${q.id}: cok_turlu sınıfında onceki_turlar dolu olmalı.`,
            });
        }),
    )
    .min(1),
});

const { values } = parseArgs({
  options: {
    questions: { type: "string", default: DEFAULT_FILE },
    modes: { type: "string", default: ALL_MODES.join(",") },
    repeats: { type: "string", default: "1" },
    "allow-example": { type: "boolean", default: false },
  },
});
function fail(message: string, code = 1): never {
  console.error(`HATA: ${message}`);
  process.exit(code);
}
const modes = values.modes!.split(",").map((m) => m.trim()) as Mode[];
for (const m of modes)
  if (!ALL_MODES.includes(m))
    fail(`Bilinmeyen mod: ${m}. Geçerli: ${ALL_MODES.join(", ")}`, 2);
const repeats = Number(values.repeats);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20)
  fail("--repeats 1 ile 20 arasında bir tam sayı olmalı.", 2);

let file: z.infer<typeof fileSchema>, sha256: string;
try {
  const read = await readEvalFile(
    values.questions!,
    "RAG soru seti",
    EXAMPLE_FILE,
  );
  const parsed = fileSchema.safeParse(read.data);
  if (!parsed.success)
    throw new EvalError(
      `${values.questions} şemaya uymuyor:\n${z.prettifyError(parsed.error)}`,
    );
  file = parsed.data;
  sha256 = read.sha256;
  const ids = file.sorular.map((q) => q.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length)
    throw new EvalError(
      `Yinelenen soru kimlikleri: ${[...new Set(dup)].join(", ")}`,
    );
  if (file.ornek && !values["allow-example"])
    throw new EvalError(
      `${values.questions} bir ÖRNEK şablondur ve ölçümde kullanılmaz. ` +
        `Yalnızca script'i denemek için --allow-example verin; rapor "geçersiz" işaretlenir.`,
    );
} catch (e) {
  if (e instanceof EvalError) fail(e.message);
  throw e;
}

await useLocalDatabase();
const { pool } = await import("../server/db.ts");
try {
  const { contextFor, retrievalQuestion } =
    await import("../server/services/rag/context.ts");
  const { retrieve } = await import("../server/services/rag/retrieve.ts");
  const { loadKnowledge } = await import("../server/services/rag/knowledge.ts");
  const models = await import("../server/services/rag/models.ts");

  const index = await loadKnowledge();
  const knownSources = new Set(index.chunks.map((c) => c.article.id));
  const warnings: string[] = [];
  if (file.ornek)
    warnings.push("ÖRNEK şablon kullanıldı; sonuçlar ölçüm değildir.");
  if (file.sorular.length < 60 && !file.ornek)
    warnings.push(
      `Soru sayısı ${file.sorular.length}; bağımsız set için en az 60 soru hedeflenir.`,
    );
  const unknown = file.sorular.flatMap((q) =>
    [...q.ilgili_kaynaklar, ...q.kacinilacak_kaynaklar]
      .filter((id) => !knownSources.has(id))
      .map((id) => `${q.id}: ${id}`),
  );
  if (unknown.length) {
    const text = `Korpusta bulunamayan kaynak kimlikleri (${unknown.length}):\n${unknown
      .slice(0, 20)
      .map((u) => `  ${u}`)
      .join(
        "\n",
      )}\nKorpus sürümü: ${index.version}. Kimlikleri 'npm run rag:search' çıktısından alın.`;
    if (!file.ornek) fail(text);
    warnings.push(`${unknown.length} kaynak kimliği korpusta bulunamadı.`);
  }

  // Model varlığı: hata verirse ilgili modlar "atlandı" olarak raporlanır, script çökmez.
  let embedOk = false,
    rerankOk = false;
  try {
    await models.embed(["sağlık denemesi"], "query");
    embedOk = true;
  } catch {}
  try {
    await models.rerank("deneme", ["deneme metni"]);
    rerankOk = true;
  } catch {}
  const embeddingCoverage = index.embeddingCoverage;
  const SKIP = "atlandı: model yok";
  const status: Record<Mode, { run: boolean; note: string }> = {
    bm25: { run: true, note: "" },
    vector:
      embedOk && embeddingCoverage > 0
        ? { run: true, note: "" }
        : { run: false, note: SKIP },
    // Vektör yoksa hibrit sessizce BM25'e düşer; karşılaştırmayı yanıltmasın diye atlanır.
    hybrid:
      embedOk && embeddingCoverage > 0
        ? { run: true, note: "" }
        : { run: false, note: SKIP },
    hybrid_rerank:
      embedOk && rerankOk && embeddingCoverage > 0
        ? { run: true, note: "" }
        : { run: false, note: SKIP },
  };
  if (!embedOk || !rerankOk || embeddingCoverage === 0)
    warnings.push(
      `Model durumu: gömme modeli ${embedOk ? "var" : "yok"}, yeniden sıralayıcı ${rerankOk ? "var" : "yok"}, gömme kapsamı ${fmt(embeddingCoverage, 2)}. ` +
        "Modeller için 'npm run rag:models', vektörler için 'npm run rag:index' çalıştırın.",
    );
  else if (embeddingCoverage < 1)
    warnings.push(
      `Gömme kapsamı ${fmt(embeddingCoverage, 2)} (tüm parçalar vektörlenmemiş); vektör sonuçları eksik olabilir.`,
    );

  type Run = {
    id: string;
    class: string;
    scope: string;
    returned: string[];
    scopes: (string | undefined)[];
    elapsedMs: number | null;
    guard: boolean;
    engine: string;
    corpusVersion: string | null;
    warnings: string[];
    recall: { 1: number | null; 3: number | null; 5: number | null };
    rr: number | null;
    wrongScope: number;
    avoidedHit: boolean | null;
  };
  const results: Partial<Record<Mode, Run[]>> = {};
  const corpusVersions = new Set<string>();

  async function prepare(q: (typeof file.sorular)[number]) {
    let previous: ReturnType<typeof contextFor>["context"] | undefined;
    let previousQuery = "";
    const withScope = (c: NonNullable<typeof previous>) =>
      c.university === "unknown" &&
      (INSTITUTIONS as readonly string[]).includes(q.kurum)
        ? {
            ...c,
            university: q.kurum as (typeof INSTITUTIONS)[number],
            universityVerified: true,
          }
        : c;
    for (const turn of q.onceki_turlar) {
      previous = withScope(contextFor(turn, previous).context);
      previousQuery = retrievalQuestion(turn, previous, previousQuery);
    }
    const context = withScope(contextFor(q.soru, previous).context);
    return {
      context,
      query: retrievalQuestion(q.soru, context, previousQuery),
    };
  }

  for (const mode of modes) {
    if (!status[mode].run) {
      console.log(`${MODE_LABEL[mode]}: ${status[mode].note}`);
      continue;
    }
    const runs: Run[] = [];
    let warm = false;
    for (const q of file.sorular) {
      const { context, query } = await prepare(q);
      const guard =
        context.university === "other" && context.subject !== "housing";
      let returned: string[] = [],
        scopes: (string | undefined)[] = [];
      let engine = "scope-guard",
        corpusVersion: string | null = null,
        runWarnings: string[] = [];
      const times: number[] = [];
      if (!guard) {
        // Önbellek süresi (15 sn) zamanlamaya girmesin: korpusu ölçümden önce yenile.
        await loadKnowledge();
        if (!warm) {
          await retrieve(query, context, "", {
            ...MODE_OPTIONS[mode],
            cache: false,
          });
          warm = true;
        }
        for (let r = 0; r < repeats; r++) {
          await loadKnowledge();
          const start = performance.now();
          const found = await retrieve(query, context, "", {
            ...MODE_OPTIONS[mode],
            cache: false,
          });
          times.push(performance.now() - start);
          if (r === 0) {
            returned = found.sources.map((s) => s.id);
            scopes = found.sources.map((s) => s.scope);
            engine = found.diagnostics.mode;
            corpusVersion = found.diagnostics.corpusVersion;
            runWarnings = found.diagnostics.warnings;
            corpusVersions.add(corpusVersion);
          }
        }
      }
      runs.push({
        id: q.id,
        class: q.sinif,
        scope: q.kurum,
        returned,
        scopes,
        elapsedMs: times.length ? mean(times) : null,
        guard,
        engine,
        corpusVersion,
        warnings: runWarnings,
        recall: {
          1: recallAtK(returned, q.ilgili_kaynaklar, 1),
          3: recallAtK(returned, q.ilgili_kaynaklar, 3),
          5: recallAtK(returned, q.ilgili_kaynaklar, 5),
        },
        rr: reciprocalRank(returned, q.ilgili_kaynaklar),
        wrongScope: wrongScopeSources(scopes, q.kurum),
        avoidedHit: q.kacinilacak_kaynaklar.length
          ? returned.some((id) => q.kacinilacak_kaynaklar.includes(id))
          : null,
      });
    }
    results[mode] = runs;
    console.log(`${MODE_LABEL[mode]}: ${runs.length} soru ölçüldü.`);
  }
  if (corpusVersions.size > 1)
    warnings.push(
      `Ölçüm sırasında korpus sürümü değişti (${[...corpusVersions].join(", ")}); modlar aynı korpusla karşılaştırılmadı. Yeniden çalıştırın.`,
    );

  const nums = (xs: (number | null)[]) =>
    xs.filter((x): x is number => x !== null);
  function summarize(runs: Run[]) {
    const withSources = runs.filter((r) => r.returned.length);
    const timed = runs.filter((r) => r.elapsedMs !== null && !r.guard);
    const returnedTotal = runs.reduce((s, r) => s + r.returned.length, 0);
    const avoid = runs.filter((r) => r.avoidedHit !== null);
    const noSource = runs.filter(
      (r, i) => file.sorular[i].sinif === "kaynaksiz",
    );
    return {
      questions: runs.length,
      scored: nums(runs.map((r) => r.rr)).length,
      recallAt1: mean(nums(runs.map((r) => r.recall[1]))),
      recallAt3: mean(nums(runs.map((r) => r.recall[3]))),
      recallAt5: mean(nums(runs.map((r) => r.recall[5]))),
      mrr: mean(nums(runs.map((r) => r.rr))),
      wrongScopeSourceRate: returnedTotal
        ? runs.reduce((s, r) => s + r.wrongScope, 0) / returnedTotal
        : null,
      wrongScopeQuestionRate: withSources.length
        ? withSources.filter((r) => r.wrongScope > 0).length /
          withSources.length
        : null,
      returnedSources: returnedTotal,
      emptyReturnRate: runs.length
        ? runs.filter((r) => !r.returned.length).length / runs.length
        : null,
      noSourceCorrectEmptyRate: noSource.length
        ? noSource.filter((r) => !r.returned.length).length / noSource.length
        : null,
      avoidedSourceReturnRate: avoid.length
        ? avoid.filter((r) => r.avoidedHit).length / avoid.length
        : null,
      latencyMs: {
        n: timed.length,
        p50: percentile(
          timed.map((r) => r.elapsedMs!),
          50,
        ),
        p95: percentile(
          timed.map((r) => r.elapsedMs!),
          95,
        ),
      },
      scopeGuardQuestions: runs.filter((r) => r.guard).length,
      engineMismatch: 0, // mod bazında aşağıda doldurulur
    };
  }
  const summary: Record<string, ReturnType<typeof summarize> | undefined> = {};
  const byClass: Record<
    string,
    Record<string, ReturnType<typeof summarize>>
  > = {};
  for (const mode of modes) {
    const runs = results[mode];
    if (!runs) continue;
    const s = summarize(runs);
    s.engineMismatch = runs.filter(
      (r) => !r.guard && r.engine !== EXPECTED_ENGINE[mode],
    ).length;
    if (s.engineMismatch)
      warnings.push(
        `${MODE_LABEL[mode]}: ${s.engineMismatch} soruda beklenen arama yolu (${EXPECTED_ENGINE[mode]}) çalışmadı (model hatası ya da yedek yol). Bu modun sonuçlarına güvenmeyin.`,
      );
    summary[mode] = s;
    byClass[mode] = {};
    for (const c of CLASSES) {
      const subset = runs.filter((r) => r.class === c);
      if (subset.length) byClass[mode][c] = summarize(subset);
    }
  }
  const classCounts = Object.fromEntries(
    CLASSES.map((c) => [c, file.sorular.filter((q) => q.sinif === c).length]),
  );

  const git = gitInfo();
  const stamp = timestamp();
  const report = {
    kind: "eval-rag",
    at: new Date().toISOString(),
    valid: !file.ornek,
    warnings,
    versions: {
      corpusVersion: index.version,
      corpusVersionsSeen: [...corpusVersions],
      chunks: index.chunks.length,
      sources: index.sources,
      embeddingModel: models.embeddingKey,
      rerankerModel: `${models.rerankerModel}:${models.rerankerRevision}`,
      embeddingCoverage,
      searchBackend: process.env.RAG_SEARCH_BACKEND || "local",
      gitCommit: git.commit,
      gitDirty: git.dirty,
      node: process.version,
    },
    input: {
      file: values.questions,
      sha256,
      fileVersion: file.surum,
      questions: file.sorular.length,
      classCounts,
      repeats,
    },
    modeStatus: Object.fromEntries(
      modes.map((m) => [
        m,
        status[m].run ? { status: "ölçüldü" } : { status: status[m].note },
      ]),
    ),
    summary,
    byClass,
    perQuestion: Object.fromEntries(modes.map((m) => [m, results[m] ?? null])),
  };

  const ran = modes.filter((m) => results[m]);
  const md = [
    `# RAG arama değerlendirmesi — ${report.at}`,
    "",
    file.ornek
      ? "> **ÖRNEK VERİ — sonuçlar ölçüm değildir, rapora ya da belgeye girmez.**\n"
      : "",
    `- Korpus sürümü: \`${index.version}\` (${index.chunks.length} parça, ${index.sources} kaynak); arama arka ucu: ${report.versions.searchBackend}`,
    `- Modeller: gömme \`${models.embeddingKey}\`, yeniden sıralayıcı \`${models.rerankerModel}:${models.rerankerRevision.slice(0, 8)}\`; gömme kapsamı ${fmt(embeddingCoverage, 2)}`,
    `- Git: \`${git.commit}\`${git.dirty ? " (çalışma ağacı kirli)" : ""}`,
    `- Girdi: \`${values.questions}\` (sürüm ${file.surum}, ${file.sorular.length} soru, sha256 \`${sha256.slice(0, 12)}\`); zamanlama tekrarı: ${repeats}`,
    `- LLM çağrısı yapılmadı; yalnızca arama ölçüldü.`,
    ...warnings.map((w) => `- Uyarı: ${w}`),
    "",
    "## Düzenek durumu",
    "",
    mdTable(
      ["Düzenek", "Durum"],
      modes.map((m) => [
        MODE_LABEL[m],
        status[m].run ? "ölçüldü" : status[m].note,
      ]),
    ),
    "",
    "## Özet",
    "",
    mdTable(
      [
        "Düzenek",
        "Soru (puanlanan)",
        "Recall@1",
        "Recall@3",
        "Recall@5",
        "MRR",
        "Yanlış kurum (kaynak)",
        "Yanlış kurum (soru)",
        "p50 ms",
        "p95 ms",
      ],
      ran.map((m) => {
        const s = summary[m]!;
        return [
          MODE_LABEL[m],
          `${s.questions} (${s.scored})`,
          fmt(s.recallAt1),
          fmt(s.recallAt3),
          fmt(s.recallAt5),
          fmt(s.mrr),
          fmt(s.wrongScopeSourceRate),
          fmt(s.wrongScopeQuestionRate),
          fmt(s.latencyMs.p50, 1),
          fmt(s.latencyMs.p95, 1),
        ];
      }),
    ),
    "",
    "Puanlanan = ilgili kaynağı tanımlı sorular (kaynaksiz ve bazı belirsiz sorular Recall/MRR dışında kalır).",
    "",
    "## Kaynaksız ve kaçınılacak kaynak",
    "",
    mdTable(
      [
        "Düzenek",
        "Kaynaksız soruda boş dönme (doğru çekimserlik)",
        "Kaçınılacak kaynağı döndürme oranı",
        "Hiç kaynak dönmeyen soru oranı",
      ],
      ran.map((m) => [
        MODE_LABEL[m],
        fmt(summary[m]!.noSourceCorrectEmptyRate),
        fmt(summary[m]!.avoidedSourceReturnRate),
        fmt(summary[m]!.emptyReturnRate),
      ]),
    ),
    "",
    ...(["recallAt3", "mrr", "wrongScopeSourceRate"] as const).flatMap(
      (metric) => [
        `## Sınıfa göre: ${{ recallAt3: "Recall@3", mrr: "MRR", wrongScopeSourceRate: "Yanlış kurum kaynağı oranı" }[metric]}`,
        "",
        mdTable(
          ["Sınıf", "Soru", ...ran.map((m) => MODE_LABEL[m])],
          CLASSES.filter((c) => classCounts[c]).map((c) => [
            c,
            classCounts[c],
            ...ran.map((m) => fmt(byClass[m]?.[c]?.[metric])),
          ]),
        ),
        "",
      ],
    ),
    "Sınıf başına soru sayısı azdır; sınıf kırılımı sayıdan çok hata türünü görmek içindir.",
    "",
  ].join("\n");
  const paths = await writeReports("eval-rag", stamp, report, md);
  console.log(md);
  console.log(`Rapor: ${paths.json} ve ${paths.markdown}`);
} finally {
  await pool.end();
}
