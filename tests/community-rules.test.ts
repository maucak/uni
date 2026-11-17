import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptAnswerDecision,
  buildQuestionListQuery,
  canModifyExperience,
  canVoteExperience,
  experienceAuthorStatus,
} from "../server/services/community-rules.ts";
import { experienceInputSchema, experienceLabel } from "../shared/contracts.ts";
const base = {
  communityId: null,
  tag: "",
  q: "",
  sort: "new" as const,
  limit: 50,
};
test("question list always hides hidden/deleted content", () => {
  const { text, params } = buildQuestionListQuery(base);
  assert.match(text, /q\.status='visible'/);
  assert.match(text, /a\.status='visible'/);
  assert.deepEqual(params, [50]);
});
test("question list uses Turkish full-text search, tag and community filters as parameters", () => {
  const { text, params } = buildQuestionListQuery({
    ...base,
    communityId: "c1",
    tag: "staj",
    q: "hazırlık; DROP TABLE",
  });
  assert.match(text, /q\.search @@ websearch_to_tsquery\('turkish',\$3\)/);
  assert.match(text, /q\.tags \? \$2/);
  assert.match(text, /q\.community_id=\$1/);
  assert.match(text, /ts_rank/);
  assert.ok(!text.includes("DROP"));
  assert.deepEqual(params, ["c1", "staj", "hazırlık; DROP TABLE", 50]);
});
test("unanswered sort orders by answer count first", () => {
  const { text } = buildQuestionListQuery({ ...base, sort: "unanswered" });
  assert.match(text, /ORDER BY answer_count ASC,q\.created_at DESC/);
});
test("only the question owner can accept an answer of that question", () => {
  const answer = { question_id: "q1", status: "visible" };
  assert.deepEqual(
    acceptAnswerDecision({ author_id: "u1" }, answer, "q1", "u1"),
    { ok: true },
  );
  const other = acceptAnswerDecision({ author_id: "u1" }, answer, "q1", "u2");
  assert.equal(other.ok, false);
  assert.equal(!other.ok && other.status, 403);
  const foreign = acceptAnswerDecision(
    { author_id: "u1" },
    { question_id: "q2", status: "visible" },
    "q1",
    "u1",
  );
  assert.equal(!foreign.ok && foreign.status, 404);
  const hidden = acceptAnswerDecision(
    { author_id: "u1" },
    { question_id: "q1", status: "hidden" },
    "q1",
    "u1",
  );
  assert.equal(!hidden.ok && hidden.status, 404);
});
test("experience edit and vote rules", () => {
  assert.equal(canModifyExperience("a", "a"), true);
  assert.equal(canModifyExperience("a", "b"), false);
  assert.equal(canVoteExperience("a", "a"), false);
  assert.equal(canVoteExperience("a", "b"), true);
});
test("experience author status comes from declared role; candidates cannot write", () => {
  assert.equal(experienceAuthorStatus({ role: "student" }), "student");
  assert.equal(experienceAuthorStatus({ role: "graduate" }), "graduate");
  assert.equal(experienceAuthorStatus({ role: "candidate" }), null);
});
test("experience label separates personal experience from official info", () => {
  assert.equal(experienceLabel("student", 2024), "öğrenci deneyimi · 2024");
  assert.equal(experienceLabel("graduate", 2019), "mezun deneyimi · 2019");
});
test("experience input validates topic and year range", () => {
  const ok = {
    communityId: "5b0d3b36-6c4d-4b51-9a8e-0c7a8e9b1f11",
    topic: "staj",
    experienceYear: 2024,
    title: "Staj yeri bulma",
    body: "Bu metin otuz karakterden uzun bir deneyim açıklamasıdır.",
  };
  assert.equal(experienceInputSchema.safeParse(ok).success, true);
  assert.equal(
    experienceInputSchema.safeParse({ ...ok, topic: "spor" }).success,
    false,
  );
  assert.equal(
    experienceInputSchema.safeParse({ ...ok, experienceYear: 1980 }).success,
    false,
  );
});
