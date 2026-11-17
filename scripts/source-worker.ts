import { spawn } from "node:child_process";
import { useLocalDatabase } from "./environment.ts";
await useLocalDatabase();
const { pool } = await import("../server/db.ts");
const { registerSources, scheduleDueSources, retryDelayMinutes } =
  await import("../server/services/source-updates.ts");
const { runSync } = await import("./life-sync.ts");
let closing = false;
let activeChild: ReturnType<typeof spawn> | undefined;
function stop() {
  closing = true;
  if (activeChild?.pid) activeChild.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
async function run(script: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
    });
    activeChild = child;
    const timer = setTimeout(() => child.kill(), 300000);
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timer);
      activeChild = undefined;
      code === 0
        ? resolve()
        : reject(new Error("Kaynak indeksleme işlemi tamamlanamadı."));
    });
  });
}
async function tick() {
  const gate = await pool.connect();
  let locked = false;
  try {
    locked = (await gate.query("SELECT pg_try_advisory_lock(742390) AS locked"))
      .rows[0].locked;
    if (!locked) return;
    await pool.query(
      `INSERT INTO source_worker_state(id,heartbeat_at) VALUES(true,now()) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now()`,
    );
    // A lost worker releases the advisory lock; the next worker resumes its durable phase.
    await pool.query(
      `UPDATE source_update_jobs SET state='queued',run_after=now() WHERE state='running'`,
    );
    await scheduleDueSources();
    const requested = process.argv
      .find((a) => a.startsWith("--source="))
      ?.slice(9);
    const result = await pool.query(
      `UPDATE source_update_jobs SET state='running',attempts=attempts+1 WHERE id=(
      SELECT id FROM source_update_jobs WHERE state='queued' AND run_after<=now() AND ($1::text IS NULL OR source_id=$1) ORDER BY created_at LIMIT 1
    ) RETURNING *`,
      [requested || null],
    );
    const job = result.rows[0];
    if (!job) return;
    try {
      if (job.phase === "fetch") {
        const synced = await runSync(job.source_id);
        job.changed = synced.changed;
        // Persist the publication obligation before launching any indexer.
        await pool.query(
          `UPDATE source_update_jobs SET changed=$1,phase='publish' WHERE id=$2`,
          [job.changed, job.id],
        );
        await pool.query(
          `UPDATE source_schedules SET last_checked_at=now(),last_error=NULL WHERE id=$1`,
          [job.source_id],
        );
      }
      if (job.changed) {
        await run("scripts/rag-index.ts");
        if (process.env.RAG_SEARCH_BACKEND === "qdrant")
          await run("scripts/rag-qdrant-index.ts");
      }
      await pool.query(
        `UPDATE source_update_jobs SET state='complete',error=NULL,finished_at=now() WHERE id=$1`,
        [job.id],
      );
      await pool.query(
        `UPDATE source_schedules SET last_successful_at=now(),last_changed_at=CASE WHEN $2 THEN now() ELSE last_changed_at END,last_error=NULL WHERE id=$1`,
        [job.source_id, job.changed],
      );
      console.log(
        `Kaynak kontrolü tamamlandı: ${job.source_id} (${job.changed ? "değişti" : "değişmedi"})`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kaynak kontrolü başarısız.";
      await pool.query(
        `UPDATE source_update_jobs SET state=$1,error=$2,run_after=now()+$3*interval '1 minute',finished_at=CASE WHEN $1='failed' THEN now() ELSE NULL END WHERE id=$4`,
        [
          job.attempts < 3 ? "queued" : "failed",
          message.slice(0, 1000),
          retryDelayMinutes(job.attempts),
          job.id,
        ],
      );
      await pool.query(
        `UPDATE source_schedules SET last_checked_at=now(),last_error=$2 WHERE id=$1`,
        [job.source_id, message.slice(0, 1000)],
      );
      console.error(`Kaynak kontrolü başarısız: ${job.source_id}`);
    }
  } finally {
    if (locked) await gate.query("SELECT pg_advisory_unlock(742390)");
    gate.release();
  }
}
try {
  await registerSources();
  do {
    await tick();
    if (process.argv.includes("--once") || closing) break;
    // Bounded polling keeps shutdown responsive; source download cadence lives in PostgreSQL.
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        process.removeListener("SIGINT", finish);
        process.removeListener("SIGTERM", finish);
        resolve();
      };
      const timer = setTimeout(finish, 10000);
      process.once("SIGINT", finish);
      process.once("SIGTERM", finish);
    });
  } while (!closing);
} finally {
  await pool.end();
}
