import { Router } from "express";
import { z } from "zod";
import { requireUser } from "../auth.ts";
import {
  listNotifications,
  markAllRead,
  markRead,
} from "../services/notifications.ts";
const api = Router();
api.get("/notifications", requireUser, async (req, res) => {
  const q = z
    .object({
      unread: z
        .enum(["1", "true", "0", "false"])
        .default("0")
        .transform((v) => v === "1" || v === "true"),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      offset: z.coerce.number().int().min(0).max(10000).default(0),
    })
    .parse(req.query);
  res.json(
    await listNotifications(res.locals.user.id, {
      unreadOnly: q.unread,
      limit: q.limit,
      offset: q.offset,
    }),
  );
});
api.put("/notifications/read-all", requireUser, async (_req, res) => {
  res.json({ updated: await markAllRead(res.locals.user.id) });
});
api.put("/notifications/:id/read", requireUser, async (req, res) => {
  await markRead(res.locals.user.id, z.uuid().parse(req.params.id));
  res.json({ ok: true });
});
export default api;
