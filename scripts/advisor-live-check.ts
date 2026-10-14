import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { useLocalDatabase } from "./environment.ts";
if (!process.argv.includes("--live"))
  throw new Error(
    "Bu komut tek bir gerçek AI isteği yapar. Çalıştırmak için --live ekleyin.",
  );
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
  const raw = await r.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`Yerel servis beklenmeyen yanıt verdi (${r.status}).`);
  }
  if (!r.ok)
    throw new Error(
      `${data?.code || r.status}: ${data?.message || "İstek başarısız"} (sağlayıcı: ${data?.providerStatus || "—"})`,
    );
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
try {
  await call("/health");
  const status = (await call("/advisor/status")).data;
  assert.equal(status.configured, true);
  const account = await call("/auth/register", "POST", {
    email: `${randomUUID()}@example.test`,
    password: "Advisor-live-test-passphrase",
    displayName: "Canlı Danışman Testi",
  });
  userId = account.data.id;
  const cookie = account.cookie!;
  const body = {
    requestId: randomUUID(),
    conversationId: null,
    message:
      "Yalnızca İngilizce eğitim veren programları görmek istiyorum. Eğitim dili filtresini İngilizce yapmayı öner.",
    state: { dataKind: "real", scoreType: "SAY" },
    baseRevision: "scoreType=SAY&dataKind=real",
    comparedIds: [],
  };
  const reply = (await call("/advisor/messages", "POST", body, cookie)).data;
  assert.equal(reply.proposedState?.language, "İngilizce");
  assert(
    reply.plan.changes.some(
      (c: any) => c.field === "language" && c.value === "İngilizce",
    ),
  );
  const cached = (await call("/advisor/messages", "POST", body, cookie)).data;
  assert.equal(cached.conversationId, reply.conversationId);
  const history = (
    await call(
      `/advisor/conversations/${reply.conversationId}`,
      "GET",
      undefined,
      cookie,
    )
  ).data;
  assert.deepEqual(
    history.map((m: any) => m.role),
    ["user", "assistant"],
  );
  await call(
    `/advisor/conversations/${reply.conversationId}`,
    "DELETE",
    undefined,
    cookie,
  );
  const stored = await pool.query(
    "SELECT response FROM advisor_requests WHERE user_id=$1",
    [userId],
  );
  assert.equal(stored.rows[0].response, null);
  console.log(
    JSON.stringify({
      result: "PASS",
      provider: reply.provider,
      model: reply.model,
      liveRequests: 1,
      proposal: "language=İngilizce",
      cachedReplay: true,
      historyOrder: true,
      deletion: true,
    }),
  );
} finally {
  if (userId) await pool.query("DELETE FROM users WHERE id=$1", [userId]);
  await pool.end();
}
