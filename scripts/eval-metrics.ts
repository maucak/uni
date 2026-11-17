// Değerlendirme metrikleri: saf fonksiyonlar (veritabanı, dosya ve saat yok).
// Elle hesaplanmış örneklerle tests/eval-metrics.test.ts içinde sınanır.

export function mean(values: number[]): number | null {
  return values.length
    ? values.reduce((s, v) => s + v, 0) / values.length
    : null;
}
export function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  return Math.sqrt(
    values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1),
  );
}
// En yakın sıra (nearest-rank) yöntemi: p yüzdelik dilimi, 0 < p <= 100.
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1];
}

// ---- Öneri metrikleri. Girdi: listedeki sıraya göre uygunluk dereceleri (0,1,2,...).
export const gain = (rel: number) => 2 ** rel - 1;
export function dcgAtK(rels: number[], k: number) {
  return rels
    .slice(0, k)
    .reduce((s, rel, i) => s + gain(rel) / Math.log2(i + 2), 0);
}
// İdeal sıra, o profil için etiketlenmiş bütün programların derecelerinden kurulur.
// Hiç uygun etiketi olmayan profilde nDCG tanımsızdır (null) ve ortalamaya girmez.
export function ndcgAtK(
  rankedRels: number[],
  judgedRels: number[],
  k: number,
): number | null {
  const ideal = dcgAtK(
    [...judgedRels].sort((a, b) => b - a),
    k,
  );
  return ideal > 0 ? dcgAtK(rankedRels, k) / ideal : null;
}
// Payda her zaman k'dır; liste k'dan kısaysa eksik yerler uygunsuz sayılır.
export function precisionAtK(rankedRels: number[], k: number, threshold = 2) {
  return rankedRels.slice(0, k).filter((r) => r >= threshold).length / k;
}
export function hitAtK(rankedRels: number[], k: number, threshold = 2) {
  return rankedRels.slice(0, k).some((r) => r >= threshold) ? 1 : 0;
}
// Kapsama: önerilen benzersiz program sayısı / önerilen toplam yuva sayısı.
export function diversityRatio(lists: string[][]) {
  const slots = lists.reduce((s, l) => s + l.length, 0);
  const unique = new Set(lists.flat()).size;
  return { unique, slots, ratio: slots ? unique / slots : null };
}
// Katalog kapsaması: önerilen benzersiz program / katalogdaki aday program sayısı.
export function catalogCoverage(lists: string[][], catalogSize: number) {
  const unique = new Set(lists.flat()).size;
  return {
    unique,
    catalogSize,
    ratio: catalogSize ? unique / catalogSize : null,
  };
}
export function missingRate(flags: boolean[]) {
  return flags.length ? flags.filter(Boolean).length / flags.length : null;
}

// ---- Arama (RAG) metrikleri. Girdi: dönen kaynak kimlikleri (sıralı) ve ilgili kimlikler.
// Recall@k: ilgili kaynakların kaçı ilk k içinde döndü. İlgili kaynak yoksa null.
export function recallAtK(
  returned: string[],
  relevant: string[],
  k: number,
): number | null {
  const wanted = new Set(relevant);
  if (!wanted.size) return null;
  const top = new Set(returned.slice(0, k));
  return [...wanted].filter((id) => top.has(id)).length / wanted.size;
}
export function reciprocalRank(
  returned: string[],
  relevant: string[],
): number | null {
  const wanted = new Set(relevant);
  if (!wanted.size) return null;
  const i = returned.findIndex((id) => wanted.has(id));
  return i < 0 ? 0 : 1 / (i + 1);
}
// Dönen kaynağın scope değeri ulusal ya da sorunun kurumu değilse yanlış kurumdur.
export function wrongScopeSources(
  returnedScopes: (string | undefined)[],
  questionScope: string,
) {
  return returnedScopes.filter((s) => s !== "national" && s !== questionScope)
    .length;
}

// ---- Eşleştirilmiş fark (B - A). Boş (null) çiftler atlanır.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type PairedDifference = {
  n: number;
  meanA: number | null;
  meanB: number | null;
  meanDiff: number | null;
  sd: number | null;
  wins: number;
  losses: number;
  ties: number;
  ci95: [number, number] | null;
};
export function pairedDifference(
  a: (number | null)[],
  b: (number | null)[],
  options: { resamples?: number; seed?: number } = {},
): PairedDifference {
  if (a.length !== b.length)
    throw new Error(
      "Eşleştirilmiş fark için iki dizinin uzunluğu eşit olmalı.",
    );
  const pairs: [number, number][] = [];
  for (let i = 0; i < a.length; i++)
    if (a[i] !== null && b[i] !== null) pairs.push([a[i]!, b[i]!]);
  const diffs = pairs.map(([x, y]) => y - x);
  const eps = 1e-12;
  let ci95: [number, number] | null = null;
  if (diffs.length >= 2) {
    const random = mulberry32(options.seed ?? 20261217);
    const means: number[] = [];
    for (let r = 0; r < (options.resamples ?? 2000); r++) {
      let sum = 0;
      for (let i = 0; i < diffs.length; i++)
        sum += diffs[Math.floor(random() * diffs.length)];
      means.push(sum / diffs.length);
    }
    ci95 = [percentile(means, 2.5)!, percentile(means, 97.5)!];
  }
  return {
    n: pairs.length,
    meanA: mean(pairs.map((p) => p[0])),
    meanB: mean(pairs.map((p) => p[1])),
    meanDiff: mean(diffs),
    sd: stdev(diffs),
    wins: diffs.filter((d) => d > eps).length,
    losses: diffs.filter((d) => d < -eps).length,
    ties: diffs.filter((d) => Math.abs(d) <= eps).length,
    ci95,
  };
}
