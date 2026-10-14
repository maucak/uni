import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { useLocalDatabase } from "./environment.ts";
await useLocalDatabase();
const { pool } = await import("../server/db.ts");
const base = "http://127.0.0.1:5173/api/v1",
  origin = "http://127.0.0.1:5173";
let userId: string | undefined;
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  expected = 200,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = r.status === 204 ? null : await r.json();
  assert.equal(r.status, expected, JSON.stringify(data));
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
try {
  const real = (await call("/programs")).data;
  assert.equal(real.total, 2);
  assert(real.items.every((p: any) => !p.isSample));
  const tr = real.items.find((p: any) => p.language === "Türkçe");
  assert.equal(tr.rank, 134782);
  assert.equal(tr.history.length, 3);
  assert(tr.sources.every((s: any) => s.retrievedAt === "2026-10-14"));
  assert.equal(
    (await call("/programs?rankMax=130000&includeUnknown=false")).data.total,
    0,
  );
  assert.equal((await call("/programs?rankMax=130000")).data.total, 1);
  assert.equal(
    (await call("/programs?maxTuition=0&includeUnknown=false")).data.total,
    0,
  );
  assert.equal((await call("/programs?dataKind=sample")).data.total, 12);
  const account = await call(
    "/auth/register",
    "POST",
    {
      email: `${randomUUID()}@example.test`,
      password: "Phase-two-test-passphrase",
      displayName: "İkinci Aşama Testi",
    },
    undefined,
    201,
  );
  userId = account.data.id;
  const cookie = account.cookie!;
  const profile = {
    ...account.data.profile,
    interests: "yazılım yapay zeka",
    maxAnnualTuition: 100000,
    minimumScholarship: 50,
  };
  await call("/me/profile", "PUT", profile, cookie);
  const run = (await call("/recommendations", "POST", {}, cookie)).data;
  assert.equal(run.items.length, 2);
  assert(
    run.items.every((r: any) =>
      r.components.some(
        (c: any) => c.name === "Öğrenim ücreti" && c.value === null,
      ),
    ),
  );
  await call(
    `/recommendations/${run.id}/feedback`,
    "POST",
    { programId: tr.id, rating: 4 },
    cookie,
  );
  await call(
    `/recommendations/${run.id}/feedback`,
    "POST",
    { programId: tr.id, rating: 5 },
    cookie,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT rating FROM recommendation_feedback WHERE user_id=$1",
        [userId],
      )
    ).rows[0].rating,
    5,
  );
  const status = (await call("/advisor/status")).data;
  // Never trigger an external billable model call in this core check.
  if (!status.configured)
    await call(
      "/advisor/messages",
      "POST",
      {
        requestId: randomUUID(),
        conversationId: null,
        message: "İngilizce programları göster",
        state: {},
        baseRevision: "",
      },
      cookie,
      503,
    );
  console.log(
    "PASS: gerçek/örnek ayrımı, kaynak tarihleri, yıllık geçmiş, sıra/ücret eksik veri politikası, bütçe açıklaması, geri bildirim kalıcılığı ve AI bağlantı durumu.",
  );
} finally {
  if (userId) {
    await pool.query("DELETE FROM recommendation_feedback WHERE user_id=$1", [
      userId,
    ]);
    await pool.query("DELETE FROM recommendation_runs WHERE user_id=$1", [
      userId,
    ]);
    await pool.query("DELETE FROM users WHERE id=$1", [userId]);
  }
  await pool.end();
}
