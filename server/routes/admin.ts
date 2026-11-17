import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.ts";
import { requireRole, requireUser } from "../auth.ts";
import { fail } from "../errors.ts";
import {
  roleChangeDecision,
  staffRoles,
} from "../services/verification-rules.ts";
const api = Router();
const uuid = z.uuid();
const admin = [requireUser, requireRole("admin")];
api.get("/admin/users", ...admin, async (req, res) => {
  const q = z
    .string()
    .trim()
    .max(254)
    .parse(req.query.q || "");
  const r = await pool.query(
    `SELECT id,email,profile->>'displayName' AS name,roles FROM users
     WHERE $1='' OR strpos(lower(email),lower($1))>0 OR strpos(lower(profile->>'displayName'),lower($1))>0
     ORDER BY cardinality(roles) DESC,created_at DESC LIMIT 20`,
    [q],
  );
  res.json(
    r.rows.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.name,
      roles: u.roles,
    })),
  );
});
api.put("/admin/users/:id/roles", ...admin, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { roles } = z
    .object({ roles: z.array(z.enum(staffRoles)).max(3) })
    .parse(req.body);
  const decision = roleChangeDecision(res.locals.user.id, id, roles);
  if (!decision.ok) fail(400, decision.code, decision.message);
  const r = await pool.query(
    "UPDATE users SET roles=$2::text[] WHERE id=$1 RETURNING id,roles",
    [id, decision.roles],
  );
  if (!r.rowCount) fail(404, "NOT_FOUND", "Kullanıcı bulunamadı.");
  res.json({ id, roles: r.rows[0].roles });
});
// Moderasyon: soru, yanıt ve deneyimi gizler ya da yeniden görünür yapar (silinmiş içeriğe dokunmaz).
const tables = {
  questions: "questions",
  answers: "answers",
  experiences: "experiences",
} as const;
api.put(
  "/moderation/:type/:id",
  requireUser,
  requireRole("moderator", "admin"),
  async (req, res) => {
    const type = z
      .enum(Object.keys(tables) as [keyof typeof tables])
      .parse(req.params.type);
    const id = uuid.parse(req.params.id);
    const { status } = z
      .object({ status: z.enum(["visible", "hidden"]) })
      .parse(req.body);
    const r = await pool.query(
      `UPDATE ${tables[type]} SET status=$2 WHERE id=$1 AND status<>'deleted' RETURNING id`,
      [id, status],
    );
    if (!r.rowCount) fail(404, "NOT_FOUND", "İçerik bulunamadı.");
    res.json({ id, status });
  },
);
export default api;
