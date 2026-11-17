import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_CHECK_SQL,
  assertToolNewEnough,
  backupFileName,
  compareCounts,
  embeddedPlatformPackage,
  isEmptyResult,
  manifestPathFor,
  majorVersion,
  missingToolMessage,
  parseConnection,
  parseManifest,
  pgEnv,
  sameDatabase,
} from "../scripts/backup-lib.ts";

const counts = { tables: 40, users: 3, programs: 100, schema_migrations: 13 };

test("manifest karşılaştırması farkları adlarıyla bildirir", () => {
  assert.deepEqual(compareCounts(counts, { ...counts }), []);
  const diff = compareCounts(counts, { ...counts, users: 2, programs: 99 });
  assert.equal(diff.length, 2);
  assert.match(diff[0], /^users:/);
  assert.equal(
    compareCounts({ ...counts, users: null }, { ...counts, users: 0 }).length,
    1,
  );
});

test("manifest çözümleme bozuk ya da eksik içeriği reddeder", () => {
  const ok = JSON.stringify({ format: 1, sha256: "ab", counts });
  assert.equal(parseManifest(ok).counts.users, 3);
  assert.throws(() => parseManifest("{"), /JSON/);
  assert.throws(
    () => parseManifest(JSON.stringify({ format: 2 })),
    /tanınmıyor/,
  );
  assert.throws(
    () =>
      parseManifest(
        JSON.stringify({ format: 1, sha256: "ab", counts: { tables: "x" } }),
      ),
    /tanınmıyor/,
  );
});

test("hedef boş mu kontrolü yalnızca sıfır nesneyi boş sayar", () => {
  assert.equal(isEmptyResult(0), true);
  assert.equal(isEmptyResult(1), false);
  assert.match(EMPTY_CHECK_SQL, /pg_class/);
});

test("bağlantı dizesi çözülür ve parola komut satırı yerine ortama gider", () => {
  const c = parseConnection(
    "postgres://u:p%40ss@db.example:6000/kampus?sslmode=require",
  );
  assert.deepEqual(
    [c.host, c.port, c.user, c.password, c.database, c.sslmode],
    ["db.example", "6000", "u", "p@ss", "kampus", "require"],
  );
  const env = pgEnv(c, {});
  assert.equal(env.PGPASSWORD, "p@ss");
  assert.equal(env.PGDATABASE, "kampus");
  assert.equal(env.PGSSLMODE, "require");
  assert.equal(
    pgEnv(parseConnection("postgres://postgres@h/d"), { PGPASSWORD: "eski" })
      .PGPASSWORD,
    undefined,
  );
});

test("geçersiz bağlantı dizesi hatası parolayı sızdırmaz", () => {
  assert.throws(
    () => parseConnection("mysql://u:gizli@h/d"),
    (e: Error) => !e.message.includes("gizli"),
  );
  assert.throws(
    () => parseConnection("postgres://u:gizli@h"),
    (e: Error) => !e.message.includes("gizli"),
  );
});

test("aynı veritabanı tespiti localhost ve 127.0.0.1'i eşler", () => {
  const a = parseConnection("postgres://x@localhost:5433/kampus");
  assert.equal(
    sameDatabase(a, parseConnection("postgres://y@127.0.0.1:5433/kampus")),
    true,
  );
  assert.equal(
    sameDatabase(
      a,
      parseConnection("postgres://y@127.0.0.1:5433/kampus_restore"),
    ),
    false,
  );
});

test("yedek dosya adı ve manifest yolu", () => {
  const name = backupFileName(
    "kampus/x y",
    new Date("2026-11-17T10:20:30.456Z"),
  );
  assert.equal(name, "kampus_x_y-20261117T102030Z.dump");
  assert.equal(manifestPathFor("var/backups/a-1.dump"), "var/backups/a-1.json");
});

test("araç bulunamayınca Türkçe kurulum yönergesi verilir", () => {
  const message = missingToolMessage("pg_dump");
  assert.match(message, /pg_dump bulunamadı/);
  assert.match(message, /PATH/);
  assert.match(message, /PG_BIN_DIR/);
});

test("platform paketi adı ve sürüm denetimi", () => {
  assert.equal(
    embeddedPlatformPackage("win32", "x64"),
    "@embedded-postgres/windows-x64",
  );
  assert.equal(
    embeddedPlatformPackage("linux", "x64"),
    "@embedded-postgres/linux-x64",
  );
  assert.equal(majorVersion("16.15"), 16);
  assert.throws(() => assertToolNewEnough("pg_dump", 16, 18), /eski/);
  assert.doesNotThrow(() => assertToolNewEnough("pg_dump", 18, 16));
});
