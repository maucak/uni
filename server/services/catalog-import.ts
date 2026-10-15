import { educationLanguages } from "../../shared/contracts.ts";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
const nullableNumber = z.number().finite().nonnegative().nullable();
const safeUrl = z
  .url()
  .refine(
    (v) => new URL(v).protocol === "https:",
    "Kaynak https adresi olmalı.",
  );
export const manifestSchema = z.object({
  version: z.string().regex(/^[a-zA-Z0-9._-]{3,100}$/),
  notes: z.string().min(10).max(2000),
  sources: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        title: z.string().min(3).max(250),
        url: safeUrl,
        publisher: z.string().min(2).max(150),
        retrievedAt: z.iso.date(),
        notes: z.string().min(5).max(2000),
      }),
    )
    .min(1)
    .max(500),
  programs: z
    .array(
      z.object({
        key: z.string().min(3).max(150),
        admissionData: z
          .object({
            year: z.number().int().min(2000).max(2100),
            table: z.enum(["3", "4"]),
            row: z.number().int().positive(),
            sourceKey: z.string(),
            columns: z.record(
              z.string(),
              z.union([z.string(), z.number().finite(), z.null()]),
            ),
          })
          .optional(),
        officialCode: z
          .string()
          .regex(/^\d{9}$/)
          .nullable(),
        university: z.string().min(3).max(200),
        city: z.string().min(2).max(80),
        universityType: z.enum(["Devlet", "Vakıf", "Yurt dışı"]),
        name: z.string().min(3).max(500),
        language: z.enum(educationLanguages),
        scoreType: z.enum(["SAY", "EA", "SÖZ", "DİL", "TYT"]),
        scholarship: z.string().min(1).max(100),
        scholarshipPercent: z.number().min(0).max(100).nullable(),
        description: z.string().min(20).max(5000),
        subjects: z.array(z.string().max(80)).max(30),
        sources: z.array(z.string()).min(1).max(20),
        years: z
          .array(
            z.object({
              year: z.number().int().min(2000).max(2100),
              rank: z.number().int().positive().nullable(),
              quota: z.number().int().nonnegative().nullable(),
              tuition: nullableNumber,
              currency: z.enum(["TRY"]).nullable(),
              sourceKey: z.string(),
            }),
          )
          .max(30),
      }),
    )
    .min(1)
    .max(30000),
});
export type CatalogManifest = z.infer<typeof manifestSchema>;
export function validateManifest(input: unknown) {
  const result = manifestSchema.safeParse(input);
  if (!result.success)
    return {
      manifest: null,
      errors: result.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      ),
      warnings: [] as string[],
    };
  const manifest = result.data;
  const errors: string[] = [],
    warnings: string[] = [];
  const sources = new Set<string>(),
    keys = new Set<string>(),
    codes = new Set<string>(),
    identities = new Set<string>();
  for (const s of manifest.sources) {
    if (sources.has(s.key)) errors.push(`Yinelenen kaynak: ${s.key}`);
    sources.add(s.key);
    if (s.retrievedAt > new Date().toISOString().slice(0, 10))
      warnings.push(`${s.key}: erişim tarihini kontrol edin.`);
  }
  for (const p of manifest.programs) {
    if (keys.has(p.key)) errors.push(`Yinelenen program anahtarı: ${p.key}`);
    keys.add(p.key);
    if (p.officialCode) {
      if (codes.has(p.officialCode))
        errors.push(`Yinelenen resmî kod: ${p.officialCode}`);
      codes.add(p.officialCode);
    }
    const identity = JSON.stringify([
      p.university,
      p.name,
      p.language,
      p.scholarship,
    ]);
    if (identities.has(identity))
      errors.push(`Yinelenen program kimliği: ${p.key}`);
    identities.add(identity);
    for (const key of p.sources)
      if (!sources.has(key)) errors.push(`${p.key}: bilinmeyen kaynak ${key}`);
    if (p.admissionData && !p.sources.includes(p.admissionData.sourceKey))
      errors.push(`${p.key}: ayrıntı kaynağı program kaynaklarında yok.`);
    const years = new Set<number>();
    for (const y of p.years) {
      if (years.has(y.year)) errors.push(`${p.key}: yinelenen yıl ${y.year}`);
      years.add(y.year);
      if (!p.sources.includes(y.sourceKey))
        errors.push(
          `${p.key}/${y.year}: yıllık kaynak program kaynaklarında yok.`,
        );
      if (y.tuition !== null && y.currency === null)
        errors.push(`${p.key}/${y.year}: ücret para birimi gerekli.`);
    }
    if (!p.years.some((y) => y.rank !== null))
      warnings.push(`${p.key}: doğrulanmış sıralama verisi yok.`);
    if (!p.years.some((y) => y.tuition !== null))
      warnings.push(`${p.key}: ücret bilinmiyor; ücretsiz varsayılmayacak.`);
  }
  return { manifest: errors.length ? null : manifest, errors, warnings };
}
export const manifestChecksum = (manifest: CatalogManifest) =>
  createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
export async function applyManifest(
  client: PoolClient,
  manifest: CatalogManifest,
  onProgress: (done: number, total: number) => void = () => {},
) {
  await client.query("SELECT pg_advisory_xact_lock(742382)");
  const checksum = manifestChecksum(manifest);
  const existing = await client.query(
    "SELECT version,checksum FROM import_batches WHERE version=$1 OR checksum=$2",
    [manifest.version, checksum],
  );
  if (existing.rowCount) {
    if (existing.rows[0].checksum !== checksum)
      throw new Error(
        "Aynı sürümün içeriği değiştirilemez. Yeni sürüm adı kullanın.",
      );
    return {
      applied: false,
      version: existing.rows[0].version,
      count: manifest.programs.length,
    };
  }
  const sourceIds = new Map<string, string>();
  for (const s of manifest.sources) {
    const hash = createHash("sha256").update(JSON.stringify(s)).digest("hex");
    const row = await client.query(
      `INSERT INTO data_sources(id,source_key,title,url,publisher,retrieved_at,notes,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(source_key) DO UPDATE SET title=excluded.title,url=excluded.url,publisher=excluded.publisher,retrieved_at=excluded.retrieved_at,notes=excluded.notes,content_hash=excluded.content_hash RETURNING id`,
      [
        randomUUID(),
        s.key,
        s.title,
        s.url,
        s.publisher,
        s.retrievedAt,
        s.notes,
        hash,
      ],
    );
    sourceIds.set(s.key, row.rows[0].id);
  }
  const storedPrograms = await client.query(
    "SELECT id,external_key,official_code FROM programs",
  );
  const byKey = new Map(storedPrograms.rows.map((p) => [p.external_key, p.id]));
  const byCode = new Map(
    storedPrograms.rows
      .filter((p) => p.official_code)
      .map((p) => [p.official_code, p.id]),
  );
  const universityIds = new Map<string, string>();
  let done = 0;
  for (const p of manifest.programs) {
    let universityId = universityIds.get(p.university);
    if (!universityId) {
      const u = await client.query(
        "INSERT INTO universities(id,name,city,university_type) VALUES($1,$2,$3,$4) ON CONFLICT(name) DO UPDATE SET city=excluded.city,university_type=excluded.university_type RETURNING id",
        [randomUUID(), p.university, p.city, p.universityType],
      );
      universityId = u.rows[0].id;
      universityIds.set(p.university, universityId!);
    }
    const keyId = byKey.get(p.key),
      codeId = p.officialCode ? byCode.get(p.officialCode) : undefined;
    if (keyId && codeId && keyId !== codeId)
      throw new Error(`${p.key}: anahtar/kod iki farklı kayda işaret ediyor.`);
    const id = keyId || codeId || randomUUID();
    await client.query(
      `INSERT INTO programs(id,external_key,official_code,university_id,name,language,score_type,scholarship,scholarship_percent,description,subjects,is_sample) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false) ON CONFLICT(id) DO UPDATE SET external_key=excluded.external_key,official_code=excluded.official_code,university_id=excluded.university_id,name=excluded.name,language=excluded.language,score_type=excluded.score_type,scholarship=excluded.scholarship,scholarship_percent=excluded.scholarship_percent,description=excluded.description,subjects=excluded.subjects,is_sample=false,updated_at=now()`,
      [
        id,
        p.key,
        p.officialCode,
        universityId,
        p.name,
        p.language,
        p.scoreType,
        p.scholarship,
        p.scholarshipPercent,
        p.description,
        JSON.stringify(p.subjects),
      ],
    );
    if (p.admissionData)
      await client.query(
        `INSERT INTO program_admissions(program_id,year,table_number,source_row,source_id,details) VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(program_id,year) DO UPDATE SET table_number=excluded.table_number,source_row=excluded.source_row,source_id=excluded.source_id,details=excluded.details`,
        [
          id,
          p.admissionData.year,
          p.admissionData.table,
          p.admissionData.row,
          sourceIds.get(p.admissionData.sourceKey),
          JSON.stringify(p.admissionData.columns),
        ],
      );
    await client.query(
      `INSERT INTO communities(id,name,slug,description,program_id) VALUES($1,$2,$3,$4,$1)
       ON CONFLICT(program_id) WHERE program_id IS NOT NULL DO UPDATE SET name=excluded.name`,
      [
        id,
        `${p.university} · ${p.name} (${p.language})`,
        `program-${id}`,
        "Dersler, hazırlık, staj ve kampüs yaşamı hakkında programla ilgili sorular.",
      ],
    );
    await client.query("DELETE FROM program_sources WHERE program_id=$1", [id]);
    for (const key of p.sources)
      await client.query(
        "INSERT INTO program_sources(program_id,source_id) VALUES($1,$2)",
        [id, sourceIds.get(key)],
      );
    for (const y of p.years) {
      const source = manifest.sources.find((s) => s.key === y.sourceKey)!;
      await client.query(
        `INSERT INTO program_year_data(program_id,year,rank,quota,tuition,currency,source,source_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(program_id,year) DO UPDATE SET rank=excluded.rank,quota=excluded.quota,tuition=excluded.tuition,currency=excluded.currency,source=excluded.source,source_url=excluded.source_url`,
        [
          id,
          y.year,
          y.rank,
          y.quota,
          y.tuition,
          y.currency,
          source.title,
          source.url,
        ],
      );
    }
    done++;
    if (done % 1000 === 0 || done === manifest.programs.length)
      onProgress(done, manifest.programs.length);
  }
  await client.query(
    "INSERT INTO import_batches(id,version,checksum,manifest,record_count) VALUES($1,$2,$3,$4,$5)",
    [
      randomUUID(),
      manifest.version,
      checksum,
      JSON.stringify(manifest),
      manifest.programs.length,
    ],
  );
  return {
    applied: true,
    version: manifest.version,
    count: manifest.programs.length,
  };
}
