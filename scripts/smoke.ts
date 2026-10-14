import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
const base = "http://127.0.0.1:5173/api/v1";
const origin = "http://127.0.0.1:5173";
const password = "Integration-test-passphrase-2026";
const prefix = randomUUID();
const userIds: string[] = [];
const databaseUrl =
  process.env.DATABASE_URL ||
  `postgresql://postgres:${await readFile("var/database-password", "utf8")}@127.0.0.1:${process.env.LOCAL_PG_PORT || 55432}/kampuspusula`;
const db = new pg.Pool({ connectionString: databaseUrl });
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
  console.log(
    "PASS: hesap/profil, filtre/öneri, kalıcılık, sahiplik, sıra çakışması, CSRF, soru/yanıt, yinelenen oy ve oturum iptali.",
  );
} finally {
  if (userIds.length) {
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
  await db.end();
}
