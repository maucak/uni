// Migration 016 akışları: rol, kurumsal e-posta, belge, inceleme ve itibar.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import pg from "pg";
const origin = process.env.WEB_ORIGIN || "http://127.0.0.1:5173";
const base = `${origin}/api/v1`;
const password = "Verification-check-passphrase-2026";
const prefix = randomUUID().slice(0, 8);
const userIds: string[] = [];
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const mailDir = "var/mail";
async function mailToken(email: string, path: string) {
  const files = (await readdir(mailDir).catch(() => []))
    .filter((f) => f.endsWith(`-${email}.txt`))
    .sort();
  assert(files.length, `${email} için e-posta dosyası yok`);
  const text = await readFile(`${mailDir}/${files.at(-1)}`, "utf8");
  const match = text.match(new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`));
  assert(match, "e-postada bağlantı yok");
  return match[1];
}
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  expected = 200,
  contentType?: string,
) {
  const raw = body instanceof Uint8Array;
  const res = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined
        ? { "Content-Type": contentType || "application/json" }
        : {}),
    },
    body: raw
      ? (body as BodyInit)
      : body !== undefined
        ? JSON.stringify(body)
        : undefined,
  });
  const type = res.headers.get("content-type") || "";
  const data =
    res.status === 204
      ? null
      : type.includes("json")
        ? await res.json()
        : Buffer.from(await res.arrayBuffer());
  assert.equal(
    res.status,
    expected,
    `${method} ${path}: ${data instanceof Buffer ? "<ikili>" : JSON.stringify(data)}`,
  );
  return { data, res, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}
async function register(tag: string, verify = true) {
  const email = `${prefix}-${tag}@example.test`;
  const r = await call(
    "/auth/register",
    "POST",
    { email, password, displayName: `Doğrulama ${tag}` },
    undefined,
    201,
  );
  userIds.push(r.data.id);
  if (verify)
    await call("/auth/verify-email", "POST", {
      token: await mailToken(email, "/eposta-dogrula"),
    });
  return { id: r.data.id as string, cookie: r.cookie! };
}
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d,
]);
const publicOf = async (id: string) =>
  (await call(`/users/${id}/public`)).data as {
    badges: { label: string }[];
    reputation: number;
  };
try {
  const uni = await db.query(
    "SELECT university_id FROM university_email_domains WHERE domain='sdu.edu.tr'",
  );
  assert(uni.rowCount, "sdu.edu.tr alan adı seed edilmemiş");
  const universityId = uni.rows[0].university_id;
  const emailClaim = (address: string) => ({
    method: "institution_email",
    claim: "student",
    universityId,
    institutionEmail: address,
  });

  // Doğrulanmamış e-posta reddedilir.
  const unverified = await register("u", false);
  const denied = await call(
    "/verifications",
    "POST",
    emailClaim(`${prefix}@ogr.sdu.edu.tr`),
    unverified.cookie,
    403,
  );
  assert.equal(denied.data.code, "EMAIL_NOT_VERIFIED");

  // Kurumsal e-posta → onay → rozet görünür.
  const a = await register("a");
  const mismatch = await call(
    "/verifications",
    "POST",
    emailClaim(`${prefix}@kotusdu.edu.tr`),
    a.cookie,
    400,
  );
  assert.equal(mismatch.data.code, "DOMAIN_MISMATCH");
  const institutionEmail = `${prefix}-a@ogr.sdu.edu.tr`;
  await call(
    "/verifications",
    "POST",
    emailClaim(institutionEmail),
    a.cookie,
    201,
  );
  await call(
    "/verifications",
    "POST",
    emailClaim(`${prefix}-a2@sdu.edu.tr`),
    a.cookie,
    409,
  );
  assert.equal((await publicOf(a.id)).badges.length, 0);
  await call(
    `/verifications/confirm?token=${await mailToken(institutionEmail, "/dogrulama")}`,
  );
  const aPublic = await publicOf(a.id);
  assert.equal(aPublic.badges.length, 1);
  assert.match(aPublic.badges[0].label, /öğrencisi \(kurumsal e-posta\)$/);
  const mine = (await call("/verifications/mine", "GET", undefined, a.cookie))
    .data;
  assert.equal(mine[0].status, "approved");

  // Roller: normal kullanıcı rol atayamaz; geliştirme hesabı admin.
  const b = await register("b");
  const c = await register("c");
  await call(
    `/admin/users/${c.id}/roles`,
    "PUT",
    { roles: ["reviewer"] },
    a.cookie,
    403,
  );
  const admin = await call("/auth/dev-login", "POST", {});
  assert.ok(admin.data.roles.includes("admin"));
  await call(
    `/admin/users/${c.id}/roles`,
    "PUT",
    { roles: ["reviewer"] },
    admin.cookie,
  );
  const self = await call(
    `/admin/users/${admin.data.id}/roles`,
    "PUT",
    { roles: [] },
    admin.cookie,
    400,
  );
  assert.equal(self.data.code, "SELF_ADMIN_REMOVAL");

  // Belge yükle → normal kullanıcı indiremez → inceleyici indirir → onayla → kaldır.
  const docQuery = `/verifications?claim=graduate&universityId=${universityId}`;
  const fake = await call(
    docQuery,
    "POST",
    new TextEncoder().encode("<html>sahte</html>"),
    b.cookie,
    415,
    "application/pdf",
  );
  assert.equal(fake.data.code, "UNSUPPORTED_DOCUMENT");
  const doc = await call(
    docQuery,
    "POST",
    png,
    b.cookie,
    201,
    "application/octet-stream",
  );
  const docId = doc.data.id;
  await call(`/admin/verifications`, "GET", undefined, b.cookie, 403);
  await call(
    `/admin/verifications/${docId}/document`,
    "GET",
    undefined,
    a.cookie,
    403,
  );
  const queue = (await call("/admin/verifications", "GET", undefined, c.cookie))
    .data;
  assert.ok(queue.some((r: any) => r.id === docId));
  const file = await call(
    `/admin/verifications/${docId}/document`,
    "GET",
    undefined,
    c.cookie,
  );
  assert.equal(file.res.headers.get("content-type"), "image/png");
  assert.match(file.res.headers.get("content-disposition")!, /^attachment;/);
  assert.equal(file.res.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(file.data), png);
  await call(
    `/admin/verifications/${docId}`,
    "PUT",
    { action: "approve" },
    c.cookie,
  );
  assert.match((await publicOf(b.id)).badges[0].label, /mezunu \(belge\)$/);
  await call(
    `/admin/verifications/${docId}`,
    "PUT",
    { action: "revoke", note: "Belge geçersiz çıktı." },
    c.cookie,
  );
  assert.equal((await publicOf(b.id)).badges.length, 0);

  // Kendi başvurusunu onaylayamaz.
  const own = await call(docQuery, "POST", png, c.cookie, 201, "image/png");
  const selfReview = await call(
    `/admin/verifications/${own.data.id}`,
    "PUT",
    { action: "approve" },
    c.cookie,
    403,
  );
  assert.equal(selfReview.data.code, "SELF_REVIEW");

  // İtibar: oy +2 → geri al → 0; kabul edilen yanıt +5; kendine oy olay üretmez.
  const community = (await call("/communities?kind=general&limit=1")).data[0];
  const question = await call(
    "/questions",
    "POST",
    {
      communityId: community.id,
      title: `Doğrulama kontrolü ${prefix}`,
      body: "Geçici entegrasyon kaydıdır; kontrol sonunda silinir.",
    },
    a.cookie,
    201,
  );
  await call(
    `/questions/${question.data.id}/answers`,
    "POST",
    { body: "Geçici entegrasyon yanıtı." },
    b.cookie,
    201,
  );
  const answerId = (await call(`/questions/${question.data.id}`)).data
    .answers[0].id;
  await call(`/answers/${answerId}/vote`, "PUT", undefined, b.cookie, 400);
  await call(`/answers/${answerId}/vote`, "PUT", undefined, c.cookie);
  assert.equal((await publicOf(b.id)).reputation, 2);
  await call(`/answers/${answerId}/vote`, "DELETE", undefined, c.cookie);
  assert.equal((await publicOf(b.id)).reputation, 0);
  await call(
    `/questions/${question.data.id}/accepted-answer`,
    "PUT",
    { answerId },
    a.cookie,
  );
  assert.equal((await publicOf(b.id)).reputation, 5);
  const detail = (await call(`/questions/${question.data.id}`)).data;
  assert.equal(detail.answers[0].authorReputation, 5);
  assert.equal(detail.authorBadges.length, 1);

  // Moderasyon: normal kullanıcı gizleyemez, admin gizler ve geri açar.
  await call(
    `/moderation/questions/${question.data.id}`,
    "PUT",
    { status: "hidden" },
    a.cookie,
    403,
  );
  await call(
    `/moderation/questions/${question.data.id}`,
    "PUT",
    { status: "hidden" },
    admin.cookie,
  );
  await call(
    `/questions/${question.data.id}`,
    "GET",
    undefined,
    undefined,
    404,
  );

  console.log(
    "PASS: doğrulanmamış e-posta reddi, alan adı eşleşmesi, kurumsal e-posta onayı ve rozet, belge imzası, belge erişimi/başlıkları, onay/kaldırma, kendi başvurusunu onaylama yasağı, rol atama yetkisi, itibar +2/0/+5, moderasyon.",
  );
} finally {
  if (userIds.length) {
    const docs = await db.query(
      "SELECT document_path FROM verification_requests WHERE user_id=ANY($1::uuid[]) AND document_path IS NOT NULL",
      [userIds],
    );
    for (const d of docs.rows)
      await rm(`var/private-uploads/${d.document_path}`, { force: true });
    await db.query(
      "UPDATE questions SET accepted_answer_id=NULL WHERE author_id=ANY($1::uuid[])",
      [userIds],
    );
    await db.query("DELETE FROM answers WHERE author_id=ANY($1::uuid[])", [
      userIds,
    ]);
    await db.query("DELETE FROM questions WHERE author_id=ANY($1::uuid[])", [
      userIds,
    ]);
    await db.query(
      "DELETE FROM reputation_events WHERE user_id=ANY($1::uuid[]) OR actor_id=ANY($1::uuid[])",
      [userIds],
    );
    await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [userIds]);
  }
  for (const file of await readdir(mailDir).catch(() => []))
    if (file.includes(prefix)) await rm(`${mailDir}/${file}`, { force: true });
  await db.end();
}
