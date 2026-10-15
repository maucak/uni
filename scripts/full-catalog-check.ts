import assert from "node:assert/strict";
import { useLocalDatabase } from "./environment.ts";
await useLocalDatabase();
const { pool } = await import("../server/db.ts");
const base = "http://127.0.0.1:5173/api/v1";
async function get(path: string) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
  return r.json();
}
try {
  const count = await pool.query(
    "SELECT count(*)::int AS count,count(DISTINCT official_code)::int AS codes FROM programs WHERE NOT is_sample",
  );
  assert.equal(count.rows[0].count, 21493);
  assert.equal(count.rows[0].codes, 21493);
  const raw = await pool.query(
    "SELECT table_number,count(*)::int AS count FROM program_admissions GROUP BY table_number ORDER BY table_number",
  );
  assert.deepEqual(raw.rows, [
    { table_number: "3", count: 9254 },
    { table_number: "4", count: 12239 },
  ]);
  const filters = await get("/catalog/filters");
  assert.equal(filters.realCount, 21493);
  assert.equal(filters.sampleCount, 12);
  const tyt = await get("/programs?scoreType=TYT&dataKind=real&limit=1");
  assert.equal(tyt.total, 9254);
  assert.equal(tyt.items[0].scoreType, "TYT");
  const german = await get("/programs?language=Almanca&dataKind=real&limit=1");
  assert.equal(german.total, 46);
  const foreign = await get(
    "/programs?type=Yurt%20d%C4%B1%C5%9F%C4%B1&dataKind=real&limit=1",
  );
  assert.equal(foreign.total, 1356);
  const last = await get("/programs?dataKind=real&limit=24&offset=21480");
  assert.equal(last.items.length, 13);
  const selected = await pool.query(
    "SELECT id FROM programs WHERE official_code='112572418'",
  );
  const p = await get(`/programs/${selected.rows[0].id}`);
  assert.equal(p.rank, 134782);
  assert.equal(p.rankYear, 2025);
  assert.equal(p.quotaYear, 2026);
  assert.equal(p.history.length, 4);
  assert.equal(p.admissionData.table, "4");
  assert.equal(Object.keys(p.admissionData.columns).length, 24);
  const community = await get(`/communities?programId=${p.id}`);
  assert.equal(community.length, 1);
  const search = await get("/communities?search=Hacettepe&limit=12");
  assert(search.length > 0);
  assert(search.every((c: any) => c.name.includes("Hacettepe")));
  console.log(
    JSON.stringify({
      result: "PASS",
      programs: 21493,
      associate: 9254,
      undergraduate: 12239,
      foreign: 1356,
      uniqueCodes: true,
      rawColumns: true,
      existingHistory: true,
      pagination: true,
      serverCommunitySearch: true,
    }),
  );
} finally {
  await pool.end();
}
