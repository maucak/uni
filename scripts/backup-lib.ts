import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, constants } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import pg from "pg";

// Yedekleme ve geri yükleme için ortak yardımcılar. Bağlantı dizesi hiçbir
// zaman komut satırına konmaz ve loga basılmaz; parola PGPASSWORD ile geçer.

export type BackupCounts = {
  tables: number;
  users: number | null;
  programs: number | null;
  schema_migrations: number | null;
};
export type BackupManifest = {
  format: 1;
  database: string;
  createdAt: string;
  dumpFile: string;
  sizeBytes: number;
  sha256: string;
  serverVersion: string;
  counts: BackupCounts;
};

export type ConnectionParts = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  sslmode: string;
};

export function parseConnection(url: string): ConnectionParts {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Hata iletisine bağlantı dizesini koyma: parola içerebilir.
    throw new Error("Bağlantı dizesi çözümlenemedi (postgres://… bekleniyor).");
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol))
    throw new Error("Bağlantı dizesi postgres:// ile başlamalı.");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!database) throw new Error("Bağlantı dizesinde veritabanı adı yok.");
  return {
    host: parsed.hostname || "127.0.0.1",
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username) || "postgres",
    password: decodeURIComponent(parsed.password),
    database,
    sslmode: parsed.searchParams.get("sslmode") ?? "",
  };
}

// libpq ortam değişkenleri: parola komut satırında görünmez.
export function pgEnv(
  c: ConnectionParts,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...base,
    PGHOST: c.host,
    PGPORT: c.port,
    PGUSER: c.user,
    PGDATABASE: c.database,
  };
  if (c.password) env.PGPASSWORD = c.password;
  else delete env.PGPASSWORD;
  if (c.sslmode) env.PGSSLMODE = c.sslmode;
  return env;
}

export function sameDatabase(a: ConnectionParts, b: ConnectionParts) {
  const local = (h: string) => (h === "localhost" ? "127.0.0.1" : h);
  return (
    local(a.host) === local(b.host) &&
    a.port === b.port &&
    a.database === b.database
  );
}

export function timestamp(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}

export function backupFileName(database: string, date = new Date()) {
  return `${database.replace(/[^A-Za-z0-9_-]/g, "_")}-${timestamp(date)}.dump`;
}

export function manifestPathFor(dumpPath: string) {
  return dumpPath.replace(/\.dump$/i, "") + ".json";
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(1)} MiB`;
}

export async function sha256File(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export function compareCounts(
  expected: BackupCounts,
  actual: BackupCounts,
): string[] {
  const names: (keyof BackupCounts)[] = [
    "tables",
    "users",
    "programs",
    "schema_migrations",
  ];
  return names
    .filter((n) => expected[n] !== actual[n])
    .map((n) => `${n}: yedekte ${expected[n]}, geri yüklenende ${actual[n]}`);
}

export function parseManifest(text: string): BackupManifest {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Manifest dosyası geçerli JSON değil.");
  }
  const m = value as Partial<BackupManifest> | null;
  const c = m?.counts as Partial<BackupCounts> | undefined;
  const count = (v: unknown) => v === null || Number.isInteger(v);
  if (
    !m ||
    m.format !== 1 ||
    typeof m.sha256 !== "string" ||
    !c ||
    !Number.isInteger(c.tables) ||
    !count(c.users) ||
    !count(c.programs) ||
    !count(c.schema_migrations)
  )
    throw new Error("Manifest biçimi tanınmıyor.");
  return m as BackupManifest;
}

// Hedefte kullanıcı nesnesi (tablo, görünüm, sıra, fonksiyon) varsa boş sayılmaz.
// Eklentilere ait nesneler yok sayılır.
export const EMPTY_CHECK_SQL = `
SELECT (
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p','v','m','S','f')
      AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg\\_toast%'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=c.oid AND d.deptype='e'))
  +
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e'))
)::int AS objects`;

export function isEmptyResult(objects: number) {
  return objects === 0;
}

export async function withClient<T>(
  c: ConnectionParts,
  fn: (client: pg.Client) => Promise<T>,
  database = c.database,
) {
  const client = new pg.Client({
    host: c.host,
    port: Number(c.port),
    user: c.user,
    password: c.password || undefined,
    database,
    ssl: c.sslmode && c.sslmode !== "disable" ? true : undefined,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Veritabanına bağlanılamadı (${c.host}:${c.port}/${database}): ${
        error instanceof Error ? error.message : "bilinmeyen hata"
      }`,
    );
  }
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function isTargetEmpty(client: pg.Client) {
  const r = await client.query(EMPTY_CHECK_SQL);
  return isEmptyResult(r.rows[0].objects);
}

export async function collectCounts(client: pg.Client): Promise<BackupCounts> {
  const tables = await client.query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
  );
  const count = async (table: string) => {
    const exists = await client.query("SELECT to_regclass($1) AS t", [
      `public.${table}`,
    ]);
    if (!exists.rows[0].t) return null;
    // Tablo adı sabit listeden gelir, kullanıcı girdisi değildir.
    const r = await client.query(
      `SELECT count(*)::int AS n FROM public.${table}`,
    );
    return r.rows[0].n as number;
  };
  return {
    tables: tables.rows[0].n,
    users: await count("users"),
    programs: await count("programs"),
    schema_migrations: await count("schema_migrations"),
  };
}

async function executable(path: string) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function embeddedPlatformPackage(
  platform = process.platform,
  arch = process.arch,
) {
  return `@embedded-postgres/${platform === "win32" ? "windows" : platform}-${arch}`;
}

// Sırayla: PG_BIN_DIR, PATH, embedded-postgres platform paketinin bin klasörü.
export async function findPgTool(tool: "pg_dump" | "pg_restore") {
  const exe = process.platform === "win32" ? `${tool}.exe` : tool;
  const dirs: string[] = [];
  if (process.env.PG_BIN_DIR) dirs.push(process.env.PG_BIN_DIR);
  dirs.push(...(process.env.PATH ?? "").split(delimiter).filter(Boolean));
  try {
    const name = embeddedPlatformPackage();
    const pkg = (await import(name)) as { pg_ctl?: string };
    if (pkg.pg_ctl) dirs.push(dirname(pkg.pg_ctl));
  } catch {
    // Platform paketi kurulu değil; yalnızca PATH denenir.
  }
  for (const dir of dirs) {
    const candidate = join(dir, exe);
    if (await executable(candidate)) return candidate;
  }
  throw new Error(missingToolMessage(tool));
}

export function missingToolMessage(tool: string) {
  return [
    `${tool} bulunamadı.`,
    `Arandığı yerler: PG_BIN_DIR, PATH ve embedded-postgres platform paketinin bin klasörü.`,
    `embedded-postgres paketi (@embedded-postgres/windows-x64 dahil) yalnızca initdb, pg_ctl ve postgres içerir; ${tool} içermez.`,
    `Kurulum: PostgreSQL istemci araçlarını kurun (Windows için https://www.postgresql.org/download/windows/ ; kurulum sihirbazında "Command Line Tools" seçili olsun).`,
    `Ardından kurulumun bin klasörünü (ör. C:\\Program Files\\PostgreSQL\\18\\bin) PATH'e ekleyin ya da PG_BIN_DIR ortam değişkenine yazın ve terminali yeniden açın.`,
    `Sürüm uyarısı: gömülü sunucu PostgreSQL 18'dir; pg_dump sürümü sunucudan eski olamaz, 18 veya üstünü kurun.`,
  ].join("\n");
}

export function majorVersion(text: string) {
  const m = /(\d+)(?:\.\d+)?/.exec(text);
  return m ? Number(m[1]) : null;
}

export async function toolMajor(binary: string) {
  const out = await run(binary, ["--version"], process.env);
  return majorVersion(out.stdout.replace(/^.*?\)\s*/, ""));
}

export function run(binary: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<{ stdout: string; stderr: string }>((res, rej) => {
    const p = spawn(binary, args, {
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (s) => (stdout += s));
    p.stderr.on("data", (s) => (stderr += s));
    p.once("error", rej);
    p.once("exit", (code) =>
      code === 0
        ? res({ stdout, stderr })
        : rej(new Error(`${binary} çıkış kodu ${code}: ${stderr.trim()}`)),
    );
  });
}

export function serverMajor(serverVersion: string) {
  return majorVersion(serverVersion);
}

export function assertToolNewEnough(
  tool: string,
  toolMajorVersion: number | null,
  serverMajorVersion: number | null,
) {
  if (
    toolMajorVersion !== null &&
    serverMajorVersion !== null &&
    toolMajorVersion < serverMajorVersion
  )
    throw new Error(
      `${tool} sürümü (${toolMajorVersion}) sunucudan (${serverMajorVersion}) eski. ${serverMajorVersion} veya üstü istemci araçlarını kurun ve PATH ya da PG_BIN_DIR ile gösterin.`,
    );
}
