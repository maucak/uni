import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recommend,
  cosine,
  tokenize,
} from "../server/services/recommendation.ts";
import { defaultProfile, type Program } from "../shared/contracts.ts";
const program = (id: string, changes: Partial<Program> = {}): Program => ({
  id,
  name: "Bilgisayar Mühendisliği",
  university: "Test Üniversitesi",
  city: "Ankara",
  universityType: "Devlet",
  language: "Türkçe",
  scoreType: "SAY",
  scholarship: "Ücretsiz",
  description: "Yazılım algoritma programlama",
  subjects: ["Yazılım"],
  rank: 60000,
  quota: 60,
  year: 2025,
  isSample: true,
  source: "Test",
  sourceUrl: null,
  ...changes,
});
test("Kosinüs boş vektörlerde NaN üretmez", () => {
  assert.equal(cosine(new Map(), new Map([["a", 1]])), 0);
  assert.equal(cosine(new Map([["a", 1]]), new Map([["a", 2]])), 1);
});
test("Türkçe büyük harfler ve stop words normalize edilir", () => {
  assert.deepEqual(tokenize("YAZILIM ve İLGİ"), ["yazılım", "ilgi"]);
});
test("Puan türü kesin filtre, şehir ise sıralama önceliğidir", () => {
  const p = {
    ...defaultProfile,
    interests: "yazılım",
    cities: ["İzmir"],
    weights: { interest: 1, city: 5, language: 0, budget: 0 },
  };
  const r = recommend(
    [
      program("a"),
      program("b", { city: "İzmir" }),
      program("c", { scoreType: "EA" }),
    ],
    p,
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].program.id, "b");
  assert(r.some((r) => r.program.id === "a"));
});
test("Öncelikler değiştiğinde öneriler değişir", () => {
  const programs = [
    program("a", { language: "Türkçe", city: "İzmir" }),
    program("b", { language: "İngilizce", city: "Ankara" }),
  ];
  const p = {
    ...defaultProfile,
    language: "İngilizce" as const,
    cities: ["İzmir"],
    weights: { interest: 0, city: 5, language: 1, budget: 0 },
  };
  assert.equal(recommend(programs, p)[0].program.id, "a");
  assert.equal(
    recommend(programs, {
      ...p,
      weights: { interest: 0, city: 1, language: 5, budget: 0 },
    })[0].program.id,
    "b",
  );
});
test("İlgi metni yokken yüksek uyum uydurulmaz", () => {
  const r = recommend([program("a")], defaultProfile)[0];
  assert.equal(r.score, null);
  assert.equal(r.coverage, 0);
  assert(r.missing.some((m) => m.includes("İlgi")));
});
test("Üniversite türü filtresi ve deterministik eşitlik", () => {
  const p = { ...defaultProfile, universityType: "Devlet" as const };
  assert.deepEqual(
    recommend(
      [program("b"), program("a"), program("c", { universityType: "Vakıf" })],
      p,
    ).map((r) => r.program.id),
    ["a", "b"],
  );
});
test("Yerleşme sırası kişisel uyum puanını değiştirmez", () => {
  const programs = [
    program("a", { rank: 1000 }),
    program("b", { rank: 900000 }),
  ];
  const p = { ...defaultProfile, interests: "yazılım" };
  const a = recommend(programs, { ...p, rank: 2000 });
  const b = recommend(programs, { ...p, rank: 800000 });
  assert.deepEqual(
    a.map((r) => r.score),
    b.map((r) => r.score),
  );
});
test("Eksik ilgi verisi kapsamı azaltır ve olumlu eşleşmeye dönüşmez", () => {
  const p = {
    ...defaultProfile,
    cities: ["Ankara"],
    weights: { interest: 5, city: 5, language: 0, budget: 0 },
  };
  const r = recommend([program("a")], p)[0];
  assert.equal(r.coverage, 0.5);
  assert.equal(r.score, 50);
});
