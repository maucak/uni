import type { Profile } from "../../shared/contracts.ts";

export type QuestionListFilter = {
  communityId: string | null;
  tag: string;
  q: string;
  sort: "new" | "unanswered";
  limit: number;
};

/** Soru listesi sorgusu: yalnızca görünür içerik, Türkçe tam metin arama, etiket ve sıralama. */
export function buildQuestionListQuery(f: QuestionListFilter) {
  const params: unknown[] = [];
  const where = ["q.status='visible'"];
  const add = (v: unknown) => (params.push(v), `$${params.length}`);
  if (f.communityId) where.push(`q.community_id=${add(f.communityId)}::uuid`);
  if (f.tag) where.push(`q.tags ? ${add(f.tag)}::text`);
  let rank = "";
  if (f.q) {
    const p = add(f.q);
    where.push(`q.search @@ websearch_to_tsquery('turkish',${p})`);
    rank = `ts_rank(q.search,websearch_to_tsquery('turkish',${p})) DESC,`;
  }
  const order =
    f.sort === "unanswered"
      ? `answer_count ASC,${rank}q.created_at DESC`
      : `${rank}q.created_at DESC`;
  const text = `SELECT q.*,u.profile->>'displayName' AS author,c.name AS community_name,count(a.id)::int AS answer_count
FROM questions q JOIN users u ON u.id=q.author_id JOIN communities c ON c.id=q.community_id
LEFT JOIN answers a ON a.question_id=q.id AND a.status='visible'
WHERE ${where.join(" AND ")} GROUP BY q.id,u.id,c.id ORDER BY ${order},q.id LIMIT ${add(f.limit)}`;
  return { text, params };
}

/** Kabul edilen yanıtı yalnızca soru sahibi işaretler; yanıt o soruya ait ve görünür olmalı. */
export function acceptAnswerDecision(
  question: { author_id: string },
  answer: { question_id: string; status: string } | null,
  questionId: string,
  userId: string,
): { ok: true } | { ok: false; status: number; code: string; message: string } {
  if (question.author_id !== userId)
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "Kabul edilen yanıtı yalnızca soru sahibi işaretleyebilir.",
    };
  if (
    !answer ||
    answer.question_id !== questionId ||
    answer.status !== "visible"
  )
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "Yanıt bu soruda bulunamadı.",
    };
  return { ok: true };
}

/** Deneyimi yalnızca yazarı düzenler veya siler (moderatör rolü migration 016 ile gelir). */
export function canModifyExperience(authorId: string, userId: string) {
  return authorId === userId;
}

/** Kişi kendi deneyimine oy veremez. Tekrar oy veritabanında birincil anahtarla engellenir. */
export function canVoteExperience(authorId: string, userId: string) {
  return authorId !== userId;
}

/** Deneyim yazarı deneyim anında öğrenci ya da mezun olmalı; aday deneyim yazamaz. */
export function experienceAuthorStatus(
  profile: Pick<Profile, "role">,
): "student" | "graduate" | null {
  return profile.role === "student" || profile.role === "graduate"
    ? profile.role
    : null;
}

export type ContributionEvent =
  | { kind: "answer_vote" | "answer_unvote"; answerId: string; actorId: string }
  | {
      kind: "answer_accepted" | "answer_unaccepted";
      answerId: string;
      actorId: string;
    }
  | {
      kind: "experience_vote" | "experience_unvote";
      experienceId: string;
      actorId: string;
    };

/**
 * Katkı olayı kancası. Migration 016 (itibar) bu fonksiyonu reputation_events
 * tablosuna yazacak şekilde bağlayacak (rule_version='v1': yanıt oyu +2,
 * kabul edilen yanıt +5, deneyim oyu +1, geri almada negatif olay, kendine oy olay üretmez).
 * 015'te bilerek hiçbir şey yazmaz.
 */
export async function onContributionEvent(_event: ContributionEvent) {
  // 016: reputation_events INSERT burada yapılacak.
}
