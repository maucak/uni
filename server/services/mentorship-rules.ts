// Mentorluk için veritabanına dokunmayan kurallar (birim testli).
export const mentorshipStatuses = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "completed",
] as const;
export type MentorshipStatus = (typeof mentorshipStatuses)[number];
export type MentorshipAction = "accept" | "decline" | "cancel" | "complete";
export const mentorshipActions: readonly MentorshipAction[] = [
  "accept",
  "decline",
  "cancel",
  "complete",
];

type Denied = { ok: false; status: number; code: string; message: string };
const deny = (status: number, code: string, message: string): Denied => ({
  ok: false,
  status,
  code,
  message,
});

/** Eylem → hangi durumdan çıkılır, hangi duruma geçilir, kim yapabilir. */
const transitions: Record<
  MentorshipAction,
  {
    from: MentorshipStatus;
    to: MentorshipStatus;
    by: "mentor" | "mentee" | "party";
  }
> = {
  accept: { from: "pending", to: "accepted", by: "mentor" },
  decline: { from: "pending", to: "declined", by: "mentor" },
  cancel: { from: "pending", to: "cancelled", by: "mentee" },
  complete: { from: "accepted", to: "completed", by: "party" },
};

/**
 * Talep üzerindeki eylemin geçerli olup olmadığı. Tarafların dışındakiler talebin
 * varlığını öğrenmesin diye 404 alır; yanlış taraf 403, geçersiz durum geçişi 409.
 */
export function transitionDecision(
  request: { menteeId: string; mentorId: string; status: string },
  actorId: string,
  action: MentorshipAction,
): { ok: true; from: MentorshipStatus; to: MentorshipStatus } | Denied {
  const isMentor = actorId === request.mentorId;
  const isMentee = actorId === request.menteeId;
  if (!isMentor && !isMentee)
    return deny(404, "NOT_FOUND", "Talep bulunamadı.");
  const rule = transitions[action];
  if (!rule) return deny(400, "INVALID_ACTION", "Geçersiz eylem.");
  if (rule.by === "mentor" && !isMentor)
    return deny(403, "MENTOR_ONLY", "Bu işlemi yalnızca mentor yapabilir.");
  if (rule.by === "mentee" && !isMentee)
    return deny(
      403,
      "MENTEE_ONLY",
      "Bu işlemi yalnızca talebi gönderen yapabilir.",
    );
  if (request.status !== rule.from)
    return deny(
      409,
      "INVALID_STATE",
      "Talebin mevcut durumunda bu işlem yapılamaz.",
    );
  return { ok: true, from: rule.from, to: rule.to };
}

/** Yeni talep göndermenin ön koşulları (açık talep çifti veritabanı indeksiyle ayrıca korunur). */
export function requestDecision(input: {
  menteeId: string;
  mentorId: string;
  mentorListed: boolean;
  accepting: boolean;
  blocked: boolean;
}): { ok: true } | Denied {
  if (input.menteeId === input.mentorId)
    return deny(400, "SELF_REQUEST", "Kendine mentorluk talebi gönderemezsin.");
  if (!input.mentorListed) return deny(404, "NOT_FOUND", "Mentor bulunamadı.");
  if (input.blocked)
    return deny(
      403,
      "REQUEST_NOT_ALLOWED",
      "Bu kullanıcıya talep gönderemezsin.",
    );
  if (!input.accepting)
    return deny(
      409,
      "MENTOR_NOT_ACCEPTING",
      "Bu mentor şu anda yeni talep almıyor.",
    );
  return { ok: true };
}

/** Konu etiketlerini kırpar, boşları ve tekrarları atar (büyük/küçük harf duyarsız), en çok 8. */
export function normalizeTopics(topics: readonly string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of topics) {
    const v = t.trim().replace(/\s+/g, " ");
    const key = v.toLocaleLowerCase("tr");
    if (!v || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.slice(0, 8);
}
