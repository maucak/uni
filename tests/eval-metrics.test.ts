import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mean,
  percentile,
  dcgAtK,
  ndcgAtK,
  precisionAtK,
  hitAtK,
  diversityRatio,
  catalogCoverage,
  missingRate,
  recallAtK,
  reciprocalRank,
  wrongScopeSources,
  pairedDifference,
} from "../scripts/eval-metrics.ts";

const close = (actual: number | null, expected: number, eps = 1e-9) =>
  assert.ok(
    actual !== null && Math.abs(actual - expected) < eps,
    `${actual} ≈ ${expected}`,
  );

test("DCG elle hesaplanmış örnek: dereceler 2,0,1", () => {
  // (2^2-1)/log2(2) + 0 + (2^1-1)/log2(4) = 3 + 0.5
  close(dcgAtK([2, 0, 1], 10), 3.5);
  close(dcgAtK([2, 0, 1], 1), 3);
});
test("nDCG: ideal sıra etiketli bütün programlardan kurulur", () => {
  // Sıra 1,2 ; etiketli: 2,1 → DCG = 1 + 3/1.585 ; ideal = 3 + 1/1.585
  const dcg = 1 + 3 / Math.log2(3);
  const ideal = 3 + 1 / Math.log2(3);
  close(ndcgAtK([1, 2], [2, 1], 10), dcg / ideal);
  // Mükemmel sıra 1.0
  close(ndcgAtK([2, 1], [2, 1], 10), 1);
  // Listede olmayan etiketli program idealde sayılır
  close(ndcgAtK([0, 0], [2], 10), 0);
});
test("nDCG: uygun etiketi yoksa tanımsız", () => {
  assert.equal(ndcgAtK([0, 0, 0], [0, 0], 10), null);
});
test("Precision@k ve Hit@k eşiği ve k paydasını kullanır", () => {
  const rels = [2, 0, 1, 2];
  close(precisionAtK(rels, 4), 0.5); // eşik 2: iki uygun / 4
  close(precisionAtK(rels, 4, 1), 0.75);
  close(precisionAtK([2], 10), 0.1); // kısa liste k'ya bölünür
  assert.equal(hitAtK([0, 1, 0], 3), 0);
  assert.equal(hitAtK([0, 1, 0], 3, 1), 1);
  assert.equal(hitAtK([0, 0, 2], 2), 0);
});
test("Kapsama ve çeşitlilik", () => {
  const lists = [
    ["a", "b", "c"],
    ["a", "b", "d"],
  ];
  const d = diversityRatio(lists);
  assert.deepEqual([d.unique, d.slots], [4, 6]);
  close(d.ratio, 4 / 6);
  close(catalogCoverage(lists, 8).ratio, 0.5);
  assert.equal(diversityRatio([]).ratio, null);
});
test("Eksik veri oranı", () => {
  close(missingRate([true, false, false, true, false]), 0.4);
  assert.equal(missingRate([]), null);
});
test("Recall@k ve MRR", () => {
  const returned = ["x", "b", "y", "a"];
  const relevant = ["a", "b"];
  close(recallAtK(returned, relevant, 1), 0);
  close(recallAtK(returned, relevant, 3), 0.5);
  close(recallAtK(returned, relevant, 5), 1);
  close(reciprocalRank(returned, relevant), 0.5);
  close(reciprocalRank(["q"], relevant), 0);
  assert.equal(recallAtK(returned, [], 3), null);
  assert.equal(reciprocalRank(returned, []), null);
});
test("Yanlış kurum: ulusal ve sorunun kurumu geçerli", () => {
  assert.equal(
    wrongScopeSources(["isubu", "national", "sdu", undefined], "isubu"),
    2,
  );
  assert.equal(wrongScopeSources(["national"], "national"), 0);
  assert.equal(wrongScopeSources(["isubu"], "national"), 1);
});
test("Yüzdelik dilim (en yakın sıra)", () => {
  const v = [15, 20, 35, 40, 50];
  assert.equal(percentile(v, 50), 35);
  assert.equal(percentile(v, 95), 50);
  assert.equal(percentile([], 50), null);
  assert.equal(mean([1, 2, 3]), 2);
});
test("Eşleştirilmiş fark: ortalama, kazanç/kayıp ve null çiftleri atlama", () => {
  const a = [0.2, 0.5, null, 0.4];
  const b = [0.5, 0.5, 0.9, 0.1];
  const r = pairedDifference(a, b);
  assert.equal(r.n, 3);
  close(r.meanDiff, (0.3 + 0 - 0.3) / 3);
  assert.deepEqual([r.wins, r.ties, r.losses], [1, 1, 1]);
  const again = pairedDifference(a, b);
  assert.deepEqual(r.ci95, again.ci95); // tohumlu, tekrarlanabilir
  assert.throws(() => pairedDifference([1], [1, 2]));
  const same = pairedDifference([1, 2, 3], [2, 3, 4]);
  close(same.meanDiff, 1);
  close(same.ci95![0], 1);
  close(same.ci95![1], 1);
});
