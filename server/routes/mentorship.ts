import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { pool } from "../db.ts";
import { requireUser, requireVerifiedEmail } from "../auth.ts";
import { fail } from "../errors.ts";
import { isBlocked } from "../services/blocks.ts";
import { notify } from "../services/notifications.ts";
import { authorMetaSql } from "../services/author-meta.ts";
import { toBadges } from "../services/verification-rules.ts";
import {
  mentorshipActions,
  normalizeTopics,
  requestDecision,
  transitionDecision,
} from "../services/mentorship-rules.ts";
const api = Router();
const uuid = z.uuid();
const requestLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (_req, res) => `u:${res.locals.user?.id}`,
  message: {
    code: "RATE_LIMIT",
    message: "Çok fazla talep denemesi. Biraz sonra tekrar dene.",
  },
});
/** Onaylı (kaldırılmamış) en az bir doğrulaması olan kullanıcı. */
const verifiedSql = (col: string) =>
  `EXISTS (SELECT 1 FROM verification_requests v WHERE v.user_id=${col} AND v.status='approved')`;
const shortTitle = (t: string) => (t.length > 80 ? `${t.slice(0, 79)}…` : t);

const profileInput = z.object({
  accepting: z.boolean(),
  topics: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  bio: z.string().trim().max(600).default(""),
  universityId: uuid.nullable().optional(),
  programId: uuid.nullable().optional(),
});
const requestInput = z.object({
  mentorId: uuid,
  topic: z.string().trim().min(2).max(80),
  message: z.string().trim().min(10).max(1000),
});

function toMentor(r: any) {
  return {
    userId: r.user_id,
    displayName: r.name || "Kullanıcı",
    accepting: r.accepting,
    topics: r.topics,
    bio: r.bio,
    universityId: r.university_id,
    university: r.university,
    programId: r.program_id,
    program: r.program,
    badges: toBadges(r.author_badges),
    reputation: r.author_reputation,
  };
}
const mentorSelect = `SELECT mp.user_id,mp.accepting,mp.topics,mp.bio,mp.university_id,mp.program_id,
  u.profile->>'displayName' AS name,un.name AS university,pr.name AS program,${authorMetaSql("mp.user_id")}
  FROM mentor_profiles mp JOIN users u ON u.id=mp.user_id
  LEFT JOIN universities un ON un.id=mp.university_id LEFT JOIN programs pr ON pr.id=mp.program_id`;

/** Keşif: yalnızca talep kabul eden ve doğrulaması hâlâ onaylı mentorlar. */
api.get("/mentors", async (req, res) => {
  const q = z
    .object({
      universityId: uuid.optional(),
      programId: uuid.optional(),
      topic: z.string().trim().max(40).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(30),
      offset: z.coerce.number().int().min(0).max(10000).default(0),
    })
    .parse(req.query);
  const rows = await pool.query(
    `${mentorSelect}
     WHERE mp.accepting AND ${verifiedSql("mp.user_id")}
       AND ($1::uuid IS NULL OR mp.university_id=$1) AND ($2::uuid IS NULL OR mp.program_id=$2)
       AND ($3::text IS NULL OR $3='' OR EXISTS (SELECT 1 FROM unnest(mp.topics) t WHERE lower(t)=lower($3)))
       AND ($4::uuid IS NULL OR mp.user_id<>$4)
     ORDER BY author_reputation DESC, mp.updated_at DESC, mp.user_id LIMIT $5 OFFSET $6`,
    [
      q.universityId ?? null,
      q.programId ?? null,
      q.topic ?? null,
      res.locals.user?.id ?? null,
      q.limit,
      q.offset,
    ],
  );
  res.json(rows.rows.map(toMentor));
});

/** Kendi profilim, açma ön koşulu ve seçilebilecek (doğrulanmış) üniversiteler. */
api.get("/mentor-profile/me", requireUser, async (_req, res) => {
  const id = res.locals.user.id;
  const profile = await pool.query(`${mentorSelect} WHERE mp.user_id=$1`, [id]);
  const universities = await pool.query(
    `SELECT DISTINCT un.id,un.name FROM verification_requests v JOIN universities un ON un.id=v.university_id
     WHERE v.user_id=$1 AND v.status='approved' ORDER BY un.name`,
    [id],
  );
  res.json({
    eligible: universities.rowCount! > 0,
    profile: profile.rowCount ? toMentor(profile.rows[0]) : null,
    universities: universities.rows,
  });
});

/**
 * Profil oluşturma/açma onaylı doğrulama ister. Üniversite, kullanıcının onaylı
 * doğrulamalarından biri olmalıdır. Yalnızca kapatma (accepting=false) doğrulamasız da yapılabilir.
 */
api.put("/mentor-profile", requireUser, async (req, res) => {
  const id = res.locals.user.id;
  const input = profileInput.parse(req.body);
  const verified = await pool.query(
    `SELECT DISTINCT v.university_id FROM verification_requests v WHERE v.user_id=$1 AND v.status='approved'`,
    [id],
  );
  const existing = await pool.query(
    "SELECT university_id,program_id FROM mentor_profiles WHERE user_id=$1",
    [id],
  );
  const turningOff = existing.rowCount && !input.accepting;
  if (!verified.rowCount && !turningOff)
    fail(
      403,
      "VERIFICATION_REQUIRED",
      "Mentor profili için önce öğrenci veya mezun doğrulaman onaylanmalı.",
    );
  const allowed: string[] = verified.rows.map((r) => r.university_id);
  let universityId =
    input.universityId === undefined
      ? (existing.rows[0]?.university_id ?? allowed[0] ?? null)
      : input.universityId;
  if (universityId && !allowed.includes(universityId) && !turningOff)
    fail(
      403,
      "UNIVERSITY_NOT_VERIFIED",
      "Yalnızca doğrulanmış olduğun üniversiteyi seçebilirsin.",
    );
  let programId =
    input.programId === undefined
      ? universityId === existing.rows[0]?.university_id
        ? (existing.rows[0]?.program_id ?? null)
        : null
      : input.programId;
  if (programId) {
    const ok = await pool.query(
      "SELECT 1 FROM programs WHERE id=$1 AND university_id=$2",
      [programId, universityId],
    );
    if (!ok.rowCount)
      fail(404, "NOT_FOUND", "Program bu üniversitede bulunamadı.");
  }
  await pool.query(
    `INSERT INTO mentor_profiles(user_id,accepting,topics,bio,university_id,program_id)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id) DO UPDATE SET accepting=$2,topics=$3,bio=$4,university_id=$5,program_id=$6,updated_at=now()`,
    [
      id,
      input.accepting,
      normalizeTopics(input.topics),
      input.bio,
      universityId,
      programId,
    ],
  );
  const profile = await pool.query(`${mentorSelect} WHERE mp.user_id=$1`, [id]);
  res.json(toMentor(profile.rows[0]));
});

function toRequest(r: any, box: "incoming" | "outgoing") {
  return {
    id: r.id,
    box,
    topic: r.topic,
    message: r.message,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    respondedAt: r.responded_at ? new Date(r.responded_at).toISOString() : null,
    other: {
      userId: r.other_id,
      displayName: r.other_name || "Kullanıcı",
      badges: toBadges(r.author_badges),
      reputation: r.author_reputation,
    },
  };
}

api.post(
  "/mentorship-requests",
  requireUser,
  requireVerifiedEmail,
  requestLimit,
  async (req, res) => {
    const menteeId = res.locals.user.id;
    const input = requestInput.parse(req.body);
    const mentor = await pool.query(
      `SELECT mp.accepting FROM mentor_profiles mp WHERE mp.user_id=$1 AND ${verifiedSql("mp.user_id")}`,
      [input.mentorId],
    );
    const decision = requestDecision({
      menteeId,
      mentorId: input.mentorId,
      mentorListed: !!mentor.rowCount,
      accepting: !!mentor.rows[0]?.accepting,
      blocked:
        input.mentorId !== menteeId &&
        (await isBlocked(menteeId, input.mentorId)),
    });
    if (!decision.ok) fail(decision.status, decision.code, decision.message);
    const id = randomUUID();
    try {
      await pool.query(
        "INSERT INTO mentorship_requests(id,mentee_id,mentor_id,topic,message) VALUES($1,$2,$3,$4,$5)",
        [id, menteeId, input.mentorId, input.topic, input.message],
      );
    } catch (e: any) {
      if (e?.code === "23505")
        fail(
          409,
          "OPEN_REQUEST_EXISTS",
          "Bu mentorla zaten açık bir talebin var.",
        );
      throw e;
    }
    // Bildirim yalnızca talep kimliği ve konu başlığını taşır; mesaj metni asla.
    await notify(
      input.mentorId,
      "mentorship_request",
      { requestId: id, title: shortTitle(input.topic) },
      menteeId,
    );
    res.status(201).json({ id, status: "pending" });
  },
);

api.get("/mentorship-requests", requireUser, async (req, res) => {
  const { box } = z
    .object({ box: z.enum(["incoming", "outgoing"]).default("incoming") })
    .parse(req.query);
  const me = res.locals.user.id;
  const [own, other] =
    box === "incoming"
      ? ["mentor_id", "mentee_id"]
      : ["mentee_id", "mentor_id"];
  const rows = await pool.query(
    `SELECT r.*,r.${other} AS other_id,u.profile->>'displayName' AS other_name,${authorMetaSql(`r.${other}`)}
     FROM mentorship_requests r JOIN users u ON u.id=r.${other}
     WHERE r.${own}=$1 ORDER BY r.created_at DESC,r.id LIMIT 100`,
    [me],
  );
  res.json(rows.rows.map((r) => toRequest(r, box)));
});

api.put("/mentorship-requests/:id", requireUser, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { action } = z
    .object({ action: z.enum(mentorshipActions as [string, ...string[]]) })
    .parse(req.body);
  const me = res.locals.user.id;
  const found = await pool.query(
    "SELECT id,mentee_id,mentor_id,topic,status FROM mentorship_requests WHERE id=$1",
    [id],
  );
  if (!found.rowCount) fail(404, "NOT_FOUND", "Talep bulunamadı.");
  const row = found.rows[0];
  const decision = transitionDecision(
    { menteeId: row.mentee_id, mentorId: row.mentor_id, status: row.status },
    me,
    action as (typeof mentorshipActions)[number],
  );
  if (!decision.ok) fail(decision.status, decision.code, decision.message);
  // Eşzamanlı değişime karşı: yalnızca beklenen durumdaysa güncelle.
  const updated = await pool.query(
    `UPDATE mentorship_requests SET status=$2,
       responded_at=CASE WHEN $2 IN ('accepted','declined') THEN now() ELSE responded_at END
     WHERE id=$1 AND status=$3`,
    [id, decision.to, decision.from],
  );
  if (!updated.rowCount)
    fail(409, "INVALID_STATE", "Talebin mevcut durumunda bu işlem yapılamaz.");
  if (decision.to === "accepted" || decision.to === "declined")
    await notify(
      row.mentee_id,
      "mentorship_response",
      { requestId: id, title: shortTitle(row.topic) },
      me,
    );
  res.json({ id, status: decision.to });
});
export default api;
