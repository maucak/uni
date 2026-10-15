import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../db.ts";
import { requireUser } from "../auth.ts";
import { fail } from "../errors.ts";
const api = Router();
const uuid = z.uuid();
api.get("/communities", async (req, res) => {
  const programId = req.query.programId
    ? uuid.parse(req.query.programId)
    : null;
  const communityId = req.query.communityId
    ? uuid.parse(req.query.communityId)
    : null;
  const search = z
    .string()
    .trim()
    .max(100)
    .parse(req.query.search || "");
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(500)
    .default(12)
    .parse(req.query.limit);
  const r = await pool.query(
    "SELECT c.*,count(q.id)::int AS question_count FROM communities c LEFT JOIN questions q ON q.community_id=c.id WHERE ($1::uuid IS NULL OR c.program_id=$1) AND ($2::uuid IS NULL OR c.id=$2) AND ($3::text='' OR strpos(lower(c.name),lower($3))>0) GROUP BY c.id ORDER BY c.name,c.id LIMIT $4",
    [programId, communityId, search, limit],
  );
  res.json(
    r.rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      questionCount: c.question_count,
      programId: c.program_id,
    })),
  );
});
api.get("/questions", async (req, res) => {
  const communityId = req.query.communityId
    ? uuid.parse(req.query.communityId)
    : null;
  const search = z
    .string()
    .trim()
    .max(100)
    .parse(req.query.search || "");
  const tag = z
    .string()
    .trim()
    .max(40)
    .parse(req.query.tag || "");
  const r = await pool.query(
    `SELECT q.*,u.profile->>'displayName' AS author,c.name AS community_name,count(a.id)::int AS answer_count FROM questions q JOIN users u ON u.id=q.author_id JOIN communities c ON c.id=q.community_id LEFT JOIN answers a ON a.question_id=q.id WHERE ($1::uuid IS NULL OR q.community_id=$1) AND ($2::text='' OR strpos(lower(q.title || ' ' || q.body),lower($2))>0) AND ($3::text='' OR q.tags ? $3) GROUP BY q.id,u.id,c.id ORDER BY q.created_at DESC LIMIT 50`,
    [communityId, search, tag],
  );
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
    `SELECT q.*,u.profile->>'displayName' AS author,c.name AS community_name FROM questions q JOIN users u ON u.id=q.author_id JOIN communities c ON c.id=q.community_id WHERE q.id=$1`,
    [id],
  );
  if (!q.rowCount) fail(404, "NOT_FOUND", "Soru bulunamadı.");
  const a = await pool.query(
    `SELECT a.*,u.profile->>'displayName' AS author,count(v.user_id)::int AS votes,bool_or(v.user_id=$2::uuid) AS voted FROM answers a JOIN users u ON u.id=a.author_id LEFT JOIN answer_votes v ON v.answer_id=a.id WHERE a.question_id=$1 GROUP BY a.id,u.id ORDER BY a.created_at`,
    [id, res.locals.user?.id || null],
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
    answers: a.rows.map((a) => ({
      id: a.id,
      body: a.body,
      author: a.author,
      createdAt: a.created_at,
      votes: a.votes,
      voted: !!a.voted,
    })),
  });
});
api.post("/questions/:id/answers", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { body } = z
    .object({ body: z.string().trim().min(10).max(5000) })
    .parse(req.body);
  if (
    !(await pool.query("SELECT id FROM questions WHERE id=$1", [id])).rowCount
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
  const r = await pool.query("SELECT author_id FROM answers WHERE id=$1", [id]);
  if (!r.rowCount) fail(404, "NOT_FOUND", "Yanıt bulunamadı.");
  if (r.rows[0].author_id === res.locals.user.id)
    fail(400, "SELF_VOTE", "Kendi yanıtına oy veremezsin.");
  await pool.query(
    "INSERT INTO answer_votes(answer_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [id, res.locals.user.id],
  );
  res.json({ ok: true });
});
api.delete("/answers/:id/vote", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  await pool.query(
    "DELETE FROM answer_votes WHERE answer_id=$1 AND user_id=$2",
    [id, res.locals.user.id],
  );
  res.json({ ok: true });
});

export default api;
