import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateManifest,
  applyManifest,
  manifestChecksum,
} from "../server/services/catalog-import.ts";
import { useLocalDatabase } from "./environment.ts";
const path = process.argv[2];
if (!path)
  throw new Error("npm run catalog:import -- data/katalog.json [--apply]");
const raw = JSON.parse(await readFile(resolve(path), "utf8"));
const report = validateManifest(raw);
console.log(
  JSON.stringify(
    {
      version: report.manifest?.version,
      records: report.manifest?.programs.length,
      errors: report.errors,
      warningCount: report.warnings.length,
      warnings: report.warnings.slice(0, 10),
      warningDetails: "var/import-reports/latest.json",
    },
    null,
    2,
  ),
);
await mkdir("var/import-reports", { recursive: true });
await writeFile(
  "var/import-reports/latest.json",
  JSON.stringify({ file: path, ...report, manifest: undefined }, null, 2),
);
if (!report.manifest) {
  process.exitCode = 1;
} else if (process.argv.includes("--apply")) {
  await useLocalDatabase();
  const { pool, transaction } = await import("../server/db.ts");
  try {
    const result = await transaction((c) =>
      applyManifest(c, report.manifest!, (done, total) =>
        console.log(`Aktarım: ${done}/${total}`),
      ),
    );
    console.log(JSON.stringify(result));
  } finally {
    await pool.end();
  }
} else
  console.log(
    `Önizleme tamamlandı. Değişiklik yapılmadı. SHA-256: ${manifestChecksum(report.manifest)}`,
  );
