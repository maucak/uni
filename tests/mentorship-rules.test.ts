import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTopics,
  requestDecision,
  transitionDecision,
  type MentorshipAction,
} from "../server/services/mentorship-rules.ts";

const req = (status: string) => ({
  menteeId: "mentee",
  mentorId: "mentor",
  status,
});
const base = {
  menteeId: "mentee",
  mentorId: "mentor",
  mentorListed: true,
  accepting: true,
  blocked: false,
};

test("mentor kabul ve ret eder; yalnızca beklemedeki talepte", () => {
  assert.deepEqual(transitionDecision(req("pending"), "mentor", "accept"), {
    ok: true,
    from: "pending",
    to: "accepted",
  });
  const declined = transitionDecision(req("pending"), "mentor", "decline");
  assert.ok(declined.ok && declined.to === "declined");
  for (const s of ["accepted", "declined", "cancelled", "completed"])
    for (const a of ["accept", "decline"] as const) {
      const r = transitionDecision(req(s), "mentor", a);
      assert.ok(!r.ok && r.status === 409 && r.code === "INVALID_STATE");
    }
});

test("mentee kabul veya ret edemez, mentor iptal edemez", () => {
  for (const a of ["accept", "decline"] as const) {
    const r = transitionDecision(req("pending"), "mentee", a);
    assert.ok(!r.ok && r.status === 403 && r.code === "MENTOR_ONLY");
  }
  const cancel = transitionDecision(req("pending"), "mentor", "cancel");
  assert.ok(
    !cancel.ok && cancel.status === 403 && cancel.code === "MENTEE_ONLY",
  );
  const ok = transitionDecision(req("pending"), "mentee", "cancel");
  assert.ok(ok.ok && ok.to === "cancelled");
});

test("tamamlama iki taraftan da yapılır ama yalnızca kabul edilmişten", () => {
  for (const actor of ["mentor", "mentee"]) {
    const r = transitionDecision(req("accepted"), actor, "complete");
    assert.ok(r.ok && r.to === "completed");
  }
  for (const s of ["pending", "declined", "cancelled", "completed"]) {
    const r = transitionDecision(req(s), "mentee", "complete");
    assert.ok(!r.ok && r.status === 409);
  }
  const late = transitionDecision(req("accepted"), "mentee", "cancel");
  assert.ok(!late.ok && late.status === 409);
});

test("taraf olmayan her eylemde 404 alır", () => {
  for (const a of [
    "accept",
    "decline",
    "cancel",
    "complete",
  ] as MentorshipAction[]) {
    const r = transitionDecision(req("accepted"), "stranger", a);
    assert.ok(!r.ok && r.status === 404);
  }
});

test("bilinmeyen eylem reddedilir", () => {
  const r = transitionDecision(req("pending"), "mentor", "reopen" as never);
  assert.ok(!r.ok && r.status === 400);
});

test("talep gönderme kuralları", () => {
  assert.deepEqual(requestDecision(base), { ok: true });
  const self = requestDecision({ ...base, mentorId: "mentee" });
  assert.ok(!self.ok && self.code === "SELF_REQUEST");
  const hidden = requestDecision({ ...base, mentorListed: false });
  assert.ok(!hidden.ok && hidden.status === 404);
  const closed = requestDecision({ ...base, accepting: false });
  assert.ok(!closed.ok && closed.status === 409);
  const blocked = requestDecision({ ...base, blocked: true });
  assert.ok(!blocked.ok && blocked.status === 403);
});

test("konu etiketleri normalleştirilir", () => {
  assert.deepEqual(
    normalizeTopics([" Burs ", "burs", "", "Yurt  ve barınma", "BURS"]),
    ["Burs", "Yurt ve barınma"],
  );
  assert.equal(
    normalizeTopics(Array.from({ length: 12 }, (_, i) => `k${i}`)).length,
    8,
  );
});
