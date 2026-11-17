// Doğrulama ve itibar için veritabanına dokunmayan kurallar (birim testli).
export const staffRoles = ["reviewer", "moderator", "admin"] as const;
export type StaffRole = (typeof staffRoles)[number];

/** ADMIN_EMAILS gibi virgülle ayrılmış e-posta listesini normalleştirir. */
export function parseEmailList(value: string | undefined) {
  return [
    ...new Set(
      (value || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^@\s]+@[^@\s]+$/.test(s)),
    ),
  ];
}

export function hasAnyRole(
  roles: readonly string[] | undefined,
  allowed: readonly StaffRole[],
) {
  return !!roles && allowed.some((r) => roles.includes(r));
}

/** Yönetici kendi admin rolünü kaldıramaz; roller tekilleştirilir ve sıralanır. */
export function roleChangeDecision(
  actorId: string,
  targetId: string,
  requested: readonly StaffRole[],
):
  | { ok: true; roles: StaffRole[] }
  | { ok: false; code: string; message: string } {
  const roles = staffRoles.filter((r) => requested.includes(r));
  if (actorId === targetId && !roles.includes("admin"))
    return {
      ok: false,
      code: "SELF_ADMIN_REMOVAL",
      message: "Kendi yönetici rolünü kaldıramazsın.",
    };
  return { ok: true, roles };
}

/** E-posta adresinin alan adını küçük harfle döndürür; geçersizse null. */
export function emailDomain(email: string) {
  const at = email.trim().toLowerCase().split("@");
  if (at.length !== 2 || !at[0] || !at[1]) return null;
  const domain = at[1];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

/**
 * Alan adı tam olarak kayıtlı alan adı ya da onun nokta ile ayrılmış alt alan adı
 * olmalı: ogr.sdu.edu.tr → sdu.edu.tr eşleşir; kotusdu.edu.tr eşleşmez.
 */
export function domainMatches(candidate: string, registered: string) {
  const c = candidate.toLowerCase().replace(/\.$/, "");
  const r = registered.toLowerCase().replace(/\.$/, "");
  return c === r || c.endsWith(`.${r}`);
}

export const maxDocumentBytes = 5 * 1024 * 1024;
export type DocumentType = { mime: string; ext: string };

/** Dosya türünü uzantıdan değil içeriğin ilk baytlarından tespit eder. */
export function detectDocumentType(buf: Uint8Array): DocumentType | null {
  const starts = (sig: number[]) =>
    buf.length >= sig.length && sig.every((b, i) => buf[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d]))
    return { mime: "application/pdf", ext: "pdf" };
  if (starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: "image/png", ext: "png" };
  return null;
}

export type ReviewAction = "approve" | "reject" | "revoke";
/** İnceleme kararının geçerli olup olmadığı. Kullanıcı kendi başvurusunu inceleyemez. */
export function reviewDecision(
  request: { user_id: string; status: string; method: string },
  reviewerId: string,
  action: ReviewAction,
):
  | { ok: true; status: "approved" | "rejected" | "revoked" }
  | { ok: false; status: number; code: string; message: string } {
  if (request.user_id === reviewerId)
    return {
      ok: false,
      status: 403,
      code: "SELF_REVIEW",
      message: "Kendi başvurunu inceleyemezsin.",
    };
  if (action === "revoke") {
    if (request.status !== "approved")
      return {
        ok: false,
        status: 409,
        code: "INVALID_STATE",
        message: "Yalnızca onaylanmış doğrulama kaldırılabilir.",
      };
    return { ok: true, status: "revoked" };
  }
  if (request.status !== "pending")
    return {
      ok: false,
      status: 409,
      code: "INVALID_STATE",
      message: "Bu başvuru için karar zaten verilmiş.",
    };
  if (action === "approve" && request.method !== "document")
    return {
      ok: false,
      status: 400,
      code: "EMAIL_CONFIRMATION_REQUIRED",
      message:
        "Kurumsal e-posta başvurusu yalnızca e-postadaki bağlantıyla onaylanır.",
    };
  return { ok: true, status: action === "approve" ? "approved" : "rejected" };
}

export const documentRetentionDays = 30;
export function documentExpired(reviewedAt: Date | null, now = new Date()) {
  return (
    !!reviewedAt &&
    now.getTime() - reviewedAt.getTime() >= documentRetentionDays * 86_400_000
  );
}

export type Badge = {
  claim: "student" | "graduate";
  method: "institution_email" | "document";
  university: string;
  program: string | null;
  label: string;
};
/** Rozet kapsamını açıkça yazar: "<Üniversite> öğrencisi (kurumsal e-posta)". */
export function badgeLabel(b: Omit<Badge, "label">) {
  const who = b.claim === "student" ? "öğrencisi" : "mezunu";
  const scope = b.program ? `${b.university} · ${b.program}` : b.university;
  const how = b.method === "institution_email" ? "kurumsal e-posta" : "belge";
  return `${scope} ${who} (${how})`;
}
export function toBadges(rows: unknown): Badge[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => {
    const base = {
      claim: r.claim,
      method: r.method,
      university: r.university,
      program: r.program ?? null,
    };
    return { ...base, label: badgeLabel(base) };
  });
}

// İtibar kuralları v1.
export const reputationRuleVersion = "v1";
export const reputationRules = {
  answer_vote: { sourceType: "answer", delta: 2 },
  answer_accepted: { sourceType: "answer", delta: 5 },
  experience_vote: { sourceType: "experience", delta: 1 },
} as const;
export type ReputationKind = keyof typeof reputationRules;
const eventRule: Record<string, { kind: ReputationKind; sign: 1 | -1 }> = {
  answer_vote: { kind: "answer_vote", sign: 1 },
  answer_unvote: { kind: "answer_vote", sign: -1 },
  answer_accepted: { kind: "answer_accepted", sign: 1 },
  answer_unaccepted: { kind: "answer_accepted", sign: -1 },
  experience_vote: { kind: "experience_vote", sign: 1 },
  experience_unvote: { kind: "experience_vote", sign: -1 },
};
export function reputationKindOf(eventKind: string) {
  const rule = eventRule[eventKind];
  return rule
    ? { kind: rule.kind, sourceType: reputationRules[rule.kind].sourceType }
    : null;
}
/**
 * Bir katkı olayının yazacağı itibar kaydı. Kendine oy olay üretmez. Aynı kural ve
 * kaynak için net toplam 0 ise yalnız pozitif, pozitifse yalnız negatif olay yazılır;
 * böylece tekrar eden istek puanı iki kez değiştirmez.
 */
export function reputationEventFor(
  eventKind: string,
  authorId: string,
  actorId: string,
  currentNet: number,
): { kind: ReputationKind; sourceType: string; delta: number } | null {
  const rule = eventRule[eventKind];
  if (!rule || authorId === actorId) return null;
  const { sourceType, delta } = reputationRules[rule.kind];
  if (rule.sign > 0 && currentNet > 0) return null;
  if (rule.sign < 0 && currentNet <= 0) return null;
  return { kind: rule.kind, sourceType, delta: rule.sign * delta };
}
