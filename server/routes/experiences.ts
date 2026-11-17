import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool } from "../db.ts";
import { requireUser } from "../auth.ts";
import { fail } from "../errors.ts";
import {
  experienceInputSchema,
  experienceTopics,
  experienceUpdateSchema,
} from "../../shared/contracts.ts";
import {
  canModifyExperience,
  canVoteExperience,
  experienceAuthorStatus,
  onContributionEvent,
} from "../services/community-rules.ts";
const api = Router();
const uuid = z.uuid();
function toExperience(e: any, userId: string | null) {
  return {
    id: e.id,
    communityId: e.community_id,
    communityName: e.community_name,
    programId: e.program_id,
    topic: e.topic,
    experienceYear: e.experience_year,
    authorStatus: e.author_status,
    title: e.title,
    body: e.body,
    author: e.author,
    mine: !!userId && e.author_id === userId,
    votes: e.votes,
    voted: !!e.voted,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  };
}
const select = `SELECT e.*,u.profile->>'displayName' AS author,c.name AS community_name,
  (SELECT count(*)::int FROM experience_votes v WHERE v.experience_id=e.id) AS votes,
  EXISTS(SELECT 1 FROM experience_votes v WHERE v.experience_id=e.id AND v.user_id=$1::uuid) AS voted
  FROM experiences e JOIN users u ON u.id=e.author_id JOIN communities c ON c.id=e.community_id`;
async function loadVisible(id: string) {
  const r = await pool.query(
    "SELECT author_id FROM experiences WHERE id=$1 AND status='visible'",
    [id],
  );
  if (!r.rowCount) fail(404, "NOT_FOUND", "Deneyim bulunamadı.");
  return r.rows[0] as { author_id: string };
}
api.get("/experiences", async (req, res) => {
  const f = z
    .object({
      communityId: uuid.optional(),
      programId: uuid.optional(),
      topic: z.enum(experienceTopics).optional(),
    })
    .parse({
      communityId: req.query.communityId || undefined,
      programId: req.query.programId || undefined,
      topic: req.query.topic || undefined,
    });
  const userId = res.locals.user?.id || null;
  const r = await pool.query(
    `${select} WHERE e.status='visible' AND ($2::uuid IS NULL OR e.community_id=$2)
     AND ($3::uuid IS NULL OR e.program_id=$3) AND ($4::text IS NULL OR e.topic=$4)
     ORDER BY e.created_at DESC,e.id LIMIT 50`,
    [userId, f.communityId || null, f.programId || null, f.topic || null],
  );
  res.json(r.rows.map((e) => toExperience(e, userId)));
});
api.post("/experiences", requireUser, async (req, res) => {
  const data = experienceInputSchema.parse(req.body);
  const user = res.locals.user;
  const authorStatus = experienceAuthorStatus(user.profile);
  if (!authorStatus)
    fail(
      403,
      "ROLE_REQUIRED",
      "Deneyim paylaşmak için profilinde öğrenci veya mezun olduğunu belirt.",
    );
  if (data.experienceYear > new Date().getFullYear())
    fail(400, "VALIDATION", "Deneyim yılı gelecekte olamaz.");
  const c = await pool.query("SELECT program_id FROM communities WHERE id=$1", [
    data.communityId,
  ]);
  if (!c.rowCount) fail(404, "NOT_FOUND", "Topluluk bulunamadı.");
  const programId = c.rows[0].program_id || data.programId;
  if (
    programId &&
    !(await pool.query("SELECT 1 FROM programs WHERE id=$1", [programId]))
      .rowCount
  )
    fail(404, "NOT_FOUND", "Program bulunamadı.");
  const id = randomUUID();
  await pool.query(
    `INSERT INTO experiences(id,community_id,author_id,program_id,topic,experience_year,author_status,title,body)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      data.communityId,
      user.id,
      programId,
      data.topic,
      data.experienceYear,
      authorStatus,
      data.title,
      data.body,
    ],
  );
  res.status(201).json({ id });
});
api.put("/experiences/:id", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const data = experienceUpdateSchema.parse(req.body);
  const e = await loadVisible(id);
  if (!canModifyExperience(e.author_id, res.locals.user.id))
    fail(403, "FORBIDDEN", "Bu deneyimi yalnızca yazarı düzenleyebilir.");
  if (data.experienceYear && data.experienceYear > new Date().getFullYear())
    fail(400, "VALIDATION", "Deneyim yılı gelecekte olamaz.");
  await pool.query(
    `UPDATE experiences SET topic=COALESCE($2,topic),experience_year=COALESCE($3,experience_year),
     title=COALESCE($4,title),body=COALESCE($5,body),updated_at=now() WHERE id=$1`,
    [
      id,
      data.topic ?? null,
      data.experienceYear ?? null,
      data.title ?? null,
      data.body ?? null,
    ],
  );
  const r = await pool.query(`${select} WHERE e.id=$2`, [
    res.locals.user.id,
    id,
  ]);
  res.json(toExperience(r.rows[0], res.locals.user.id));
});
api.delete("/experiences/:id", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const e = await loadVisible(id);
  // Moderatör yetkisi migration 016 (users.roles) ile eklenecek.
  if (!canModifyExperience(e.author_id, res.locals.user.id))
    fail(403, "FORBIDDEN", "Bu deneyimi yalnızca yazarı silebilir.");
  await pool.query(
    "UPDATE experiences SET status='deleted',updated_at=now() WHERE id=$1",
    [id],
  );
  res.status(204).end();
});
api.put("/experiences/:id/vote", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const e = await loadVisible(id);
  if (!canVoteExperience(e.author_id, res.locals.user.id))
    fail(400, "SELF_VOTE", "Kendi deneyimine oy veremezsin.");
  const added = await pool.query(
    "INSERT INTO experience_votes(experience_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [id, res.locals.user.id],
  );
  if (!added.rowCount)
    fail(409, "DUPLICATE_VOTE", "Bu deneyime zaten oy verdin.");
  await onContributionEvent({
    kind: "experience_vote",
    experienceId: id,
    actorId: res.locals.user.id,
  });
  res.json({ ok: true });
});
api.delete("/experiences/:id/vote", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const removed = await pool.query(
    "DELETE FROM experience_votes WHERE experience_id=$1 AND user_id=$2",
    [id, res.locals.user.id],
  );
  if (removed.rowCount)
    await onContributionEvent({
      kind: "experience_unvote",
      experienceId: id,
      actorId: res.locals.user.id,
    });
  res.json({ ok: true });
});
export default api;
