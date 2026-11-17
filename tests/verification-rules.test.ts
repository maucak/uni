import test from "node:test";
import assert from "node:assert/strict";
import {
  badgeLabel,
  detectDocumentType,
  documentExpired,
  domainMatches,
  emailDomain,
  parseEmailList,
  reputationEventFor,
  reviewDecision,
  roleChangeDecision,
} from "../server/services/verification-rules.ts";
import { canModifyExperience } from "../server/services/community-rules.ts";

test("domain matching accepts exact domain and dot-separated subdomains", () => {
  assert.equal(domainMatches("sdu.edu.tr", "sdu.edu.tr"), true);
  assert.equal(domainMatches("ogr.sdu.edu.tr", "sdu.edu.tr"), true);
  assert.equal(domainMatches("OGR.SDU.EDU.TR", "sdu.edu.tr"), true);
});
test("domain matching rejects lookalike and suffix-only domains", () => {
  assert.equal(domainMatches("kotusdu.edu.tr", "sdu.edu.tr"), false);
  assert.equal(domainMatches("sdu.edu.tr.evil.com", "sdu.edu.tr"), false);
  assert.equal(domainMatches("edu.tr", "sdu.edu.tr"), false);
  assert.equal(domainMatches("xpau.edu.tr", "pau.edu.tr"), false);
});
test("email domain extraction is strict", () => {
  assert.equal(emailDomain("Ali@Ogr.Sdu.Edu.Tr"), "ogr.sdu.edu.tr");
  assert.equal(emailDomain("a@b@sdu.edu.tr"), null);
  assert.equal(emailDomain("@sdu.edu.tr"), null);
  assert.equal(emailDomain("a@localhost"), null);
});
test("file signature detection ignores extension and reads bytes", () => {
  const pdf = Buffer.from("%PDF-1.7\n...");
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  assert.deepEqual(detectDocumentType(pdf), {
    mime: "application/pdf",
    ext: "pdf",
  });
  assert.deepEqual(detectDocumentType(jpg), { mime: "image/jpeg", ext: "jpg" });
  assert.deepEqual(detectDocumentType(png), { mime: "image/png", ext: "png" });
  assert.equal(detectDocumentType(Buffer.from("<html><script>")), null);
  assert.equal(detectDocumentType(Buffer.from("%PD")), null);
  assert.equal(detectDocumentType(Buffer.from([0x89, 0x50, 0x4e, 0x47])), null);
  assert.equal(detectDocumentType(Buffer.alloc(0)), null);
});
test("reputation v1: vote +2, undo -2, no double counting", () => {
  assert.deepEqual(reputationEventFor("answer_vote", "author", "voter", 0), {
    kind: "answer_vote",
    sourceType: "answer",
    delta: 2,
  });
  assert.equal(reputationEventFor("answer_vote", "author", "voter", 2), null);
  assert.equal(
    reputationEventFor("answer_unvote", "author", "voter", 2)?.delta,
    -2,
  );
  assert.equal(reputationEventFor("answer_unvote", "author", "voter", 0), null);
});
test("reputation v1: accepted +5, experience vote +1, self vote none", () => {
  assert.equal(
    reputationEventFor("answer_accepted", "a", "owner", 0)?.delta,
    5,
  );
  assert.equal(
    reputationEventFor("answer_unaccepted", "a", "owner", 5)?.delta,
    -5,
  );
  assert.equal(reputationEventFor("experience_vote", "a", "b", 0)?.delta, 1);
  assert.equal(reputationEventFor("experience_unvote", "a", "b", 1)?.delta, -1);
  assert.equal(reputationEventFor("answer_vote", "same", "same", 0), null);
  assert.equal(reputationEventFor("answer_accepted", "same", "same", 0), null);
  assert.equal(reputationEventFor("unknown", "a", "b", 0), null);
});
test("reviewers cannot decide their own request; states are enforced", () => {
  const pending = { user_id: "u", status: "pending", method: "document" };
  assert.equal(reviewDecision(pending, "u", "approve").ok, false);
  assert.deepEqual(reviewDecision(pending, "r", "approve"), {
    ok: true,
    status: "approved",
  });
  assert.equal(reviewDecision(pending, "r", "revoke").ok, false);
  assert.deepEqual(
    reviewDecision({ ...pending, status: "approved" }, "r", "revoke"),
    { ok: true, status: "revoked" },
  );
  assert.equal(
    reviewDecision({ ...pending, method: "institution_email" }, "r", "approve")
      .ok,
    false,
  );
});
test("admin cannot remove own admin role; roles are normalized", () => {
  assert.equal(roleChangeDecision("a", "a", ["reviewer"]).ok, false);
  assert.deepEqual(
    roleChangeDecision("a", "b", ["admin", "reviewer", "admin"]),
    {
      ok: true,
      roles: ["reviewer", "admin"],
    },
  );
});
test("admin email list, moderator delete, retention and badge scope", () => {
  assert.deepEqual(parseEmailList(" A@x.tr, ,b@y.tr,a@x.tr,bad"), [
    "a@x.tr",
    "b@y.tr",
  ]);
  assert.equal(canModifyExperience("a", "m", ["moderator"]), true);
  assert.equal(canModifyExperience("a", "r", ["reviewer"]), false);
  const now = new Date("2026-12-31T00:00:00Z");
  assert.equal(documentExpired(new Date("2026-12-01T00:00:00Z"), now), true);
  assert.equal(documentExpired(new Date("2026-12-15T00:00:00Z"), now), false);
  assert.equal(documentExpired(null, now), false);
  assert.equal(
    badgeLabel({
      claim: "student",
      method: "institution_email",
      university: "Pamukkale Üniversitesi",
      program: null,
    }),
    "Pamukkale Üniversitesi öğrencisi (kurumsal e-posta)",
  );
});
