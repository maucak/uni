import test from "node:test";
import assert from "node:assert/strict";
import { catalogMetrics } from "../server/services/catalog-metrics.ts";
const row = (
  year: number,
  rank: number | null,
  quota: number | null,
  tuition: number | null = null,
) => ({
  year,
  rank,
  quota,
  tuition,
  currency: null,
  source: "ÖSYM",
  sourceUrl: null,
});
test("2026 kontenjanı 2025 sırasını silmez ve yılını değiştirmez", () => {
  assert.deepEqual(
    catalogMetrics([row(2026, null, 80), row(2025, 53079, null)]),
    {
      rank: 53079,
      rankYear: 2025,
      quota: 80,
      quotaYear: 2026,
      tuition: null,
      feeYear: null,
    },
  );
});
test("gerçek sıfır kontenjan ve ücret eksik sayılmaz", () => {
  const result = catalogMetrics([row(2026, null, 0, 0)]);
  assert.equal(result.quota, 0);
  assert.equal(result.tuition, 0);
  assert.equal(result.rank, null);
});
test("girdi sırası değişse de en yeni bilinen ölçüt seçilir", () => {
  assert.deepEqual(
    catalogMetrics([row(2023, 80000, 60), row(2025, 100000, 70)]),
    catalogMetrics([row(2025, 100000, 70), row(2023, 80000, 60)]),
  );
});
