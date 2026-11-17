// Migration 017 akışları: mentor profili, talep, yetki, bildirim, doğrulama kaldırma.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import pg from "pg";
const origin = process.env.WEB_ORIGIN || "http://127.0.0.1:5173";
const base = `${origin}/api/v1`;
const password = "Mentorship-check-passphrase-2026";
const prefix = randomUUID().slice(0, 8);
const userIds: string[] = [];
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const mailDir = "var/mail";
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d,
]);
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
  const options: RequestInit = {
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
  };
  let res = await fetch(base + path, options);
  // Önceki entegrasyon script'leri aynı IP kotasını kullanır. Sunucunun
  // Retry-After süresine uyarak reddedilmiş isteği yalnızca bir kez tekrarla.
  if (res.status === 429) {
    const seconds = Number(res.headers.get("retry-after"));
    if (Number.isFinite(seconds) && seconds > 0 && seconds <= 60) {
      await res.arrayBuffer();
      console.log(
        `İstek sınırı: ${seconds} saniye sonra bir kez yeniden denenecek.`,
      );
      await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000));
      res = await fetch(base + path, options);
    }
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  assert.equal(
    res.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return { data, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}
async function register(tag: string, verify = true) {
  const email = `${prefix}-${tag}@example.test`;
  const r = await call(
    "/auth/register",
    "POST",
    { email, password, displayName: `Mentorluk ${tag}` },
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
const notificationsOf = async (u: { cookie: string }) =>
  (await call("/notifications", "GET", undefined, u.cookie)).data.items as {
    kind: string;
    payload: Record<string, unknown>;
  }[];
const secret = "GİZLİ-MESAJ-METNİ bildirimde görünmemeli";
try {
  const uni = await db.query(
    "SELECT university_id FROM programs WHERE NOT is_sample LIMIT 1",
  );
  assert(uni.rowCount, "katalogda gerçek program yok (npm run catalog:pilot)");
  const universityId = uni.rows[0].university_id;
  const admin = await call("/auth/dev-login", "POST", {});
  const mentor = await register("mentor");
  const mentee = await register("mentee");
  const stranger = await register("stranger");
  const unverifiedMail = await register("nomail", false);
  const profileBody = {
    accepting: true,
    topics: ["Burs", "yurt"],
    bio: "İkinci sınıf öğrencisiyim.",
  };

  // Doğrulamasız kullanıcı mentor profili açamaz.
  const denied = await call(
    "/mentor-profile",
    "PUT",
    profileBody,
    mentor.cookie,
    403,
  );
  assert.equal(denied.data.code, "VERIFICATION_REQUIRED");
  const me0 = (
    await call("/mentor-profile/me", "GET", undefined, mentor.cookie)
  ).data;
  assert.equal(me0.eligible, false);
  assert.equal(me0.profile, null);

  // Belge başvurusu + admin onayı (verification-check.ts akışı) → profil açılır.
  const doc = await call(
    `/verifications?claim=student&universityId=${universityId}`,
    "POST",
    png,
    mentor.cookie,
    201,
    "image/png",
  );
  await call(
    `/admin/verifications/${doc.data.id}`,
    "PUT",
    { action: "approve" },
    admin.cookie,
  );
  const opened = await call(
    "/mentor-profile",
    "PUT",
    profileBody,
    mentor.cookie,
  );
  assert.equal(opened.data.universityId, universityId);
  assert.deepEqual(opened.data.topics, ["Burs", "yurt"]);
  assert.equal(opened.data.badges.length, 1);
  const other = await db.query(
    "SELECT id FROM universities WHERE id<>$1 LIMIT 1",
    [universityId],
  );
  if (other.rowCount) {
    const wrong = await call(
      "/mentor-profile",
      "PUT",
      { ...profileBody, universityId: other.rows[0].id },
      mentor.cookie,
      403,
    );
    assert.equal(wrong.data.code, "UNIVERSITY_NOT_VERIFIED");
  }

  // Keşif: rozet ve itibar ile, filtrelerle; kendini listelemez.
  const listed = (
    await call(`/mentors?universityId=${universityId}&topic=BURS`)
  ).data as any[];
  const mine = listed.find((m) => m.userId === mentor.id);
  assert(mine, "mentor keşifte görünmeli");
  assert.match(mine.badges[0].label, /öğrencisi/);
  assert.equal(typeof mine.reputation, "number");
  const none = (await call(`/mentors?topic=olmayan-konu-${prefix}`))
    .data as any[];
  assert.ok(!none.some((m) => m.userId === mentor.id));
  const own = (await call("/mentors", "GET", undefined, mentor.cookie))
    .data as any[];
  assert.ok(!own.some((m) => m.userId === mentor.id));

  // Talep ön koşulları.
  const payload = {
    mentorId: mentor.id,
    topic: "Burs başvurusu",
    message: secret,
  };
  await call("/mentorship-requests", "POST", payload, undefined, 401);
  const noMail = await call(
    "/mentorship-requests",
    "POST",
    payload,
    unverifiedMail.cookie,
    403,
  );
  assert.equal(noMail.data.code, "EMAIL_NOT_VERIFIED");
  const selfReq = await call(
    "/mentorship-requests",
    "POST",
    { ...payload, mentorId: mentor.id },
    mentor.cookie,
    400,
  );
  assert.equal(selfReq.data.code, "SELF_REQUEST");
  await call(
    "/mentorship-requests",
    "POST",
    { ...payload, mentorId: stranger.id },
    mentee.cookie,
    404,
  );

  // accepting=false olan mentora talep gönderilemez; geri açılınca gönderilir.
  await call(
    "/mentor-profile",
    "PUT",
    { ...profileBody, accepting: false },
    mentor.cookie,
  );
  const closed = await call(
    "/mentorship-requests",
    "POST",
    payload,
    mentee.cookie,
    409,
  );
  assert.equal(closed.data.code, "MENTOR_NOT_ACCEPTING");
  await call("/mentor-profile", "PUT", profileBody, mentor.cookie);

  // Aday talep gönderir; ikinci talep 409.
  const created = await call(
    "/mentorship-requests",
    "POST",
    payload,
    mentee.cookie,
    201,
  );
  const requestId = created.data.id as string;
  const dup = await call(
    "/mentorship-requests",
    "POST",
    { ...payload, topic: "Başka konu" },
    mentee.cookie,
    409,
  );
  assert.equal(dup.data.code, "OPEN_REQUEST_EXISTS");

  // Mentor bildirimi: yalnız kimlik ve başlık, mesaj metni yok.
  const incomingNote = (await notificationsOf(mentor)).find(
    (n) => n.kind === "mentorship_request",
  );
  assert(incomingNote, "mentora bildirim düşmeli");
  assert.equal(incomingNote.payload.requestId, requestId);
  assert.equal(incomingNote.payload.title, "Burs başvurusu");
  assert.ok(!JSON.stringify(incomingNote).includes("GİZLİ"));

  // Mentee kabul edemez; mentor iptal edemez; üçüncü kişi göremez.
  const menteeAccept = await call(
    `/mentorship-requests/${requestId}`,
    "PUT",
    { action: "accept" },
    mentee.cookie,
    403,
  );
  assert.equal(menteeAccept.data.code, "MENTOR_ONLY");
  await call(
    `/mentorship-requests/${requestId}`,
    "PUT",
    { action: "cancel" },
    mentor.cookie,
    403,
  );
  await call(
    `/mentorship-requests/${requestId}`,
    "PUT",
    { action: "complete" },
    mentee.cookie,
    409,
  );
  await call(
    `/mentorship-requests/${requestId}`,
    "PUT",
    { action: "accept" },
    stranger.cookie,
    404,
  );
  for (const box of ["incoming", "outgoing"])
    assert.equal(
      (
        await call(
          `/mentorship-requests?box=${box}`,
          "GET",
          undefined,
          stranger.cookie,
        )
      ).data.length,
      0,
    );
  const incoming = (
    await call(
      "/mentorship-requests?box=incoming",
      "GET",
      undefined,
      mentor.cookie,
    )
  ).data as any[];
  assert.equal(incoming[0].id, requestId);
  assert.equal(incoming[0].message, secret);
  assert.equal(incoming[0].other.userId, mentee.id);
  const outgoing = (
    await call(
      "/mentorship-requests?box=outgoing",
      "GET",
      undefined,
      mentee.cookie,
    )
  ).data as any[];
  assert.equal(outgoing[0].other.userId, mentor.id);

  // Mentor kabul eder → mentee'ye yanıt bildirimi düşer.
  await call(
    `/mentorship-requests/${requestId}`,
    "PUT",
    { action: "accept" },
    mentor.cookie,
  );
  const responseNote = (await notificationsOf(mentee)).find(
    (n) => n.kind === "mentorship_response",
  );
  assert(responseNote, "mentee'ye bildirim düşmeli");
  assert.equal(responseNote.payload.requestId, requestId);
  assert.ok(!JSON.stringify(responseNote).includes("GİZLİ"));
  const reAccept = await call(
    `/mentorship-requests/${requestId}`,
    "PUT",
    { action: "accept" },
    mentor.cookie,
    409,
  );
  assert.equal(reAccept.data.code, "INVALID_STATE");
  await call(
    `/mentorship-requests/${requestId}`,
    "PUT",
    { action: "cancel" },
    mentee.cookie,
    409,
  );

  // Tamamla (mentee); sonra yeni talep mümkün.
  await call(
    `/mentorship-requests/${requestId}`,
    "PUT",
    { action: "complete" },
    mentee.cookie,
  );
  await call(
    `/mentorship-requests/${requestId}`,
    "PUT",
    { action: "complete" },
    mentor.cookie,
    409,
  );
  const again = await call(
    "/mentorship-requests",
    "POST",
    payload,
    mentee.cookie,
    201,
  );
  await call(
    `/mentorship-requests/${again.data.id}`,
    "PUT",
    { action: "cancel" },
    mentee.cookie,
  );

  // Doğrulama kaldırılınca profil keşifte görünmez, talep alamaz, açılamaz.
  await call(
    `/admin/verifications/${doc.data.id}`,
    "PUT",
    { action: "revoke", note: "Belge geçersiz çıktı." },
    admin.cookie,
  );
  const after = (await call("/mentors")).data as any[];
  assert.ok(!after.some((m) => m.userId === mentor.id));
  await call("/mentorship-requests", "POST", payload, stranger.cookie, 404);
  await call("/mentor-profile", "PUT", profileBody, mentor.cookie, 403);

  console.log(
    "PASS: doğrulamasız profil reddi, admin onayıyla profil, rozetli keşif ve filtreler, e-posta/kendine/accepting=false reddi, ikinci açık talep 409, mentee kabul edemez, üçüncü kişi 404, kabul ve bildirimler (mesajsız), tamamlama, doğrulama kaldırılınca keşiften düşme.",
  );
} finally {
  if (userIds.length) {
    const docs = await db.query(
      "SELECT document_path FROM verification_requests WHERE user_id=ANY($1::uuid[]) AND document_path IS NOT NULL",
      [userIds],
    );
    for (const d of docs.rows)
      await rm(`var/private-uploads/${d.document_path}`, { force: true });
    await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [userIds]);
  }
  for (const file of await readdir(mailDir).catch(() => []))
    if (file.includes(prefix)) await rm(`${mailDir}/${file}`, { force: true });
  await db.end();
}
