import { randomUUID } from "node:crypto";
import { pool } from "../db.ts";
import { fail } from "../errors.ts";
import { buildNotification, sanitizePayload } from "./notification-rules.ts";
export { buildNotification, sanitizePayload };
import {
  notificationKinds,
  notificationPayloadSchema,
  type NotificationKind,
  type NotificationList,
} from "../../shared/contracts.ts";

/**
 * Payload'ı beyaz listeye indirger: yalnızca kimlik ve en çok 80 karakterlik başlık.
 * Tanımsız alanlar (ör. mesaj gövdesi, belge bilgisi) sessizce atılır.
 */
export async function notify(
  userId: string,
  kind: NotificationKind,
  payload: unknown,
  actorId?: string | null,
) {
  try {
    const row = buildNotification(userId, kind, payload, actorId);
    if (!row) return false;
    await pool.query(
      "INSERT INTO notifications(id,user_id,kind,payload) VALUES($1,$2,$3,$4)",
      [row.id, row.userId, row.kind, JSON.stringify(row.payload)],
    );
    return true;
  } catch (e) {
    console.error("[bildirim]", (e as Error).message);
    return false;
  }
}

/** Yanıt eklendi: soru sahibine gider. */
export async function notifyAnswerReceived(
  questionId: string,
  actorId: string,
) {
  const q = await pool.query(
    "SELECT author_id,title FROM questions WHERE id=$1",
    [questionId],
  );
  if (q.rowCount)
    await notify(
      q.rows[0].author_id,
      "answer_received",
      { questionId, title: shortTitle(q.rows[0].title) },
      actorId,
    );
}

/** Yanıt kabul edildi: yanıt sahibine gider. */
export async function notifyAnswerAccepted(answerId: string, actorId: string) {
  const r = await pool.query(
    "SELECT a.author_id,q.id AS question_id,q.title FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.id=$1",
    [answerId],
  );
  if (r.rowCount)
    await notify(
      r.rows[0].author_id,
      "answer_accepted",
      {
        questionId: r.rows[0].question_id,
        answerId,
        title: shortTitle(r.rows[0].title),
      },
      actorId,
    );
}

function shortTitle(title: string) {
  const t = String(title).trim();
  return t.length > 80 ? `${t.slice(0, 79)}…` : t;
}

export async function listNotifications(
  userId: string,
  opts: { unreadOnly: boolean; limit: number; offset: number },
): Promise<NotificationList> {
  const rows = await pool.query(
    `SELECT id,kind,payload,read_at,created_at FROM notifications
     WHERE user_id=$1 AND ($2::boolean=false OR read_at IS NULL)
     ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4`,
    [userId, opts.unreadOnly, opts.limit + 1, opts.offset],
  );
  const unread = await pool.query(
    "SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL",
    [userId],
  );
  return {
    items: rows.rows.slice(0, opts.limit).map((r) => ({
      id: r.id,
      kind: r.kind,
      payload: r.payload,
      read: r.read_at !== null,
      createdAt: new Date(r.created_at).toISOString(),
    })),
    unreadCount: unread.rows[0].n,
    hasMore: rows.rows.length > opts.limit,
  };
}

/** Yalnızca sahibi işaretleyebilir; başkasının bildirimi 404 verir. */
export async function markRead(userId: string, id: string) {
  const r = await pool.query(
    "UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2",
    [id, userId],
  );
  if (!r.rowCount) fail(404, "NOT_FOUND", "Bildirim bulunamadı.");
}

export async function markAllRead(userId: string) {
  const r = await pool.query(
    "UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL",
    [userId],
  );
  return r.rowCount ?? 0;
}
