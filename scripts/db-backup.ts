import { mkdir, stat, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { useLocalDatabase } from "./environment.ts";
import {
  assertToolNewEnough,
  backupFileName,
  collectCounts,
  findPgTool,
  formatBytes,
  manifestPathFor,
  parseConnection,
  pgEnv,
  run,
  serverMajor,
  sha256File,
  toolMajor,
  withClient,
  type BackupManifest,
} from "./backup-lib.ts";

export async function backup(databaseUrl: string, directory = "var/backups") {
  const connection = parseConnection(databaseUrl);
  const info = await withClient(connection, async (client) => ({
    version: (await client.query("SHOW server_version")).rows[0]
      .server_version as string,
  }));
  const pgDump = await findPgTool("pg_dump");
  assertToolNewEnough(
    "pg_dump",
    await toolMajor(pgDump),
    serverMajor(info.version),
  );
  await mkdir(directory, { recursive: true });
  const dumpPath = join(directory, backupFileName(connection.database));
  try {
    await run(
      pgDump,
      ["-Fc", "--no-password", "-f", dumpPath],
      pgEnv(connection),
    );
  } catch (error) {
    await rm(dumpPath, { force: true });
    throw error;
  }
  // Sayılar dökümden hemen sonra alınır; yazma trafiği varsa küçük sapma olabilir.
  const counts = await withClient(connection, collectCounts);
  const size = (await stat(dumpPath)).size;
  const sha256 = await sha256File(dumpPath);
  const manifest: BackupManifest = {
    format: 1,
    database: connection.database,
    createdAt: new Date().toISOString(),
    dumpFile: dumpPath.split(/[\\/]/).pop()!,
    sizeBytes: size,
    sha256,
    serverVersion: info.version,
    counts,
  };
  const manifestPath = manifestPathFor(dumpPath);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return { dumpPath, manifestPath, size, sha256, counts };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await useLocalDatabase();
    const result = await backup(process.env.DATABASE_URL!);
    console.log(`Yedek: ${result.dumpPath}`);
    console.log(`Manifest: ${result.manifestPath}`);
    console.log(`Boyut: ${formatBytes(result.size)} (${result.size} bayt)`);
    console.log(`sha256: ${result.sha256}`);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Yedekleme başarısız.",
    );
    process.exitCode = 1;
  }
}
