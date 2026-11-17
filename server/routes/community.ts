import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool } from "../db.ts";
import { requireUser } from "../auth.ts";
import { fail } from "../errors.ts";
import { communityKinds } from "../../shared/contracts.ts";
import {
  acceptAnswerDecision,
  buildQuestionListQuery,
  onContributionEvent,
} from "../services/community-rules.ts";
const api = Router();
const uuid = z.uuid();
api.get("/communities", async (req, res) => {
  const programId = req.query.programId
    ? uuid.parse(req.query.programId)
    : null;
  const communityId = req.query.communityId
    ? uuid.parse(req.query.communityId)
    : null;
  const universityId = req.query.universityId
    ? uuid.parse(req.query.universityId)
    : null;
  const kind = req.query.kind
    ? z.enum(communityKinds).parse(req.query.kind)
    : null;
  const search = z
    .string()
    .trim()
    .max(100)
    .parse(req.query.q || req.query.search || "");
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(500)
    .default(12)
    .parse(req.query.limit);
  const r = await pool.query(
    `SELECT c.*,
      (SELECT count(*)::int FROM questions q WHERE q.community_id=c.id AND q.status='visible') AS question_count,
      (SELECT count(*)::int FROM experiences e WHERE e.community_id=c.id AND e.status='visible') AS experience_count
     FROM communities c WHERE ($1::uuid IS NULL OR c.program_id=$1) AND ($2::uuid IS NULL OR c.id=$2)
     AND ($3::text='' OR strpos(lower(c.name),lower($3))>0) AND ($5::uuid IS NULL OR c.university_id=$5)
     AND ($6::text IS NULL OR c.kind=$6)
     ORDER BY CASE c.kind WHEN 'general' THEN 0 WHEN 'university' THEN 1 ELSE 2 END,c.name,c.id LIMIT $4`,
    [programId, communityId, search, limit, universityId, kind],
  );
  res.json(
    r.rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      questionCount: c.question_count,
      experienceCount: c.experience_count,
      programId: c.program_id,
      kind: c.kind,
      universityId: c.university_id,
    })),
  );
});
api.get("/questions", async (req, res) => {
  const communityId = req.query.communityId
    ? uuid.parse(req.query.communityId)
    : null;
  const q = z
    .string()
    .trim()
    .max(100)
    .parse(req.query.q || req.query.search || "");
  const tag = z
    .string()
    .trim()
    .max(40)
    .parse(req.query.tag || "");
  const sort = z
    .enum(["new", "unanswered"])
    .default("new")
    .parse(req.query.sort || undefined);
  const query = buildQuestionListQuery({
    communityId,
    q,
    tag,
    sort,
    limit: 50,
  });
  const r = await pool.query(query.text, query.params);
  res.json(
    r.rows.map((q) => ({
      id: q.id,
      title: q.title,
      body: q.body,
      tags: q.tags,
      author: q.author,
      createdAt: q.created_at,
      answerCount: q.answer_count,
      communityId: q.community_id,
      communityName: q.community_name,
      acceptedAnswerId: q.accepted_answer_id,
    })),
  );
});
api.post("/questions", requireUser, async (req, res) => {
  const data = z
    .object({
      communityId: uuid,
      title: z.string().trim().min(10).max(180),
      body: z.string().trim().min(20).max(5000),
      tags: z.array(z.string().trim().min(2).max(40)).max(5).default([]),
    })
    .parse(req.body);
  if (
    !(
      await pool.query("SELECT id FROM communities WHERE id=$1", [
        data.communityId,
      ])
    ).rowCount
  )
    fail(404, "NOT_FOUND", "Topluluk bulunamadı.");
  const id = randomUUID();
  await pool.query(
    "INSERT INTO questions(id,community_id,author_id,title,body,tags) VALUES($1,$2,$3,$4,$5,$6)",
    [
      id,
      data.communityId,
      res.locals.user.id,
      data.title,
      data.body,
      JSON.stringify([...new Set(data.tags)]),
    ],
  );
  res.status(201).json({ id });
});
api.get("/questions/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const q = await pool.query(
    `SELECT q.*,u.profile->>'displayName' AS author,c.name AS community_name FROM questions q JOIN users u ON u.id=q.author_id JOIN communities c ON c.id=q.community_id WHERE q.id=$1 AND q.status='visible'`,
    [id],
  );
  if (!q.rowCount) fail(404, "NOT_FOUND", "Soru bulunamadı.");
  const a = await pool.query(
    `SELECT a.*,u.profile->>'displayName' AS author,count(v.user_id)::int AS votes,bool_or(v.user_id=$2::uuid) AS voted FROM answers a JOIN users u ON u.id=a.author_id LEFT JOIN answer_votes v ON v.answer_id=a.id WHERE a.question_id=$1 AND a.status='visible' GROUP BY a.id,u.id ORDER BY (a.id=$3::uuid) DESC,a.created_at`,
    [id, res.locals.user?.id || null, q.rows[0].accepted_answer_id],
  );
  const row = q.rows[0];
  res.json({
    id: row.id,
    title: row.title,
    body: row.body,
    tags: row.tags,
    author: row.author,
    createdAt: row.created_at,
    communityName: row.community_name,
    communityId: row.community_id,
    acceptedAnswerId: row.accepted_answer_id,
    isOwner: !!res.locals.user && res.locals.user.id === row.author_id,
    answerCount: a.rowCount,
    answers: a.rows.map((a) => ({
      id: a.id,
      body: a.body,
      author: a.author,
      createdAt: a.created_at,
      votes: a.votes,
      voted: !!a.voted,
      accepted: a.id === row.accepted_answer_id,
    })),
  });
});
api.post("/questions/:id/answers", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { body } = z
    .object({ body: z.string().trim().min(10).max(5000) })
    .parse(req.body);
  if (
    !(
      await pool.query(
        "SELECT id FROM questions WHERE id=$1 AND status='visible'",
        [id],
      )
    ).rowCount
  )
    fail(404, "NOT_FOUND", "Soru bulunamadı.");
  await pool.query(
    "INSERT INTO answers(id,question_id,author_id,body) VALUES($1,$2,$3,$4)",
    [randomUUID(), id, res.locals.user.id, body],
  );
  res.status(201).json({ ok: true });
});
api.put("/answers/:id/vote", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const r = await pool.query(
    "SELECT author_id FROM answers WHERE id=$1 AND status='visible'",
    [id],
  );
  if (!r.rowCount) fail(404, "NOT_FOUND", "Yanıt bulunamadı.");
  if (r.rows[0].author_id === res.locals.user.id)
    fail(400, "SELF_VOTE", "Kendi yanıtına oy veremezsin.");
  const added = await pool.query(
    "INSERT INTO answer_votes(answer_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [id, res.locals.user.id],
  );
  if (added.rowCount)
    await onContributionEvent({
      kind: "answer_vote",
      answerId: id,
      actorId: res.locals.user.id,
    });
  res.json({ ok: true });
});
api.delete("/answers/:id/vote", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const removed = await pool.query(
    "DELETE FROM answer_votes WHERE answer_id=$1 AND user_id=$2",
    [id, res.locals.user.id],
  );
  if (removed.rowCount)
    await onContributionEvent({
      kind: "answer_unvote",
      answerId: id,
      actorId: res.locals.user.id,
    });
  res.json({ ok: true });
});
async function loadQuestionForOwner(id: string) {
  const q = await pool.query(
    "SELECT author_id,accepted_answer_id FROM questions WHERE id=$1 AND status='visible'",
    [id],
  );
  if (!q.rowCount) fail(404, "NOT_FOUND", "Soru bulunamadı.");
  return q.rows[0];
}
api.put("/questions/:id/accepted-answer", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { answerId } = z.object({ answerId: uuid }).parse(req.body);
  const question = await loadQuestionForOwner(id);
  const answer = await pool.query(
    "SELECT question_id,status FROM answers WHERE id=$1",
    [answerId],
  );
  const decision = acceptAnswerDecision(
    question,
    answer.rows[0] || null,
    id,
    res.locals.user.id,
  );
  if (!decision.ok) fail(decision.status, decision.code, decision.message);
  await pool.query("UPDATE questions SET accepted_answer_id=$2 WHERE id=$1", [
    id,
    answerId,
  ]);
  if (question.accepted_answer_id !== answerId)
    await onContributionEvent({
      kind: "answer_accepted",
      answerId,
      actorId: res.locals.user.id,
    });
  res.json({ acceptedAnswerId: answerId });
});
api.delete("/questions/:id/accepted-answer", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const question = await loadQuestionForOwner(id);
  if (question.author_id !== res.locals.user.id)
    fail(
      403,
      "FORBIDDEN",
      "Kabul edilen yanıtı yalnızca soru sahibi kaldırabilir.",
    );
  await pool.query("UPDATE questions SET accepted_answer_id=NULL WHERE id=$1", [
    id,
  ]);
  if (question.accepted_answer_id)
    await onContributionEvent({
      kind: "answer_unaccepted",
      answerId: question.accepted_answer_id,
      actorId: res.locals.user.id,
    });
  res.json({ acceptedAnswerId: null });
});

export default api;
