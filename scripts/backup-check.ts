import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { useLocalDatabase } from "./environment.ts";
import { backup } from "./db-backup.ts";
import { restore } from "./db-restore.ts";
import { parseConnection, withClient } from "./backup-lib.ts";

const exec = promisify(execFile);
const SOURCE_DB = "kampus_backup";
const TARGET_DB = "kampus_restore";

function urlFor(base: string, database: string) {
  const u = new URL(base);
  u.pathname = `/${database}`;
  return u.toString();
}
async function recreate(adminUrl: string, database: string, drop: boolean) {
  const admin = parseConnection(adminUrl);
  await withClient(
    admin,
    async (client) => {
      const exists = await client.query(
        "SELECT 1 FROM pg_database WHERE datname=$1",
        [database],
      );
      // Yalnızca bu script'e ait sabit adlı veritabanları silinir.
      if (exists.rowCount && drop)
        await client.query(`DROP DATABASE ${database} WITH (FORCE)`);
      if (!exists.rowCount || drop)
        await client.query(`CREATE DATABASE ${database}`);
    },
    "postgres",
  );
}
async function node(script: string, databaseUrl: string) {
  await exec(process.execPath, [script], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

try {
  await useLocalDatabase();
  const base = process.env.DATABASE_URL!;
  const sourceUrl = urlFor(base, SOURCE_DB);
  const targetUrl = urlFor(base, TARGET_DB);

  await recreate(base, SOURCE_DB, false);
  await recreate(base, TARGET_DB, true);
  await node("scripts/migrate.ts", sourceUrl);
  await node("scripts/seed.ts", sourceUrl);

  const email = `yedek-testi-${randomUUID()}@example.test`;
  await withClient(parseConnection(sourceUrl), (client) =>
    client.query(
      "INSERT INTO users(id,email,password_hash,profile) VALUES($1,$2,'x','{}'::jsonb)",
      [randomUUID(), email],
    ),
  );

  const made = await backup(sourceUrl);
  console.log(`Yedek alındı: ${made.dumpPath}`);
  const result = await restore(made.dumpPath, targetUrl);
  if (!result.verified) throw new Error("Manifest doğrulaması yapılamadı.");
  if (result.mismatches.length) throw new Error(result.mismatches.join("; "));
  const found = await withClient(parseConnection(targetUrl), (client) =>
    client.query("SELECT 1 FROM users WHERE email=$1", [email]),
  );
  if (!found.rowCount) throw new Error("Test kullanıcısı geri yüklenmedi.");

  // Dolu hedefin reddedildiğini de doğrula.
  let refused = false;
  try {
    await restore(made.dumpPath, targetUrl);
  } catch {
    refused = true;
  }
  if (!refused) throw new Error("Dolu hedef reddedilmedi.");

  const c = result.counts!;
  console.log(
    `tablo=${c.tables} users=${c.users} programs=${c.programs} schema_migrations=${c.schema_migrations}`,
  );
  console.log("PASS");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log("FAIL");
  process.exitCode = 1;
}
