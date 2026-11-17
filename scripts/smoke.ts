import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import pg from "pg";
const origin = process.env.WEB_ORIGIN || "http://127.0.0.1:5173";
const base = `${origin}/api/v1`;
const password = "Integration-test-passphrase-2026";
const prefix = randomUUID();
const userIds: string[] = [];
const databaseUrl =
  process.env.DATABASE_URL ||
  `postgresql://postgres:${await readFile("var/database-password", "utf8")}@127.0.0.1:${process.env.LOCAL_PG_PORT || 55432}/kampuspusula`;
const db = new pg.Pool({ connectionString: databaseUrl });
const mailDir = "var/mail";
/** var/mail altındaki en son iletiden verilen yoldaki belirteci okur. */
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
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  expected = 200,
) {
  const res = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  assert.equal(res.status, expected, JSON.stringify(data));
  return { data, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}
try {
  await request("/health");
  const first = await request(
    "/auth/register",
    "POST",
    { email: `${prefix}-a@example.test`, password, displayName: "Test A" },
    undefined,
    201,
  );
  userIds.push(first.data.id);
  const a = first.cookie!;
  const second = await request(
    "/auth/register",
    "POST",
    { email: `${prefix}-b@example.test`, password, displayName: "Test B" },
    undefined,
    201,
  );
  userIds.push(second.data.id);
  const b = second.cookie!;
  await request(
    "/auth/login",
    "POST",
    { email: `${prefix}-a@example.test`, password: "Wrong-password-123" },
    undefined,
    401,
  );
  await request(
    "/auth/register",
    "POST",
    { email: `${prefix}-a@example.test`, password, displayName: "Tekrar" },
    undefined,
    409,
  );
  const profile = {
    ...first.data.profile,
    interests: "yazılım yapay zeka",
    cities: ["İzmir"],
    language: "İngilizce",
  };
  await request("/me/profile", "PUT", profile, a);
  const catalog = (await request("/programs?scoreType=SAY")).data.items;
  assert(catalog.length >= 2);
  assert(catalog.every((p: any) => p.scoreType === "SAY"));
  const rec = (await request("/recommendations", "POST", {}, a)).data;
  assert(rec.items.length);
  assert(rec.items.every((r: any) => r.score >= 0 && r.score <= 100));
  assert.equal(rec.method, "personalized");
  const baselineRun = (
    await request("/recommendations?method=baseline", "POST", {}, a)
  ).data;
  assert.equal(baselineRun.method, "baseline");
  assert.match(baselineRun.algorithmVersion, /^baseline/);
  assert(baselineRun.items.length);
  const known = baselineRun.items.filter((r: any) => r.program.rank !== null);
  assert(
    known.every(
      (r: any, i: number) =>
        i === 0 || known[i - 1].program.rank <= r.program.rank,
    ),
  );
  assert(
    baselineRun.items.findIndex((r: any) => r.program.rank === null) === -1 ||
      baselineRun.items
        .slice(known.length)
        .every((r: any) => r.program.rank === null),
  );
  const list = (
    await request("/preference-lists", "POST", { name: "Test listesi" }, a, 201)
  ).data;
  let current = (
    await request(
      `/preference-lists/${list.id}/items`,
      "POST",
      { programId: catalog[0].id },
      a,
    )
  ).data;
  current = (
    await request(
      `/preference-lists/${list.id}/items`,
      "POST",
      { programId: catalog[0].id },
      a,
    )
  ).data;
  assert.equal(current.items.length, 1);
  current = (
    await request(
      `/preference-lists/${list.id}/items`,
      "POST",
      { programId: catalog[1].id },
      a,
    )
  ).data;
  await request(
    `/preference-lists/${list.id}/items`,
    "POST",
    { programId: catalog[1].id },
    b,
    404,
  );
  assert.equal(
    (await request("/preference-lists", "GET", undefined, b)).data.length,
    0,
  );
  const ids = current.items.map((i: any) => i.id).reverse();
  await request(
    `/preference-lists/${list.id}/order`,
    "PUT",
    { revision: current.revision - 1, ids },
    a,
    409,
  );
  await request(
    `/preference-lists/${list.id}/order`,
    "PUT",
    { revision: current.revision, ids: [ids[0], ids[0]] },
    a,
    400,
  );
  current = (
    await request(
      `/preference-lists/${list.id}/order`,
      "PUT",
      { revision: current.revision, ids },
      a,
    )
  ).data;
  assert.equal(current.items[0].id, ids[0]);
  await request(
    `/preference-lists/${list.id}/items/${ids[0]}`,
    "PATCH",
    { note: "Kalıcı araştırma notu" },
    a,
  );
  const blocked = await fetch(base + "/me/profile", {
    method: "PUT",
    headers: {
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
      Cookie: a,
    },
    body: JSON.stringify(profile),
  });
  assert.equal(blocked.status, 403);
  const communities = (await request("/communities")).data;
  const q = (
    await request(
      "/questions",
      "POST",
      {
        communityId: communities[0].id,
        title: "Entegrasyon testi sorusu",
        body: "Bu soru yalnızca otomatik entegrasyon testi için oluşturulmuştur.",
      },
      a,
      201,
    )
  ).data;
  await request(
    `/questions/${q.id}/answers`,
    "POST",
    {
      body: "İkinci test kullanıcısının gerçek API üzerinden gönderdiği yanıt.",
    },
    b,
    201,
  );
  const answer = (await request(`/questions/${q.id}`)).data.answers[0];
  await request(`/answers/${answer.id}/vote`, "PUT", undefined, b, 400);
  await request(`/answers/${answer.id}/vote`, "PUT", undefined, a);
  await request(`/answers/${answer.id}/vote`, "PUT", undefined, a);
  assert.equal(
    (await request(`/questions/${q.id}`, "GET", undefined, a)).data.answers[0]
      .votes,
    1,
  );
  // 015: kabul edilen yanıt yalnızca soru sahibinden; Türkçe tam metin arama.
  await request(
    `/questions/${q.id}/accepted-answer`,
    "PUT",
    { answerId: answer.id },
    b,
    403,
  );
  await request(
    `/questions/${q.id}/accepted-answer`,
    "PUT",
    { answerId: answer.id },
    a,
  );
  const accepted = (await request(`/questions/${q.id}`, "GET", undefined, a))
    .data;
  assert.equal(accepted.acceptedAnswerId, answer.id);
  assert.equal(accepted.answers[0].accepted, true);
  const found = (
    await request(
      `/questions?${new URLSearchParams({ communityId: communities[0].id, q: "otomatik entegrasyon" })}`,
    )
  ).data;
  assert(found.some((x: any) => x.id === q.id && x.acceptedAnswerId));
  const tagged = (
    await request(
      "/questions",
      "POST",
      {
        communityId: communities[0].id,
        title: "Etiketli yanıtsız test sorusu",
        body: "Bu soru etiket filtresi ve yanıtsız sıralaması testi içindir.",
        tags: [`t-${prefix.slice(0, 8)}`],
      },
      b,
      201,
    )
  ).data;
  const byTag = (
    await request(`/questions?tag=t-${prefix.slice(0, 8)}&sort=unanswered`)
  ).data;
  assert.deepEqual(
    byTag.map((x: any) => x.id),
    [tagged.id],
  );
  await db.query("UPDATE questions SET status='hidden' WHERE id=$1", [
    tagged.id,
  ]);
  assert.equal(
    (await request(`/questions?tag=t-${prefix.slice(0, 8)}`)).data.length,
    0,
  );
  await request(`/questions/${tagged.id}`, "GET", undefined, undefined, 404);
  const university = (await request("/communities?kind=university&limit=1"))
    .data[0];
  assert.equal(university.kind, "university");
  assert(university.universityId);
  // 015: deneyimler. Aday deneyim yazamaz; yazar durumu beyan edilen rolden gelir.
  const experience = {
    communityId: university.id,
    topic: "kampus",
    experienceYear: 2025,
    title: "Entegrasyon testi deneyimi",
    body: "Bu metin yalnızca otomatik entegrasyon testi için oluşturulmuştur.",
  };
  await request("/experiences", "POST", experience, a, 403);
  await request("/me/profile", "PUT", { ...profile, role: "student" }, a);
  const exp = (await request("/experiences", "POST", experience, a, 201)).data;
  const listed = (
    await request(`/experiences?communityId=${university.id}`)
  ).data.find((e: any) => e.id === exp.id);
  assert.equal(listed.authorStatus, "student");
  assert.equal(listed.experienceYear, 2025);
  await request(`/experiences/${exp.id}/vote`, "PUT", undefined, a, 400);
  await request(`/experiences/${exp.id}/vote`, "PUT", undefined, b);
  await request(`/experiences/${exp.id}/vote`, "PUT", undefined, b, 409);
  await request(
    `/experiences/${exp.id}`,
    "PUT",
    { title: "Başkasının düzenlemesi" },
    b,
    403,
  );
  await request(`/experiences/${exp.id}`, "DELETE", undefined, b, 403);
  const edited = (
    await request(
      `/experiences/${exp.id}`,
      "PUT",
      { title: "Düzenlenmiş test deneyimi" },
      a,
    )
  ).data;
  assert.equal(edited.title, "Düzenlenmiş test deneyimi");
  assert.equal(edited.votes, 1);
  await request(`/experiences/${exp.id}`, "DELETE", undefined, a, 204);
  assert(
    !(await request(`/experiences?communityId=${university.id}`)).data.some(
      (e: any) => e.id === exp.id,
    ),
  );
  await request("/auth/logout", "POST", {}, a, 204);
  assert.equal((await request("/me", "GET", undefined, a)).data, null);
  const login = await request("/auth/login", "POST", {
    email: `${prefix}-a@example.test`,
    password,
  });
  const persisted = (
    await request("/preference-lists", "GET", undefined, login.cookie!)
  ).data[0];
  assert.equal(persisted.items[0].note, "Kalıcı araştırma notu");
  // E-posta doğrulama: kayıt → var/mail → doğrula → tek kullanım.
  const emailA = `${prefix}-a@example.test`;
  assert.equal(first.data.emailVerified, false);
  const verifyToken = await mailToken(emailA, "/eposta-dogrula");
  const tokenRow = await db.query(
    "SELECT token_hash FROM account_tokens WHERE user_id=$1 AND purpose='verify_email'",
    [first.data.id],
  );
  assert.notEqual(tokenRow.rows[0].token_hash, verifyToken);
  await request("/auth/verify-email", "POST", { token: verifyToken });
  await request(
    "/auth/verify-email",
    "POST",
    { token: verifyToken },
    undefined,
    400,
  );
  assert.equal(
    (await request("/me", "GET", undefined, login.cookie!)).data.emailVerified,
    true,
  );
  await request("/auth/verify-email/resend", "POST", {}, login.cookie!, 409);
  await request("/auth/verify-email/resend", "POST", {}, b);
  // Parola sıfırlama: kayıtlı/kayıtsız aynı yanıt, eski oturum iptal, tek kullanım.
  const forgot = await request(
    "/auth/password/forgot",
    "POST",
    { email: emailA },
    undefined,
    202,
  );
  const unknown = await request(
    "/auth/password/forgot",
    "POST",
    { email: `${prefix}-yok@example.test` },
    undefined,
    202,
  );
  assert.deepEqual(unknown.data, forgot.data);
  const resetToken = await mailToken(emailA, "/parola-sifirla");
  const newPassword = "Reset-integration-passphrase-2026";
  await request("/auth/password/reset", "POST", {
    token: resetToken,
    password: newPassword,
  });
  await request(
    "/auth/password/reset",
    "POST",
    { token: resetToken, password: "Another-passphrase-2026" },
    undefined,
    400,
  );
  assert.equal(
    (await request("/me", "GET", undefined, login.cookie!)).data,
    null,
  );
  await request(
    "/auth/login",
    "POST",
    { email: emailA, password },
    undefined,
    401,
  );
  const relogin = await request("/auth/login", "POST", {
    email: emailA,
    password: newPassword,
  });
  // Parola değiştirme: mevcut parola gerekir, diğer oturumlar kapanır.
  const other = await request("/auth/login", "POST", {
    email: emailA,
    password: newPassword,
  });
  await request(
    "/me/password",
    "PUT",
    { currentPassword: "Wrong-password-123", newPassword: password },
    relogin.cookie!,
    400,
  );
  await request(
    "/me/password",
    "PUT",
    { currentPassword: newPassword, newPassword: password },
    relogin.cookie!,
  );
  assert.equal(
    (await request("/me", "GET", undefined, other.cookie!)).data,
    null,
  );
  assert.equal(
    (await request("/me", "GET", undefined, relogin.cookie!)).data.email,
    emailA,
  );
  console.log(
    "PASS: hesap/profil, filtre/öneri, kalıcılık, sahiplik, sıra çakışması, CSRF, soru/yanıt, yinelenen oy, kabul edilen yanıt, Türkçe arama, etiket/gizli içerik, deneyim oy/sahiplik, oturum iptali, e-posta doğrulama, parola sıfırlama/değiştirme.",
  );
} finally {
  if (userIds.length) {
    await db.query(
      "DELETE FROM experience_votes WHERE user_id=ANY($1::uuid[])",
      [userIds],
    );
    await db.query("DELETE FROM experiences WHERE author_id=ANY($1::uuid[])", [
      userIds,
    ]);
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
      "DELETE FROM recommendation_runs WHERE user_id=ANY($1::uuid[])",
      [userIds],
    );
    await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [userIds]);
  }
  for (const file of await readdir(mailDir).catch(() => []))
    if (file.includes(prefix)) await rm(`${mailDir}/${file}`, { force: true });
  await db.end();
}
