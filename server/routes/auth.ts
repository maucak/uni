import { Router } from "express";
import { z } from "zod";
import { randomBytes, randomUUID } from "node:crypto";
import { pool, transaction } from "../db.ts";
import { requireUser } from "../auth.ts";
import { fail } from "../errors.ts";
const api = Router();
const uuid = z.uuid();
import { rateLimit } from "express-rate-limit";
import {
  hashPassword,
  verifyPassword,
  userFromRow,
  createSession,
} from "../auth.ts";
import { profileSchema, defaultProfile } from "../../shared/contracts.ts";
const authLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    code: "RATE_LIMIT",
    message: "Çok fazla giriş denemesi. Daha sonra tekrar dene.",
  },
});
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(10, "Parola en az 10 karakter olmalı.").max(128),
});
// Explicit development launcher flag; never enabled by the production server.
if (
  (process.argv.includes("--dev-login") ||
    process.env.npm_lifecycle_event === "dev:api") &&
  process.env.NODE_ENV !== "production"
) {
  api.post("/auth/dev-login", authLimit, async (_req, res) => {
    const profile = {
      ...defaultProfile,
      displayName: "Geliştirme Hesabı",
      rank: 120000,
      interests: "Bilgisayar, yazılım geliştirme, yapay zekâ ve teknoloji",
      cities: ["Isparta"],
    };
    const result = await pool.query(
      `INSERT INTO users(id,email,password_hash,profile) VALUES($1,$2,$3,$4)
       ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING *`,
      [
        randomUUID(),
        "developer@kampuspusula.invalid",
        await hashPassword(randomBytes(32).toString("hex")),
        JSON.stringify(profile),
      ],
    );
    await createSession(res, result.rows[0].id);
    res.json(userFromRow(result.rows[0]));
  });
}
api.post("/auth/register", authLimit, async (req, res) => {
  const data = credentials
    .extend({ displayName: z.string().trim().min(2).max(80) })
    .parse(req.body);
  const id = randomUUID();
  try {
    const r = await pool.query(
      "INSERT INTO users(id,email,password_hash,profile) VALUES($1,$2,$3,$4) RETURNING *",
      [
        id,
        data.email,
        await hashPassword(data.password),
        JSON.stringify({ ...defaultProfile, displayName: data.displayName }),
      ],
    );
    await createSession(res, id);
    res.status(201).json(userFromRow(r.rows[0]));
  } catch (e) {
    if ((e as any).code === "23505")
      fail(409, "EMAIL_EXISTS", "Bu e-posta zaten kayıtlı.");
    throw e;
  }
});
api.post("/auth/login", authLimit, async (req, res) => {
  const data = credentials.parse(req.body);
  const r = await pool.query("SELECT * FROM users WHERE email=$1", [
    data.email,
  ]);
  if (
    !r.rowCount ||
    !(await verifyPassword(data.password, r.rows[0].password_hash))
  )
    fail(401, "INVALID_CREDENTIALS", "E-posta veya parola yanlış.");
  await createSession(res, r.rows[0].id);
  res.json(userFromRow(r.rows[0]));
});
api.post("/auth/logout", async (_req, res) => {
  if (res.locals.sessionId)
    await pool.query("DELETE FROM sessions WHERE id=$1", [
      res.locals.sessionId,
    ]);
  res.clearCookie("kp_session", { path: "/" });
  res.status(204).end();
});
api.get("/me", (_req, res) => {
  res.json(res.locals.user || null);
});
api.put("/me/profile", requireUser, async (req, res) => {
  const profile = profileSchema.parse(req.body);
  await pool.query("UPDATE users SET profile=$1 WHERE id=$2", [
    JSON.stringify(profile),
    res.locals.user.id,
  ]);
  res.json({ ...res.locals.user, profile });
});

export default api;
