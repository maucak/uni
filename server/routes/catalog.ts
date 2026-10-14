import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool } from "../db.ts";
import { requireUser } from "../auth.ts";
import { fail } from "../errors.ts";
import { catalog, catalogVersion } from "../catalog.ts";
import { searchFromParams } from "../../shared/search.ts";
import { filterPrograms, sortPrograms } from "../services/search.ts";
import { recommend, algorithmVersion } from "../services/recommendation.ts";
const api = Router();
api.get("/programs", async (req, res) => {
  const state = searchFromParams(
    new URLSearchParams(req.query as Record<string, string>),
  );
  const { limit, offset } = z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(24),
      offset: z.coerce.number().int().min(0).max(100000).default(0),
    })
    .parse(req.query);
  const programs = await catalog();
  const filtered = filterPrograms(programs, state);
  const corpus = programs.filter(
    (p) =>
      state.dataKind === "all" ||
      (state.dataKind === "real" ? !p.isSample : p.isSample),
  );
  const ordered =
    state.sort === "fit" && res.locals.user
      ? recommend(
          filtered,
          {
            ...res.locals.user.profile,
            scoreType: state.scoreType || res.locals.user.profile.scoreType,
          },
          corpus,
        ).map((r) => r.program)
      : sortPrograms(filtered, state.sort);
  res.json({
    items: ordered.slice(offset, offset + limit),
    total: ordered.length,
    catalogVersion: programs[0]?.catalogVersion || (await catalogVersion()),
    unknownCount: ordered.filter((p) => p.rank === null || p.tuition == null)
      .length,
  });
});
api.get("/catalog/filters", async (_req, res) => {
  const p = await catalog();
  res.json({
    cities: [...new Set(p.map((p) => p.city))].sort(),
    count: p.length,
    sampleCount: p.filter((p) => p.isSample).length,
    realCount: p.filter((p) => !p.isSample).length,
    catalogVersion: p[0]?.catalogVersion || (await catalogVersion()),
  });
});
api.get("/catalog/sources", async (_req, res) => {
  const sources = await pool.query(
    "SELECT id,title,url,publisher,retrieved_at::text AS retrieved_at,notes FROM data_sources ORDER BY retrieved_at DESC,title",
  );
  const batches = await pool.query(
    "SELECT version,record_count,applied_at FROM import_batches ORDER BY applied_at DESC",
  );
  res.json({ sources: sources.rows, batches: batches.rows });
});
api.get("/programs/:id", async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const program = (await catalog()).find((p) => p.id === id);
  if (!program) fail(404, "NOT_FOUND", "Program bulunamadı.");
  res.json(program);
});
api.post("/recommendations", requireUser, async (req, res) => {
  const state = searchFromParams(
    new URLSearchParams(
      z.record(z.string(), z.string()).parse(req.body?.filters || {}),
    ),
  );
  const input = res.locals.user.profile;
  const programs = await catalog();
  const candidates = filterPrograms(programs, state);
  const corpus = programs.filter(
    (p) =>
      state.dataKind === "all" ||
      (state.dataKind === "real" ? !p.isSample : p.isSample),
  );
  const results = recommend(candidates, input, corpus);
  const version = programs[0]?.catalogVersion || (await catalogVersion());
  const id = randomUUID();
  await pool.query(
    "INSERT INTO recommendation_runs(id,user_id,algorithm_version,catalog_version,input,results) VALUES($1,$2,$3,$4,$5,$6)",
    [
      id,
      res.locals.user.id,
      algorithmVersion,
      version,
      JSON.stringify({ profile: input, filters: state }),
      JSON.stringify(
        results.map((r) => ({
          id: r.program.id,
          score: r.score,
          coverage: r.coverage,
        })),
      ),
    ],
  );
  res.json({ id, algorithmVersion, catalogVersion: version, items: results });
});
api.post("/recommendations/:id/feedback", requireUser, async (req, res) => {
  const runId = z.uuid().parse(req.params.id);
  const data = z
    .object({
      programId: z.uuid(),
      rating: z.number().int().min(1).max(5),
      note: z.string().max(1000).default(""),
    })
    .parse(req.body);
  const run = await pool.query(
    "SELECT results FROM recommendation_runs WHERE id=$1 AND user_id=$2",
    [runId, res.locals.user.id],
  );
  if (
    !run.rowCount ||
    !run.rows[0].results.some((r: any) => r.id === data.programId)
  )
    fail(404, "NOT_FOUND", "Öneri kaydı bulunamadı.");
  await pool.query(
    "INSERT INTO recommendation_feedback(user_id,run_id,program_id,rating,note) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,run_id,program_id) DO UPDATE SET rating=excluded.rating,note=excluded.note",
    [res.locals.user.id, runId, data.programId, data.rating, data.note],
  );
  res.json({ ok: true });
});
export default api;
