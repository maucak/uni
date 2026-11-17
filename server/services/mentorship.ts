import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  mentorProfileInput,
  mentorshipRequestInput,
} from "../../shared/mentorship.ts";
import { pool } from "../db.ts";
import { fail } from "../errors.ts";
import { isBlocked } from "./blocks.ts";
import { notify } from "./notifications.ts";
import { authorMetaSql } from "./author-meta.ts";
import { toBadges } from "./verification-rules.ts";
import { approvedUniversityIds } from "./verification.ts";
import {
  mentorshipActions,
  normalizeTopics,
  requestDecision,
  transitionDecision,
} from "./mentorship-rules.ts";
/** Onaylı (kaldırılmamış) en az bir doğrulaması olan kullanıcı. */
const verifiedSql = (col: string) =>
  `EXISTS (SELECT 1 FROM verification_requests v WHERE v.user_id=${col} AND v.status='approved')`;
const shortTitle = (t: string) => (t.length > 80 ? `${t.slice(0, 79)}…` : t);

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

export async function listMentors(
  q: {
    universityId?: string;
    programId?: string;
    topic?: string;
    limit: number;
    offset: number;
  },
  userId?: string,
) {
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
      userId ?? null,
      q.limit,
      q.offset,
    ],
  );
  return rows.rows.map(toMentor);
}
export async function getMentorProfile(id: string) {
  const profile = await pool.query(`${mentorSelect} WHERE mp.user_id=$1`, [id]);
  const universities = await pool.query(
    `SELECT DISTINCT un.id,un.name FROM verification_requests v JOIN universities un ON un.id=v.university_id
     WHERE v.user_id=$1 AND v.status='approved' ORDER BY un.name`,
    [id],
  );
  return {
    eligible: universities.rowCount! > 0,
    profile: profile.rowCount ? toMentor(profile.rows[0]) : null,
    universities: universities.rows,
  };
}
export async function saveMentorProfile(
  id: string,
  input: z.infer<typeof mentorProfileInput>,
) {
  const allowed = await approvedUniversityIds(id);
  const existing = await pool.query(
    "SELECT university_id,program_id FROM mentor_profiles WHERE user_id=$1",
    [id],
  );
  const turningOff = existing.rowCount && !input.accepting;
  if (!allowed.length && !turningOff)
    fail(
      403,
      "VERIFICATION_REQUIRED",
      "Mentor profili için önce öğrenci veya mezun doğrulaman onaylanmalı.",
    );
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
  return toMentor(profile.rows[0]);
}
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

export async function createMentorshipRequest(
  menteeId: string,
  input: z.infer<typeof mentorshipRequestInput>,
) {
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
  return { id, status: "pending" };
}
export async function listMentorshipRequests(
  me: string,
  box: "incoming" | "outgoing",
) {
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
  return rows.rows.map((r) => toRequest(r, box));
}
export async function updateMentorshipRequest(
  id: string,
  me: string,
  action: (typeof mentorshipActions)[number],
) {
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
  return { id, status: decision.to };
}
