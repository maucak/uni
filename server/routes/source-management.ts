import { Router } from "express";
import { z } from "zod";
import { requireUser } from "../auth.ts";
import { pool } from "../db.ts";
import { fail } from "../errors.ts";
import {
  registerSources,
  enqueueSource,
  sourceManagerAllowed,
} from "../services/source-updates.ts";
import { sourceById } from "../../shared/source-registry.ts";
const routes = Router();
routes.get("/source-management/access", (_req, res) =>
  res.json({ allowed: sourceManagerAllowed(res.locals.user?.email) }),
);
routes.use("/source-management", requireUser, (_req, res, next) => {
  if (!sourceManagerAllowed(res.locals.user?.email))
    return res
      .status(403)
      .json({
        code: "FORBIDDEN",
        message: "Kaynak yönetimi için yetkin bulunmuyor.",
      });
  next();
});
routes.get("/source-management", async (_req, res) => {
  await registerSources();
  const rows =
    await pool.query(`SELECT s.*,j.state AS job_state,j.phase AS job_phase,j.attempts,j.run_after,
    j.changed AS last_result_changed,j.finished_at AS last_finished_at,
    COALESCE((SELECT count(*)::int FROM rag_documents d JOIN rag_sources r ON d.source_id=r.id AND d.version_id=r.active_version_id WHERE r.url=s.url AND r.enabled),0) AS documents
    FROM source_schedules s LEFT JOIN LATERAL (SELECT * FROM source_update_jobs WHERE source_id=s.id ORDER BY created_at DESC LIMIT 1) j ON true ORDER BY s.scope,s.title`);
  const worker = await pool.query(
    "SELECT heartbeat_at,heartbeat_at>now()-interval '10 minutes' AS online FROM source_worker_state WHERE id=true",
  );
  res.json({
    items: rows.rows,
    worker: worker.rows[0] || { online: false, heartbeat_at: null },
  });
});
routes.post("/source-management/:id/check", async (req, res) => {
  if (!sourceById(req.params.id)) fail(404, "NOT_FOUND", "Kaynak bulunamadı.");
  await registerSources();
  const queued = await enqueueSource(req.params.id);
  res
    .status(202)
    .json({
      queued,
      message: queued
        ? "Kontrol sıraya alındı."
        : "Bu kaynak için zaten bekleyen bir kontrol var.",
    });
});
const scheduleSchema = z
  .object({
    intervalDays: z.number().int().min(1).max(90),
    enabled: z.boolean(),
    campaignStart: z.iso.date().nullable(),
    campaignEnd: z.iso.date().nullable(),
  })
  .refine(
    (v) =>
      (v.campaignStart === null && v.campaignEnd === null) ||
      (v.campaignStart !== null &&
        v.campaignEnd !== null &&
        v.campaignEnd >= v.campaignStart),
    {
      message: "Başlangıç ve bitiş tarihlerini birlikte, doğru sırada belirt.",
    },
  );
routes.put("/source-management/:id/schedule", async (req, res) => {
  if (!sourceById(req.params.id)) fail(404, "NOT_FOUND", "Kaynak bulunamadı.");
  const v = scheduleSchema.parse(req.body);
  await pool.query(
    `UPDATE source_schedules SET interval_days=$2::integer,enabled=$3,campaign_start=$4,campaign_end=$5,
    next_check_at=LEAST(next_check_at,now()+CASE WHEN (now() AT TIME ZONE 'Europe/Istanbul')::date BETWEEN $4::date AND $5::date THEN interval '1 day' ELSE $2::integer*interval '1 day' END,CASE WHEN $4::date>(now() AT TIME ZONE 'Europe/Istanbul')::date THEN $4::date::timestamp AT TIME ZONE 'Europe/Istanbul' ELSE 'infinity'::timestamptz END),updated_at=now() WHERE id=$1`,
    [req.params.id, v.intervalDays, v.enabled, v.campaignStart, v.campaignEnd],
  );
  res.json({ ok: true });
});
export default routes;
