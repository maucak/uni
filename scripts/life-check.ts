import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { useLocalDatabase } from "./environment.ts";
import { readEvents } from "../src/lib/life-stream.ts";
await useLocalDatabase();
const { pool } = await import("../server/db.ts");
const ids: string[] = [];
const base = "http://127.0.0.1:3001/api/v1";
async function call(path: string, method = "GET", body?: unknown, cookie = "") {
  const r = await fetch(base + path, {
    method,
    headers: {
      origin: "http://127.0.0.1:5173",
      "content-type": "application/json",
      cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    data: r.status === 204 ? null : await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
try {
  const status = await call("/advisor/status");
  if (status.data.configured && !process.argv.includes("--live"))
    throw new Error(
      "AI etkin. Ücretli çağrıları çalıştırmak için --live gerekir.",
    );
  async function account() {
    const r = await call("/auth/register", "POST", {
      displayName: "Geçici kontrol",
      email: `life-check-${randomUUID()}@example.invalid`,
      password: randomBytes(24).toString("hex"),
    });
    assert.equal(r.status, 201);
    ids.push(r.data.id);
    return r.cookie;
  }
  const a = await account(),
    b = await account();
  const guide = await call("/life/guide?q=yurt");
  assert.equal(guide.status, 200);
  assert.ok(guide.data.items.length);
  assert.ok(guide.data.knowledge.chunks > 50);
  const saved = await call(
    "/me/life-progress",
    "PUT",
    { steps: ["obs", "housing"] },
    a,
  );
  assert.deepEqual(saved.data.profile.lifeSteps, ["obs", "housing"]);
  const input = {
    message: "Yurt başvurusunu nasıl yapabilirim?",
    requestId: randomUUID(),
    conversationId: null,
  };
  const stream = await fetch(base + "/life/ask?stream=1", {
    method: "POST",
    headers: {
      origin: "http://127.0.0.1:5173",
      "content-type": "application/json",
      cookie: a,
    },
    body: JSON.stringify(input),
  });
  assert.equal(stream.status, 200);
  assert.ok(stream.body);
  const packets = [];
  for await (const event of readEvents(stream.body!)) packets.push(event);
  assert.ok(packets.some((p) => p.event === "sources"));
  const answer = {
    status: stream.status,
    data: packets.find((p) => p.event === "answer")?.data,
  };
  assert.ok(answer.data);
  assert.equal(answer.status, 200);
  assert.ok(answer.data.sources.some((s: any) => s.scope === "national"));
  const cid = answer.data.conversationId;
  const replay = await call("/life/ask", "POST", input, a);
  assert.deepEqual(replay.data, answer.data);
  assert.equal(
    (
      await call(
        "/life/feedback",
        "POST",
        { requestId: input.requestId, rating: 1 },
        a,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/life/feedback",
        "POST",
        { requestId: input.requestId, rating: -1 },
        b,
      )
    ).status,
    404,
  );
  const follow = await call(
    "/life/ask",
    "POST",
    {
      message: "Peki nereye başvurulur?",
      requestId: randomUUID(),
      conversationId: cid,
    },
    a,
  );
  assert.equal(follow.status, 200);
  assert.match(follow.data.retrievalQuery, /Yurt başvurusu/);
  const history = await call(`/life/conversations/${cid}`, "GET", undefined, a);
  assert.deepEqual(
    history.data.map((x: any) => x.role),
    ["user", "assistant", "user", "assistant"],
  );
  assert.equal(history.data[1].payload.feedback, 1);
  for (const method of ["GET", "DELETE"])
    assert.equal(
      (await call(`/life/conversations/${cid}`, method, undefined, b)).status,
      404,
    );
  assert.equal(
    (
      await call(
        "/life/ask",
        "POST",
        {
          message: "Bu konuşmaya eriş",
          requestId: randomUUID(),
          conversationId: cid,
        },
        b,
      )
    ).status,
    404,
  );
  const unsupported = await call(
    "/life/ask",
    "POST",
    { message: "SDÜ hazırlık muafiyet koşulları", requestId: randomUUID() },
    a,
  );
  assert.equal(unsupported.data.mode, "clarification");
  assert.equal(unsupported.data.sources.length, 0);
  const clarify = await call(
    "/life/ask",
    "POST",
    { message: "Hazırlığı atlayabilir miyim?", requestId: randomUUID() },
    a,
  );
  assert.equal(clarify.data.mode, "clarification");
  assert.match(clarify.data.answer, /bölüm/);
  assert.equal(
    (await call(`/life/conversations/${cid}`, "DELETE", undefined, a)).status,
    204,
  );
  assert.equal(
    (await call(`/life/conversations/${cid}`, "GET", undefined, a)).status,
    404,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM rag_feedback WHERE user_id=$1 AND request_key=$2",
        [ids[0], input.requestId],
      )
    ).rows[0].n,
    0,
  );
  console.log(
    "PASS: streamed sources, idempotent replay, saved progress, follow-up, institution/program scope, history, owner isolation, deletion.",
  );
} finally {
  for (const id of ids) await pool.query("DELETE FROM users WHERE id=$1", [id]);
  await pool.end();
}
