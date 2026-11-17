import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pool } from "../db.ts";
import { documentRetentionDays } from "./verification-rules.ts";

/** Belgeler statik olarak sunulmayan bu klasörde, rastgele adla saklanır. */
export const privateUploadDirectory = resolve("var/private-uploads");

/** Yalnızca kaynağı kesin alan adları. Katalogda tam adla eşleşmeyen satır atlanır. */
export const sourcedEmailDomains = [
  ["Isparta Uygulamalı Bilimler Üniversitesi", "isparta.edu.tr"],
  ["Süleyman Demirel Üniversitesi", "sdu.edu.tr"],
  ["Pamukkale Üniversitesi", "pau.edu.tr"],
  ["Akdeniz Üniversitesi", "akdeniz.edu.tr"],
] as const;
/** Migration 016 ile aynı ekleme; katalog migration'dan sonra yüklendiğinde açılışta tamamlanır. */
export async function seedEmailDomains() {
  await pool.query(
    `INSERT INTO university_email_domains(university_id,domain)
     SELECT u.id,d.domain FROM unnest($1::text[],$2::text[]) AS d(name,domain)
     JOIN universities u ON u.name=d.name ON CONFLICT (domain) DO NOTHING`,
    [
      sourcedEmailDomains.map((d) => d[0]),
      sourcedEmailDomains.map((d) => d[1]),
    ],
  );
}

export async function storeDocument(buf: Buffer, ext: string) {
  await mkdir(privateUploadDirectory, { recursive: true, mode: 0o700 });
  const name = `${randomBytes(24).toString("hex")}.${ext}`;
  await writeFile(resolve(privateUploadDirectory, name), buf, {
    mode: 0o600,
    flag: "wx",
  });
  return name;
}
/** Kayıtta yalnız dosya adı tutulur; klasör dışına çıkan yol kabul edilmez. */
export function documentFile(name: string) {
  if (basename(name) !== name || !/^[a-f0-9]{48}\.(pdf|jpg|png)$/.test(name))
    throw new Error("Geçersiz belge yolu.");
  return resolve(privateUploadDirectory, name);
}
export async function removeDocument(name: string) {
  await unlink(documentFile(name)).catch((e) => {
    if (e.code !== "ENOENT") throw e;
  });
}

/** Karar verilmiş başvuruların belgelerini 30 gün sonra siler. */
export async function cleanupDecidedDocuments() {
  const r = await pool.query(
    `SELECT id,document_path FROM verification_requests WHERE document_path IS NOT NULL
     AND status<>'pending' AND reviewed_at<=now()-make_interval(days=>$1)`,
    [documentRetentionDays],
  );
  for (const row of r.rows) {
    await removeDocument(row.document_path);
    await pool.query(
      "UPDATE verification_requests SET document_path=NULL WHERE id=$1",
      [row.id],
    );
  }
  return r.rowCount || 0;
}
export function scheduleDocumentCleanup() {
  const run = () =>
    cleanupDecidedDocuments()
      .then((n) => n && console.log(`doğrulama belgesi temizlendi: ${n}`))
      .catch((e) => console.error("belge temizliği başarısız:", e.message));
  void run();
  setInterval(run, 24 * 60 * 60_000).unref();
}

export { authorMetaSql } from "./author-meta.ts";
