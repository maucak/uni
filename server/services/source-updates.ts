import { randomUUID } from "node:crypto";
import { pool, transaction } from "../db.ts";
import { managedSources, sourceById } from "../../shared/source-registry.ts";

export async function registerSources() {
  for (const source of managedSources)
    await pool.query(
      `INSERT INTO source_schedules(id,url,title,scope,interval_days)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET url=EXCLUDED.url,title=EXCLUDED.title,scope=EXCLUDED.scope`,
      [source.id, source.url, source.title, source.scope, source.intervalDays],
    );
}
export async function enqueueSource(id: string) {
  if (!sourceById(id)) throw new Error("Kaynak tanımlı değil.");
  const result = await pool.query(
    `INSERT INTO source_update_jobs(id,source_id,state) VALUES($1,$2,'queued')
    ON CONFLICT(source_id) WHERE state IN ('queued','running') DO NOTHING RETURNING id`,
    [randomUUID(), id],
  );
  return !!result.rowCount;
}
export function sourceManagerAllowed(email?: string) {
  if (!email) return false;
  const allowed = (process.env.SOURCE_MANAGER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const dev =
    process.env.NODE_ENV !== "production" &&
    (process.argv.includes("--dev-login") ||
      process.env.npm_lifecycle_event === "dev:api");
  return (
    allowed.includes(email.toLowerCase()) ||
    (dev && email === "developer@kampuspusula.invalid")
  );
}
export function retryDelayMinutes(attempt: number) {
  return [15, 60][Math.min(Math.max(attempt - 1, 0), 1)];
}
export async function scheduleDueSources() {
  await transaction(async (c) => {
    const rows = await c.query(
      `SELECT id FROM source_schedules WHERE enabled AND next_check_at<=now() FOR UPDATE SKIP LOCKED`,
    );
    for (const { id } of rows.rows) {
      await c.query(
        `INSERT INTO source_update_jobs(id,source_id,state) VALUES($1,$2,'queued') ON CONFLICT(source_id) WHERE state IN ('queued','running') DO NOTHING`,
        [randomUUID(), id],
      );
      await c.query(
        `UPDATE source_schedules SET next_check_at=LEAST(now()+ CASE WHEN (now() AT TIME ZONE 'Europe/Istanbul')::date BETWEEN campaign_start AND campaign_end THEN interval '1 day' ELSE interval_days * interval '1 day' END,CASE WHEN campaign_start>(now() AT TIME ZONE 'Europe/Istanbul')::date THEN campaign_start::timestamp AT TIME ZONE 'Europe/Istanbul' ELSE 'infinity'::timestamptz END) WHERE id=$1`,
        [id],
      );
    }
  });
}
