import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import "dotenv/config";
import {
  assertToolNewEnough,
  collectCounts,
  compareCounts,
  findPgTool,
  isTargetEmpty,
  manifestPathFor,
  parseConnection,
  parseManifest,
  pgEnv,
  run,
  sameDatabase,
  serverMajor,
  sha256File,
  toolMajor,
  withClient,
} from "./backup-lib.ts";

export async function restore(
  dumpPath: string,
  targetUrl: string,
  options: { force?: boolean; protectUrl?: string } = {},
) {
  await access(dumpPath).catch(() => {
    throw new Error(`Yedek dosyası bulunamadı: ${dumpPath}`);
  });
  const target = parseConnection(targetUrl);
  if (
    !options.force &&
    options.protectUrl &&
    sameDatabase(target, parseConnection(options.protectUrl))
  )
    throw new Error(
      "Hedef, DATABASE_URL ile aynı veritabanı. Yanlışlıkla ezmemek için boş bir veritabanı verin (ör. kampus_restore).",
    );

  // Manifest varsa önce dosyanın bozulmadığını sha256 ile doğrula.
  let manifest = null;
  try {
    manifest = parseManifest(await readFile(manifestPathFor(dumpPath), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (manifest && (await sha256File(dumpPath)) !== manifest.sha256)
    throw new Error(
      "Yedek dosyasının sha256 değeri manifestle uyuşmuyor; dosya bozulmuş olabilir.",
    );

  // Hedef veritabanı yoksa oluştur (yeni boş veritabanı güvenlidir).
  await withClient(
    target,
    async (admin) => {
      const exists = await admin.query(
        "SELECT 1 FROM pg_database WHERE datname=$1",
        [target.database],
      );
      if (!exists.rowCount) {
        const quoted = `"${target.database.replace(/"/g, '""')}"`;
        await admin.query(`CREATE DATABASE ${quoted}`);
        console.log(`Hedef veritabanı oluşturuldu: ${target.database}`);
      }
    },
    "postgres",
  );

  const version = await withClient(target, async (client) => {
    if (!options.force && !(await isTargetEmpty(client)))
      throw new Error(
        `Hedef veritabanı boş değil (${target.database}). Üzerine yazmak için --force verin; yalnızca yedekteki nesneler silinip yeniden oluşturulur.`,
      );
    return (await client.query("SHOW server_version")).rows[0]
      .server_version as string;
  });

  const pgRestore = await findPgTool("pg_restore");
  assertToolNewEnough(
    "pg_restore",
    await toolMajor(pgRestore),
    serverMajor(version),
  );
  const args = [
    "--no-password",
    "--no-owner",
    "--exit-on-error",
    "-d",
    target.database,
  ];
  if (options.force) args.push("--clean", "--if-exists");
  args.push(dumpPath);
  await run(pgRestore, args, pgEnv(target));

  if (!manifest) {
    console.warn(
      "Uyarı: manifest (.json) bulunamadı; sayı doğrulaması atlandı.",
    );
    return { verified: false, mismatches: [] as string[] };
  }
  const actual = await withClient(target, collectCounts);
  const mismatches = compareCounts(manifest.counts, actual);
  return { verified: true, mismatches, counts: actual };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        target: { type: "string" },
        force: { type: "boolean", default: false },
      },
    });
    if (positionals.length !== 1 || !values.target)
      throw new Error(
        "Kullanım: npm run db:restore -- <dosya.dump> --target <DATABASE_URL> [--force]",
      );
    const result = await restore(positionals[0], values.target, {
      force: values.force,
      protectUrl: process.env.DATABASE_URL,
    });
    if (result.mismatches.length) {
      console.error("DOĞRULAMA BAŞARISIZ:");
      for (const m of result.mismatches) console.error(`  ${m}`);
      process.exitCode = 1;
    } else if (result.verified) {
      console.log("Geri yükleme tamamlandı; sayılar manifestle eşleşiyor.");
    } else {
      console.log("Geri yükleme tamamlandı (doğrulanmadı).");
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Geri yükleme başarısız.",
    );
    process.exitCode = 1;
  }
}
