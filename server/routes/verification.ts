import express, { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { rateLimit } from "express-rate-limit";
import { pool, transaction } from "../db.ts";
import { requireRole, requireUser, requireVerifiedEmail } from "../auth.ts";
import { fail } from "../errors.ts";
import { generateToken, hashToken } from "../services/account-tokens.ts";
import { sendMail } from "../services/mail.ts";
import { notify } from "../services/notifications.ts";
import {
  detectDocumentType,
  domainMatches,
  emailDomain,
  maxDocumentBytes,
  reviewDecision,
  toBadges,
} from "../services/verification-rules.ts";
import {
  authorMetaSql,
  documentFile,
  removeDocument,
  storeDocument,
} from "../services/verification.ts";
const api = Router();
const uuid = z.uuid();
const webOrigin = process.env.WEB_ORIGIN || "http://127.0.0.1:5173";
const emailTokenLifetimeMs = 24 * 60 * 60_000;
const submitLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (_req, res) => `u:${res.locals.user?.id}`,
  message: {
    code: "RATE_LIMIT",
    message: "Çok fazla başvuru denemesi. Biraz sonra tekrar dene.",
  },
});
const claimInput = z.object({
  claim: z.enum(["student", "graduate"]),
  universityId: uuid,
  programId: uuid.nullable().optional(),
});
const emailInput = claimInput.extend({
  method: z.literal("institution_email"),
  institutionEmail: z.email().max(254),
});
const uniqueViolation = (e: any) =>
  e?.code === "23505" &&
  fail(
    409,
    "OPEN_REQUEST_EXISTS",
    "Bu iddia için zaten açık bir başvurun var. Sonucunu bekle.",
  );
async function checkClaim(
  userId: string,
  claim: string,
  universityId: string,
  programId: string | null,
) {
  const u = await pool.query("SELECT id FROM universities WHERE id=$1", [
    universityId,
  ]);
  if (!u.rowCount) fail(404, "NOT_FOUND", "Üniversite bulunamadı.");
  if (
    programId &&
    !(
      await pool.query(
        "SELECT 1 FROM programs WHERE id=$1 AND university_id=$2",
        [programId, universityId],
      )
    ).rowCount
  )
    fail(404, "NOT_FOUND", "Program bu üniversitede bulunamadı.");
  const open = await pool.query(
    "SELECT 1 FROM verification_requests WHERE user_id=$1 AND claim=$2 AND status='pending'",
    [userId, claim],
  );
  if (open.rowCount) uniqueViolation({ code: "23505" });
}
function toRequest(r: any) {
  return {
    id: r.id,
    claim: r.claim,
    method: r.method,
    universityId: r.university_id,
    university: r.university,
    programId: r.program_id,
    program: r.program,
    institutionEmail: r.institution_email,
    hasDocument: !!r.document_path,
    documentMime: r.document_mime,
    status: r.status,
    decisionNote: r.decision_note,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  };
}
const requestSelect = `SELECT vr.*,un.name AS university,pr.name AS program FROM verification_requests vr
  JOIN universities un ON un.id=vr.university_id LEFT JOIN programs pr ON pr.id=vr.program_id`;

/** Başvuru formu için: alan adı bilinen üniversiteler ve seçilen üniversitenin programları. */
api.get("/verifications/options", async (req, res) => {
  const universityId = req.query.universityId
    ? uuid.parse(req.query.universityId)
    : null;
  const universities = await pool.query(
    `SELECT u.id,u.name,COALESCE(array_agg(d.domain ORDER BY d.domain) FILTER (WHERE d.domain IS NOT NULL),'{}') AS domains
     FROM universities u LEFT JOIN university_email_domains d ON d.university_id=u.id
     WHERE EXISTS (SELECT 1 FROM programs p WHERE p.university_id=u.id AND NOT p.is_sample)
     GROUP BY u.id ORDER BY u.name`,
  );
  const programs = universityId
    ? (
        await pool.query(
          "SELECT id,name FROM programs WHERE university_id=$1 AND NOT is_sample ORDER BY name LIMIT 500",
          [universityId],
        )
      ).rows
    : [];
  res.json({ universities: universities.rows, programs });
});

api.get("/verifications/mine", requireUser, async (_req, res) => {
  const r = await pool.query(
    `${requestSelect} WHERE vr.user_id=$1 ORDER BY vr.created_at DESC`,
    [res.locals.user.id],
  );
  res.json(r.rows.map(toRequest));
});

// Belge yöntemi: ham gövde (PDF/JPEG/PNG, en fazla 5 MB), bilgiler sorgu parametresinde.
const rawDocument = express.raw({
  type: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/octet-stream",
  ],
  limit: maxDocumentBytes,
});
api.post(
  "/verifications",
  requireUser,
  requireVerifiedEmail,
  submitLimit,
  rawDocument,
  async (req, res) => {
    const userId = res.locals.user.id;
    const id = randomUUID();
    if (Buffer.isBuffer(req.body)) {
      const data = claimInput.parse({
        claim: req.query.claim,
        universityId: req.query.universityId,
        programId: req.query.programId || null,
      });
      const buf = req.body;
      if (!buf.length) fail(400, "DOCUMENT_REQUIRED", "Belge dosyası boş.");
      const type = detectDocumentType(buf);
      if (!type)
        fail(
          415,
          "UNSUPPORTED_DOCUMENT",
          "Belge PDF, JPEG veya PNG olmalı. Dosya içeriği bu türlerden biri değil.",
        );
      await checkClaim(
        userId,
        data.claim,
        data.universityId,
        data.programId ?? null,
      );
      const name = await storeDocument(buf, type.ext);
      try {
        await pool.query(
          `INSERT INTO verification_requests(id,user_id,claim,university_id,program_id,method,document_path,document_mime,document_bytes)
           VALUES($1,$2,$3,$4,$5,'document',$6,$7,$8)`,
          [
            id,
            userId,
            data.claim,
            data.universityId,
            data.programId ?? null,
            name,
            type.mime,
            buf.length,
          ],
        );
      } catch (e) {
        await removeDocument(name);
        uniqueViolation(e);
        throw e;
      }
      return res.status(201).json({ id, status: "pending" });
    }
    const data = emailInput.parse(req.body);
    if (data.claim !== "student")
      fail(
        400,
        "DOCUMENT_REQUIRED",
        "Kurumsal e-posta yalnızca öğrencilik kanıtıdır. Mezuniyet için belge yükle.",
      );
    if (data.programId)
      fail(
        400,
        "DOCUMENT_REQUIRED",
        "Kurumsal e-posta bölümü kanıtlamaz. Bölüm doğrulaması için belge yükle.",
      );
    const email = data.institutionEmail.trim().toLowerCase();
    const domain = emailDomain(email);
    const domains = await pool.query(
      "SELECT domain FROM university_email_domains WHERE university_id=$1",
      [data.universityId],
    );
    if (!domain || !domains.rows.some((d) => domainMatches(domain, d.domain)))
      fail(
        400,
        "DOMAIN_MISMATCH",
        "Bu adres seçtiğin üniversitenin kayıtlı kurumsal alan adlarından biriyle eşleşmiyor.",
      );
    const used = await pool.query(
      "SELECT 1 FROM verification_requests WHERE lower(institution_email)=$1 AND user_id<>$2 AND status IN ('pending','approved')",
      [email, userId],
    );
    if (used.rowCount)
      fail(
        409,
        "EMAIL_IN_USE",
        "Bu kurumsal adres başka bir hesapta kullanılıyor.",
      );
    await checkClaim(userId, data.claim, data.universityId, null);
    const { token, hash } = generateToken();
    try {
      await transaction(async (client) => {
        await client.query(
          `INSERT INTO verification_requests(id,user_id,claim,university_id,method,institution_email,email_token_hash,email_token_expires_at)
           VALUES($1,$2,$3,$4,'institution_email',$5,$6,$7)`,
          [
            id,
            userId,
            data.claim,
            data.universityId,
            email,
            hash,
            new Date(Date.now() + emailTokenLifetimeMs),
          ],
        );
        await sendMail({
          to: email,
          subject: "KampüsPusula kurumsal e-posta doğrulama",
          text: `Öğrencilik doğrulamanı tamamlamak için bu bağlantıyı aç (24 saat geçerli, tek kullanımlık):\n${webOrigin}/dogrulama?token=${token}\n\nBu başvuruyu sen yapmadıysan bu iletiyi yok sayabilirsin.`,
        });
      });
    } catch (e) {
      uniqueViolation(e);
      throw e;
    }
    res.status(201).json({ id, status: "pending" });
  },
);

const confirmLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    code: "RATE_LIMIT",
    message: "Çok fazla deneme. Biraz sonra tekrar dene.",
  },
});
api.get("/verifications/confirm", confirmLimit, async (req, res) => {
  const token = z.string().trim().min(20).max(200).parse(req.query.token);
  const ok = await transaction(async (client) => {
    const r = await client.query(
      `UPDATE verification_requests SET status='approved',reviewed_at=now(),email_token_hash=NULL,email_token_expires_at=NULL
       WHERE email_token_hash=$1 AND method='institution_email' AND status='pending' AND email_token_expires_at>now() RETURNING id`,
      [hashToken(token)],
    );
    return !!r.rowCount;
  });
  if (!ok)
    fail(
      400,
      "TOKEN_INVALID",
      "Bağlantı geçersiz, süresi dolmuş ya da daha önce kullanılmış.",
    );
  res.json({
    message: "Kurumsal e-posta adresin doğrulandı; rozetin profilinde görünür.",
  });
});

// İnceleyici uç noktaları.
const reviewer = [requireUser, requireRole("reviewer", "admin")];
api.get("/admin/verifications", ...reviewer, async (req, res) => {
  const status = z
    .enum(["pending", "approved", "rejected", "revoked"])
    .default("pending")
    .parse(req.query.status || undefined);
  const r = await pool.query(
    `SELECT vr.*,un.name AS university,pr.name AS program,u.email AS user_email,u.profile->>'displayName' AS user_name
     FROM verification_requests vr JOIN universities un ON un.id=vr.university_id LEFT JOIN programs pr ON pr.id=vr.program_id
     JOIN users u ON u.id=vr.user_id WHERE vr.status=$1 ORDER BY vr.created_at LIMIT 200`,
    [status],
  );
  res.json(
    r.rows.map((row) => ({
      ...toRequest(row),
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      mine: row.user_id === res.locals.user.id,
    })),
  );
});
api.get("/admin/verifications/:id/document", ...reviewer, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const r = await pool.query(
    "SELECT document_path,document_mime FROM verification_requests WHERE id=$1",
    [id],
  );
  if (!r.rows[0]?.document_path) fail(404, "NOT_FOUND", "Belge bulunamadı.");
  const ext = r.rows[0].document_path.split(".").pop();
  let data: Buffer;
  try {
    data = await readFile(documentFile(r.rows[0].document_path));
  } catch {
    fail(404, "NOT_FOUND", "Belge bulunamadı.");
  }
  res.set({
    "Content-Type": r.rows[0].document_mime,
    "Content-Disposition": `attachment; filename="dogrulama-${id}.${ext}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  });
  res.send(data);
});
api.put("/admin/verifications/:id", ...reviewer, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const data = z
    .object({
      action: z.enum(["approve", "reject", "revoke"]),
      note: z.string().trim().max(1000).default(""),
    })
    .parse(req.body);
  if (data.action !== "approve" && data.note.length < 3)
    fail(400, "NOTE_REQUIRED", "Ret ve kaldırma için kısa bir not yaz.");
  const result = await transaction(async (client) => {
    const r = await client.query(
      "SELECT user_id,status,method FROM verification_requests WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!r.rowCount) fail(404, "NOT_FOUND", "Başvuru bulunamadı.");
    const decision = reviewDecision(r.rows[0], res.locals.user.id, data.action);
    if (!decision.ok) fail(decision.status, decision.code, decision.message);
    await client.query(
      `UPDATE verification_requests SET status=$2,reviewer_id=$3,reviewed_at=now(),decision_note=NULLIF($4,''),
       email_token_hash=NULL,email_token_expires_at=NULL WHERE id=$1`,
      [id, decision.status, res.locals.user.id, data.note],
    );
    return { status: decision.status, userId: r.rows[0].user_id as string };
  });
  const titles = {
    approved: "Doğrulama başvurun onaylandı",
    rejected: "Doğrulama başvurun reddedildi",
    revoked: "Doğrulaman kaldırıldı",
  } as const;
  await notify(
    result.userId,
    "verification_decided",
    { verificationId: id, title: titles[result.status] },
    res.locals.user.id,
  );
  res.json({ id, status: result.status });
});

// Herkese açık profil: ad, rozetler ve kapsamı, itibar.
api.get("/users/:id/public", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const r = await pool.query(
    `SELECT u.id,u.profile->>'displayName' AS name,${authorMetaSql("u.id")} FROM users u WHERE u.id=$1`,
    [id],
  );
  if (!r.rowCount) fail(404, "NOT_FOUND", "Kullanıcı bulunamadı.");
  const row = r.rows[0];
  res.json({
    id: row.id,
    displayName: row.name,
    badges: toBadges(row.author_badges),
    reputation: row.author_reputation,
  });
});
export default api;
