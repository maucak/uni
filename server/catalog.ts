import { catalogMetrics } from "./services/catalog-metrics.ts";
import { pool, transaction } from "./db.ts";
import type { Program, DataSource, YearData } from "../shared/contracts.ts";
export async function catalogVersion() {
  const r = await pool.query(
    "SELECT version FROM import_batches ORDER BY applied_at DESC LIMIT 1",
  );
  return r.rows[0]?.version || "sample-v1";
}
async function loadCatalog(): Promise<Program[]> {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const result =
      await client.query(`SELECT p.*,u.name AS university,u.city,u.university_type,y.rank,y.quota,y.year,y.source,y.source_url,y.tuition,y.currency
 FROM programs p JOIN universities u ON u.id=p.university_id
 LEFT JOIN LATERAL (SELECT * FROM program_year_data WHERE program_id=p.id ORDER BY year DESC LIMIT 1) y ON true ORDER BY p.is_sample,u.name,p.name,p.language`);
    const sources = await client.query(
      "SELECT ps.program_id,s.*,s.retrieved_at::text AS retrieval_date FROM program_sources ps JOIN data_sources s ON s.id=ps.source_id ORDER BY s.source_key",
    );
    const years = await client.query(
      "SELECT * FROM program_year_data ORDER BY year DESC",
    );
    const versionRow = await client.query(
      "SELECT version FROM import_batches ORDER BY applied_at DESC LIMIT 1",
    );
    const version = versionRow.rows[0]?.version || "sample-v1";
    const sourceMap = new Map<string, any[]>(),
      yearMap = new Map<string, any[]>();
    for (const row of sources.rows) {
      const list = sourceMap.get(row.program_id) || [];
      list.push(row);
      sourceMap.set(row.program_id, list);
    }
    for (const row of years.rows) {
      const list = yearMap.get(row.program_id) || [];
      list.push(row);
      yearMap.set(row.program_id, list);
    }
    return result.rows.map((r) => {
      const references: DataSource[] = (sourceMap.get(r.id) || []).map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        publisher: s.publisher,
        retrievedAt: s.retrieval_date,
        notes: s.notes,
      }));
      const history: YearData[] = (yearMap.get(r.id) || []).map((y) => ({
        year: y.year,
        rank: y.rank,
        quota: y.quota,
        tuition: y.tuition === null ? null : Number(y.tuition),
        currency: y.currency,
        source: y.source,
        sourceUrl: y.source_url,
      }));
      const metrics = catalogMetrics(history);
      return {
        id: r.id,
        name: r.name,
        university: r.university,
        city: r.city,
        universityType: r.university_type,
        language: r.language,
        scoreType: r.score_type,
        scholarship: r.scholarship,
        description: r.description,
        subjects: r.subjects,
        ...metrics,
        year: metrics.rankYear ?? r.year ?? null,
        isSample: r.is_sample,
        source: r.source || references[0]?.title || "Kaynak kaydı yok",
        sourceUrl: r.source_url || references[0]?.url || null,
        officialCode: r.official_code,
        scholarshipPercent:
          r.scholarship_percent === null ? null : Number(r.scholarship_percent),
        sources: references,
        history,
        catalogVersion: version,
      };
    });
  });
}

let cached: { version: string; programs: Program[] } | undefined;
let pending: Promise<Program[]> | undefined;
export async function catalog(): Promise<Program[]> {
  const version = await catalogVersion();
  if (cached && cached.version === version) return cached.programs;
  if (pending) return pending;
  pending = loadCatalog()
    .then((programs) => {
      cached = { version: programs[0]?.catalogVersion || version, programs };
      return programs;
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
