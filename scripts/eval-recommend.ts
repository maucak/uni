// Öneri değerlendirmesi (issue #4): aynı profil, aynı katalog, aynı liste uzunluğu;
// kişiselleştirilmiş yöntem ile temel yöntem (filtre + başarı sırası) karşılaştırılır.
// Profil ve etiketleri ekip yazar: data/eval/profiller.json (şema: docs/degerlendirme.md).
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
  catalogCoverage,
  diversityRatio,
  hitAtK,
  mean,
  missingRate,
  ndcgAtK,
  pairedDifference,
  precisionAtK,
} from "./eval-metrics.ts";
import { defaultProfile, profileSchema } from "../shared/contracts.ts";
import type { Program, Profile } from "../shared/contracts.ts";

const K = 10;
const DEFAULT_FILE = "data/eval/profiller.json";
const EXAMPLE_FILE = "data/eval/profiller.ornek.json";

const fileSchema = z.object({
  surum: z.string().min(1),
  aciklama: z.string().optional(),
  ornek: z.boolean().optional(),
  profiller: z
    .array(
      z.object({
        id: z.string().min(1),
        profil: z.record(z.string(), z.unknown()),
        // /api/recommendations ile aynı süzgeç parametreleri (rankMin, rankMax, city, ...).
        filtre: z.record(z.string(), z.string()).default({}),
        // ÖSYM program kodu (yoksa program kimliği) -> 0 uygun değil, 1 kısmen, 2 uygun, 3 çok uygun.
        etiketler: z.record(z.string(), z.number().int().min(0).max(3)),
      }),
    )
    .min(1),
});

const { values } = parseArgs({
  options: {
    profiles: { type: "string", default: DEFAULT_FILE },
    threshold: { type: "string", default: "2" },
    "allow-example": { type: "boolean", default: false },
  },
});
const threshold = Number(values.threshold);
if (![1, 2, 3].includes(threshold)) {
  console.error("--threshold 1, 2 veya 3 olmalı.");
  process.exit(2);
}

function fail(message: string): never {
  console.error(`HATA: ${message}`);
  process.exit(1);
}

let file: z.infer<typeof fileSchema>, sha256: string;
try {
  const read = await readEvalFile(
    values.profiles!,
    "Aday profili ve uygunluk etiketi",
    EXAMPLE_FILE,
  );
  const parsed = fileSchema.safeParse(read.data);
  if (!parsed.success)
    throw new EvalError(
      `${values.profiles} şemaya uymuyor:\n${z.prettifyError(parsed.error)}`,
    );
  file = parsed.data;
  sha256 = read.sha256;
  if (file.ornek && !values["allow-example"])
    throw new EvalError(
      `${values.profiles} bir ÖRNEK şablondur ve ölçümde kullanılmaz. ` +
        `Yalnızca script'i denemek için --allow-example verin; rapor "geçersiz" işaretlenir.`,
    );
} catch (e) {
  if (e instanceof EvalError) fail(e.message);
  throw e;
}

await useLocalDatabase();
const { pool } = await import("../server/db.ts");
try {
  const { catalog } = await import("../server/catalog.ts");
  const { filterPrograms } = await import("../server/services/search.ts");
  const { searchFromParams } = await import("../shared/search.ts");
  const rec = await import("../server/services/recommendation.ts");

  const programs = await catalog();
  const catalogVersion = programs[0]?.catalogVersion ?? "bilinmiyor";
  const byCode = new Map<string, Program[]>();
  const byId = new Map(programs.map((p) => [p.id, p]));
  for (const p of programs)
    if (p.officialCode)
      byCode.set(p.officialCode, [...(byCode.get(p.officialCode) ?? []), p]);

  // Etiket anahtarlarını denetle: yazım hatası sessizce metriği düşürmesin.
  const unknownLabels: { profile: string; key: string }[] = [];
  for (const item of file.profiller)
    for (const key of Object.keys(item.etiketler))
      if (!byCode.has(key) && !byId.has(key))
        unknownLabels.push({ profile: item.id, key });
  if (unknownLabels.length && !file.ornek)
    fail(
      `Katalogda bulunamayan etiket anahtarları (${unknownLabels.length}):\n` +
        unknownLabels
          .slice(0, 20)
          .map((u) => `  ${u.profile}: ${u.key}`)
          .join("\n") +
        `\nKatalog sürümü: ${catalogVersion}. Etiketlerde ÖSYM program kodu kullanın.`,
    );

  type MethodResult = {
    ndcg10: number | null;
    precision10: number;
    hit10: number;
    missingDataRate: number | null;
    unlabeledInTop10: number;
    returned: number;
    top10: string[];
  };
  const perProfile: {
    id: string;
    candidates: number;
    judged: number;
    relevantLabels: number;
    personalized: MethodResult;
    baseline: MethodResult;
  }[] = [];

  for (const item of file.profiller) {
    const profile: Profile = profileSchema.parse({
      ...defaultProfile,
      displayName: item.id.length >= 2 ? item.id : `${item.id}-profil`,
      ...item.profil,
      weights: {
        ...defaultProfile.weights,
        ...(item.profil.weights as object | undefined),
      },
    });
    const state = searchFromParams(new URLSearchParams(item.filtre));
    const candidates = filterPrograms(programs, state);
    const corpus = programs.filter(
      (p) =>
        state.dataKind === "all" ||
        (state.dataKind === "real" ? !p.isSample : p.isSample),
    );
    const grade = (p: Program) =>
      item.etiketler[p.officialCode ?? ""] ?? item.etiketler[p.id];
    const judgedRels = Object.values(item.etiketler);
    const evaluate = (list: { program: Program }[]): MethodResult => {
      const top = list.slice(0, K).map((r) => r.program);
      const rels = top.map((p) => grade(p) ?? 0);
      const missing = top.map(
        (p) =>
          p.rank === null ||
          (profile.maxAnnualTuition != null && p.tuition == null) ||
          (profile.minimumScholarship != null && p.scholarshipPercent == null),
      );
      return {
        ndcg10: ndcgAtK(rels, judgedRels, K),
        precision10: precisionAtK(rels, K, threshold),
        hit10: hitAtK(rels, K, threshold),
        missingDataRate: missingRate(missing),
        unlabeledInTop10: top.filter((p) => grade(p) === undefined).length,
        returned: list.length,
        top10: top.map((p) => p.officialCode ?? p.id),
      };
    };
    perProfile.push({
      id: item.id,
      candidates: candidates.length,
      judged: judgedRels.length,
      relevantLabels: judgedRels.filter((r) => r >= threshold).length,
      personalized: evaluate(rec.recommend(candidates, profile, corpus)),
      baseline: evaluate(rec.baselineRecommend(candidates, profile)),
    });
  }

  const methods = ["personalized", "baseline"] as const;
  const pick = (m: (typeof methods)[number], key: keyof MethodResult) =>
    perProfile.map((p) => p[m][key] as number | null);
  const average = (m: (typeof methods)[number]) => ({
    ndcg10: mean(pick(m, "ndcg10").filter((v): v is number => v !== null)),
    precision10: mean(pick(m, "precision10") as number[]),
    hit10: mean(pick(m, "hit10") as number[]),
    missingDataRate: mean(
      pick(m, "missingDataRate").filter((v): v is number => v !== null),
    ),
    unlabeledInTop10: mean(pick(m, "unlabeledInTop10") as number[]),
    diversity: diversityRatio(perProfile.map((p) => p[m].top10)),
    catalogCoverage: catalogCoverage(
      perProfile.map((p) => p[m].top10),
      programs.length,
    ),
  });
  const averages = {
    personalized: average("personalized"),
    baseline: average("baseline"),
  };
  const metricNames = [
    "ndcg10",
    "precision10",
    "hit10",
    "missingDataRate",
  ] as const;
  const paired = Object.fromEntries(
    metricNames.map((name) => [
      name,
      pairedDifference(pick("baseline", name), pick("personalized", name)),
    ]),
  );
  const profilesWithoutRelevant = perProfile
    .filter((p) => p.personalized.ndcg10 === null)
    .map((p) => p.id);

  const git = gitInfo();
  const stamp = timestamp();
  const report = {
    kind: "eval-recommend",
    at: new Date().toISOString(),
    valid: !file.ornek,
    warnings: [
      ...(file.ornek
        ? ["ÖRNEK şablon kullanıldı; sonuçlar ölçüm değildir."]
        : []),
      ...(unknownLabels.length
        ? [`${unknownLabels.length} etiket anahtarı katalogda bulunamadı.`]
        : []),
      ...(profilesWithoutRelevant.length
        ? [
            `nDCG tanımsız (uygun etiketi yok), ortalamaya girmedi: ${profilesWithoutRelevant.join(", ")}`,
          ]
        : []),
    ],
    versions: {
      catalogVersion,
      catalogSize: programs.length,
      personalized: rec.algorithmVersion,
      baseline: rec.baselineAlgorithmVersion,
      gitCommit: git.commit,
      gitDirty: git.dirty,
      node: process.version,
    },
    input: {
      file: values.profiles,
      sha256,
      fileVersion: file.surum,
      profiles: file.profiller.length,
      k: K,
      relevanceThreshold: threshold,
    },
    averages,
    pairedDifference: {
      direction: "kişiselleştirilmiş - temel",
      ...paired,
    },
    perProfile,
  };

  const rows = (m: (typeof methods)[number]) => [
    fmt(averages[m].ndcg10),
    fmt(averages[m].precision10),
    fmt(averages[m].hit10),
    fmt(averages[m].diversity.ratio),
    fmt(averages[m].missingDataRate),
  ];
  const md = [
    `# Öneri değerlendirmesi — ${report.at}`,
    "",
    file.ornek
      ? "> **ÖRNEK VERİ — sonuçlar ölçüm değildir, rapora ya da belgeye girmez.**\n"
      : "",
    `- Katalog sürümü: \`${catalogVersion}\` (${programs.length} program)`,
    `- Algoritmalar: kişiselleştirilmiş \`${rec.algorithmVersion}\`, temel \`${rec.baselineAlgorithmVersion}\``,
    `- Git: \`${git.commit}\`${git.dirty ? " (çalışma ağacı kirli)" : ""}`,
    `- Girdi: \`${values.profiles}\` (sürüm ${file.surum}, ${file.profiller.length} profil, sha256 \`${sha256.slice(0, 12)}\`)`,
    `- Liste uzunluğu k=${K}; uygun sayılma eşiği ≥ ${threshold}`,
    ...report.warnings.map((w) => `- Uyarı: ${w}`),
    "",
    "## Ortalamalar",
    "",
    mdTable(
      [
        "Yöntem",
        "nDCG@10",
        "Precision@10",
        "Hit@10",
        "Kapsama (benzersiz/yuva)",
        "Eksik veri oranı",
      ],
      [
        ["Kişiselleştirilmiş", ...rows("personalized")],
        ["Temel", ...rows("baseline")],
      ],
    ),
    "",
    `Katalog kapsaması (benzersiz önerilen / katalog): kişiselleştirilmiş ${fmt(averages.personalized.catalogCoverage.ratio, 5)}, temel ${fmt(averages.baseline.catalogCoverage.ratio, 5)}.`,
    "",
    "## Eşleştirilmiş fark (kişiselleştirilmiş − temel)",
    "",
    mdTable(
      ["Metrik", "n", "Ort. fark", "SS", "%95 GA (bootstrap)", "K / T / E"],
      metricNames.map((name) => {
        const p = paired[name];
        return [
          name,
          p.n,
          fmt(p.meanDiff),
          fmt(p.sd),
          p.ci95 ? `[${fmt(p.ci95[0])}, ${fmt(p.ci95[1])}]` : "–",
          `${p.wins} / ${p.losses} / ${p.ties}`,
        ];
      }),
    ),
    "",
    "K = kişiselleştirilmiş daha iyi, T = temel daha iyi, E = eşit. Küçük n için GA yol göstericidir; anlamlılık testi yerine geçmez.",
    "",
    "## Profil başına",
    "",
    mdTable(
      [
        "Profil",
        "Aday",
        "Etiket",
        "nDCG K",
        "nDCG T",
        "P@10 K",
        "P@10 T",
        "Hit K",
        "Hit T",
        "Etiketsiz K/T (ilk 10)",
      ],
      perProfile.map((p) => [
        p.id,
        p.candidates,
        p.judged,
        fmt(p.personalized.ndcg10),
        fmt(p.baseline.ndcg10),
        fmt(p.personalized.precision10),
        fmt(p.baseline.precision10),
        p.personalized.hit10,
        p.baseline.hit10,
        `${p.personalized.unlabeledInTop10}/${p.baseline.unlabeledInTop10}`,
      ]),
    ),
    "",
    "Etiketsiz = ilk 10'da uygunluk etiketi olmayan program (0 uygun değil sayılır). Çok yüksekse etiket havuzu, listeyi yargılamak için yetersizdir.",
    "",
  ].join("\n");
  const paths = await writeReports("eval-recommend", stamp, report, md);
  console.log(md);
  console.log(`Rapor: ${paths.json} ve ${paths.markdown}`);
} finally {
  await pool.end();
}
