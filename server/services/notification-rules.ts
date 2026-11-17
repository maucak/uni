import { randomUUID } from "node:crypto";
import {
  notificationKinds,
  notificationPayloadSchema,
  type NotificationKind,
  type NotificationList,
} from "../../shared/contracts.ts";

// Saf kurallar: veritabanı bağlantısı gerektirmez (birim testleri buradan içe aktarır).
export function sanitizePayload(payload: unknown) {
  const parsed = notificationPayloadSchema.parse(payload ?? {});
  return Object.fromEntries(
    Object.entries(parsed).filter(([, v]) => v !== undefined),
  );
}

/** Saf karar: bildirim oluşturulacaksa satırı döndürür, yoksa null (kendi eylemi, geçersiz tür). */
export function buildNotification(
  userId: string,
  kind: string,
  payload: unknown,
  actorId?: string | null,
) {
  if (!userId || (actorId && actorId === userId)) return null;
  if (!(notificationKinds as readonly string[]).includes(kind)) return null;
  return {
    id: randomUUID(),
    userId,
    kind: kind as NotificationKind,
    payload: sanitizePayload(payload),
  };
}

/**
 * Bildirim üretir. actorId verilirse ve alıcıyla aynıysa bildirim yazılmaz.
 * Bildirim hatası ana işlemi bozmaz; yalnızca kısa bir log düşer.
 */
