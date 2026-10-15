import type { YearData } from "../../shared/contracts.ts";
export function catalogMetrics(history: YearData[]) {
  const sorted = [...history].sort((a, b) => b.year - a.year);
  const rank = sorted.find((y) => y.rank !== null);
  const quota = sorted.find((y) => y.quota !== null);
  const fee = sorted.find((y) => y.tuition !== null);
  return {
    rank: rank?.rank ?? null,
    rankYear: rank?.year ?? null,
    quota: quota?.quota ?? null,
    quotaYear: quota?.year ?? null,
    tuition: fee?.tuition ?? null,
    feeYear: fee?.year ?? null,
  };
}
