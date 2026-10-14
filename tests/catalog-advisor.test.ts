import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateManifest } from "../server/services/catalog-import.ts";
import { filterPrograms } from "../server/services/search.ts";
import {
  searchStateSchema,
  defaultProfile,
  type Program,
} from "../shared/contracts.ts";
import { validateAdvisorPlan, applyChanges } from "../shared/advisor.ts";
import { recommend } from "../server/services/recommendation.ts";
const record: Program = {
  id: "27d445e2-3745-40de-a07b-3b1c7d4b72be",
  name: "Test Program",
  university: "Test",
  city: "Isparta",
  universityType: "Devlet",
  language: "Türkçe",
  scoreType: "SAY",
  scholarship: "Bilinmiyor",
  description: "Yazılım programlama",
  subjects: ["Yazılım"],
  rank: 134782,
  quota: 65,
  year: 2025,
  isSample: false,
  source: "Test",
  sourceUrl: null,
  tuition: null,
  scholarshipPercent: null,
};
const state = searchStateSchema.parse({});
test("Pilot manifest doğrulanır; sahte veya eksik kaynak reddedilir", async () => {
  const raw = JSON.parse(
    await readFile(
      new URL("../data/pilot-isubu-2026-10.json", import.meta.url),
      "utf8",
    ),
  );
  assert(validateManifest(raw).manifest);
  raw.programs[0].years[0].sourceKey = "not-a-source";
  assert.equal(validateManifest(raw).manifest, null);
});
test("Bilinen sıra bandı kesin elenir, bilinmeyen değer kullanıcı kontrolündedir", () => {
  const unknown = { ...record, id: "b", rank: null };
  assert.equal(
    filterPrograms([record, unknown], { ...state, rankMax: 130000 }).length,
    1,
  );
  assert.equal(
    filterPrograms([record, unknown], {
      ...state,
      rankMax: 130000,
      includeUnknown: false,
    }).length,
    0,
  );
});
test("Ücret yokluğu ücretsiz değildir; sıfır gerçek ücret ise geçerlidir", () => {
  const free = { ...record, id: "b", tuition: 0 };
  assert.equal(
    filterPrograms([record, free], {
      ...state,
      maxTuition: 0,
      includeUnknown: false,
    }).length,
    1,
  );
});
test("Eksik bütçe bilgisi öneri kapsamını azaltır", () => {
  const profile = {
    ...defaultProfile,
    interests: "yazılım",
    maxAnnualTuition: 100000,
    weights: { interest: 3, city: 0, language: 0, budget: 3 },
  };
  const result = recommend([record], profile)[0];
  assert.equal(result.coverage, 0.5);
  assert(
    result.components?.some(
      (c) => c.name === "Öğrenim ücreti" && c.value === null,
    ),
  );
});
test("Danışman yalnızca izinli alan ve katalogdaki program kimliği kullanır", () => {
  const plan = {
    summary: "Dil filtresini değiştirebiliriz.",
    questions: [],
    changes: [{ field: "language", value: "İngilizce" }],
    programIds: [record.id],
  };
  const v = validateAdvisorPlan(plan, state, [record]);
  assert.equal(v.proposedState?.language, "İngilizce");
  assert.equal(state.language, "");
  assert.throws(() =>
    validateAdvisorPlan(
      { ...plan, programIds: ["afddc9df-b7c4-4d1b-8d48-542b12d6fa4a"] },
      state,
      [record],
    ),
  );
  assert.throws(() =>
    validateAdvisorPlan(
      { ...plan, changes: [{ field: "role", value: "admin" }] },
      state,
      [record],
    ),
  );
});
test("Danışman çelişkili, ters aralık veya negatif ücret öneremez", () => {
  const base = { summary: "", questions: [], programIds: [] };
  assert.throws(() =>
    applyChanges(state, {
      ...base,
      changes: [
        { field: "rankMin", value: "200000" },
        { field: "rankMax", value: "100000" },
      ],
    }),
  );
  assert.throws(() =>
    applyChanges(state, {
      ...base,
      changes: [{ field: "maxTuition", value: "-1" }],
    }),
  );
  assert.throws(() =>
    applyChanges(state, {
      ...base,
      changes: [
        { field: "city", value: "Isparta" },
        { field: "city", value: "Ankara" },
      ],
    }),
  );
});
