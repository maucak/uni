import { Router } from "express";
import { z } from "zod";
import { randomBytes, randomUUID } from "node:crypto";
import { pool, transaction } from "../db.ts";
import { requireUser } from "../auth.ts";
import { fail } from "../errors.ts";
const api = Router();
const uuid = z.uuid();
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { PoolClient } from "pg";
import { issueToken, consumeToken } from "../services/account-tokens.ts";
import { sendMail } from "../services/mail.ts";
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
const tightLimit = (limit: number, keyed: "ip" | "email" | "user") =>
  rateLimit({
    windowMs: 15 * 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req, res) =>
      keyed === "user"
        ? `u:${res.locals.user?.id}`
        : keyed === "email"
          ? `${ipKeyGenerator(req.ip || "")}:${String(req.body?.email || "")
              .trim()
              .toLowerCase()}`
          : ipKeyGenerator(req.ip || ""),
    message: {
      code: "RATE_LIMIT",
      message: "Çok fazla deneme. Biraz sonra tekrar dene.",
    },
  });
// Parola sıfırlama yollarında sıkı sınırlar: adres başına ve IP başına.
const forgotPerEmail = tightLimit(3, "email");
const forgotPerIp = tightLimit(10, "ip");
const resetLimit = tightLimit(10, "ip");
const resendLimit = tightLimit(3, "user");
const webOrigin = process.env.WEB_ORIGIN || "http://127.0.0.1:5173";
const password = z
  .string()
  .min(10, "Parola en az 10 karakter olmalı.")
  .max(128);
const tokenInput = z.string().trim().min(20).max(200);
const invalidToken = () =>
  fail(
    400,
    "TOKEN_INVALID",
    "Bağlantı geçersiz, süresi dolmuş ya da daha önce kullanılmış.",
  );
async function sendVerification(
  client: PoolClient,
  user: { id: string; email: string },
) {
  const token = await issueToken(client, user.id, "verify_email");
  await sendMail({
    to: user.email,
    subject: "KampüsPusula e-posta doğrulama",
    text: `E-posta adresini doğrulamak için bu bağlantıyı aç (24 saat geçerli, tek kullanımlık):\n${webOrigin}/eposta-dogrula?token=${token}\n\nBu hesabı sen oluşturmadıysan bu iletiyi yok sayabilirsin.`,
  });
}
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
  password,
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
      `INSERT INTO users(id,email,password_hash,profile,email_verified_at) VALUES($1,$2,$3,$4,now())
       ON CONFLICT(email) DO UPDATE SET email_verified_at=COALESCE(users.email_verified_at,now()) RETURNING *`,
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
  const passwordHash = await hashPassword(data.password);
  try {
    const r = await transaction(async (client) => {
      const r = await client.query(
        "INSERT INTO users(id,email,password_hash,profile) VALUES($1,$2,$3,$4) RETURNING *",
        [
          id,
          data.email,
          passwordHash,
          JSON.stringify({ ...defaultProfile, displayName: data.displayName }),
        ],
      );
      await sendVerification(client, r.rows[0]);
      return r;
    });
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
api.post("/auth/verify-email", resetLimit, async (req, res) => {
  const { token } = z.object({ token: tokenInput }).parse(req.body);
  await transaction(async (client) => {
    const userId = await consumeToken(client, token, "verify_email");
    if (!userId) invalidToken();
    await client.query(
      "UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$1",
      [userId],
    );
  });
  res.json({ message: "E-posta adresin doğrulandı." });
});
api.post(
  "/auth/verify-email/resend",
  requireUser,
  resendLimit,
  async (_req, res) => {
    const user = res.locals.user;
    if (user.emailVerified)
      fail(409, "ALREADY_VERIFIED", "E-posta adresin zaten doğrulanmış.");
    await transaction((client) => sendVerification(client, user));
    res.json({ message: "Doğrulama bağlantısı yeniden gönderildi." });
  },
);
const forgotMessage =
  "Bu adres kayıtlıysa parola sıfırlama bağlantısı gönderildi. Bağlantı 30 dakika geçerlidir.";
api.post(
  "/auth/password/forgot",
  forgotPerIp,
  forgotPerEmail,
  async (req, res) => {
    const { email } = credentials.pick({ email: true }).parse(req.body);
    await transaction(async (client) => {
      const r = await client.query(
        "SELECT id,email FROM users WHERE email=$1",
        [email],
      );
      if (!r.rowCount) return;
      const token = await issueToken(client, r.rows[0].id, "reset_password");
      await sendMail({
        to: r.rows[0].email,
        subject: "KampüsPusula parola sıfırlama",
        text: `Parolanı sıfırlamak için bu bağlantıyı aç (30 dakika geçerli, tek kullanımlık):\n${webOrigin}/parola-sifirla?token=${token}\n\nBu isteği sen yapmadıysan bu iletiyi yok sayabilirsin; parolan değişmez.`,
      });
    });
    // Kayıtlı olsun olmasın aynı yanıt: hesap varlığı sızdırılmaz.
    res.status(202).json({ message: forgotMessage });
  },
);
api.post("/auth/password/reset", resetLimit, async (req, res) => {
  const data = z.object({ token: tokenInput, password }).parse(req.body);
  const passwordHash = await hashPassword(data.password);
  await transaction(async (client) => {
    const userId = await consumeToken(client, data.token, "reset_password");
    if (!userId) invalidToken();
    // Bağlantıya e-postadan ulaşıldığı için adres de doğrulanmış sayılır.
    await client.query(
      "UPDATE users SET password_hash=$1, email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$2",
      [passwordHash, userId],
    );
    await client.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
  });
  res.clearCookie("kp_session", { path: "/" });
  res.json({
    message:
      "Parolan değiştirildi. Bütün oturumlar kapatıldı; yeniden giriş yap.",
  });
});
api.put("/me/password", requireUser, authLimit, async (req, res) => {
  const data = z
    .object({
      currentPassword: z.string().min(1).max(128),
      newPassword: password,
    })
    .parse(req.body);
  const r = await pool.query("SELECT password_hash FROM users WHERE id=$1", [
    res.locals.user.id,
  ]);
  if (!(await verifyPassword(data.currentPassword, r.rows[0].password_hash)))
    fail(400, "INVALID_PASSWORD", "Mevcut parola yanlış.");
  const passwordHash = await hashPassword(data.newPassword);
  await transaction(async (client) => {
    await client.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
      passwordHash,
      res.locals.user.id,
    ]);
    await client.query("DELETE FROM sessions WHERE user_id=$1 AND id<>$2", [
      res.locals.user.id,
      res.locals.sessionId,
    ]);
  });
  res.json({ message: "Parolan değiştirildi. Diğer oturumlar kapatıldı." });
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
