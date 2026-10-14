import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../db.ts";
import { requireUser } from "../auth.ts";
import { fail } from "../errors.ts";
const api = Router();
const uuid = z.uuid();
import type express from "express";
import { catalog } from "../catalog.ts";
async function lists(userId: string) {
  const programs = await catalog();
  const lookup = new Map(programs.map((p) => [p.id, p]));
  const r = await pool.query(
    "SELECT * FROM preference_lists WHERE user_id=$1 ORDER BY created_at",
    [userId],
  );
  const items = await pool.query(
    "SELECT i.* FROM preference_items i JOIN preference_lists l ON l.id=i.list_id WHERE l.user_id=$1 ORDER BY i.position,i.id",
    [userId],
  );
  return r.rows.map((l) => ({
    id: l.id,
    name: l.name,
    revision: l.revision,
    items: items.rows
      .filter((i) => i.list_id === l.id)
      .map((i) => ({
        id: i.id,
        note: i.note,
        position: i.position,
        program: lookup.get(i.program_id),
      })),
  }));
}
api.get("/preference-lists", requireUser, async (_req, res) => {
  res.json(await lists(res.locals.user.id));
});
api.post("/preference-lists", requireUser, async (req, res) => {
  const { name } = z
    .object({ name: z.string().trim().min(1).max(100) })
    .parse(req.body);
  const r = await pool.query(
    "INSERT INTO preference_lists(id,user_id,name) VALUES($1,$2,$3) RETURNING *",
    [randomUUID(), res.locals.user.id, name],
  );
  res.status(201).json({ ...r.rows[0], items: [] });
});
async function changeList(
  req: express.Request,
  res: express.Response,
  fn: (c: import("pg").PoolClient, id: string) => Promise<void>,
) {
  const id = uuid.parse(req.params.id);
  await transaction(async (c) => {
    const row = await c.query(
      "SELECT * FROM preference_lists WHERE id=$1 AND user_id=$2 FOR UPDATE",
      [id, res.locals.user.id],
    );
    if (!row.rowCount) fail(404, "NOT_FOUND", "Liste bulunamadı.");
    await fn(c, id);
    await c.query(
      "UPDATE preference_lists SET revision=revision+1 WHERE id=$1",
      [id],
    );
  });
  res.json((await lists(res.locals.user.id)).find((l) => l.id === id));
}
api.post("/preference-lists/:id/items", requireUser, async (req, res) => {
  const { programId } = z.object({ programId: uuid }).parse(req.body);
  await changeList(req, res, async (c, id) => {
    const p = await c.query("SELECT id FROM programs WHERE id=$1", [programId]);
    if (!p.rowCount) fail(404, "NOT_FOUND", "Program bulunamadı.");
    await c.query(
      "INSERT INTO preference_items(id,list_id,program_id,position) SELECT $1,$2,$3,coalesce(max(position)+1,0) FROM preference_items WHERE list_id=$2 ON CONFLICT(list_id,program_id) DO NOTHING",
      [randomUUID(), id, programId],
    );
  });
});
api.patch(
  "/preference-lists/:id/items/:itemId",
  requireUser,
  async (req, res) => {
    const itemId = uuid.parse(req.params.itemId);
    const { note } = z.object({ note: z.string().max(3000) }).parse(req.body);
    await changeList(req, res, async (c, id) => {
      const r = await c.query(
        "UPDATE preference_items SET note=$1 WHERE id=$2 AND list_id=$3",
        [note, itemId, id],
      );
      if (!r.rowCount) fail(404, "NOT_FOUND", "Liste öğesi bulunamadı.");
    });
  },
);
api.delete(
  "/preference-lists/:id/items/:itemId",
  requireUser,
  async (req, res) => {
    const itemId = uuid.parse(req.params.itemId);
    await changeList(req, res, async (c, id) => {
      const r = await c.query(
        "DELETE FROM preference_items WHERE id=$1 AND list_id=$2",
        [itemId, id],
      );
      if (!r.rowCount) fail(404, "NOT_FOUND", "Liste öğesi bulunamadı.");
    });
  },
);
api.put("/preference-lists/:id/order", requireUser, async (req, res) => {
  const { revision, ids } = z
    .object({
      revision: z.number().int().nonnegative(),
      ids: z.array(uuid).max(100),
    })
    .parse(req.body);
  await changeList(req, res, async (c, id) => {
    const l = await c.query(
      "SELECT revision FROM preference_lists WHERE id=$1",
      [id],
    );
    if (l.rows[0].revision !== revision)
      fail(
        409,
        "REVISION_CONFLICT",
        "Liste başka bir yerde değişti. Yenileyip tekrar dene.",
      );
    const r = await c.query(
      "SELECT id FROM preference_items WHERE list_id=$1",
      [id],
    );
    if (
      new Set(ids).size !== ids.length ||
      r.rows.length !== ids.length ||
      r.rows.some((i) => !ids.includes(i.id))
    )
      fail(
        400,
        "INVALID_ORDER",
        "Sıralama listedeki bütün programları birer kez içermeli.",
      );
    for (let i = 0; i < ids.length; i++)
      await c.query(
        "UPDATE preference_items SET position=$1 WHERE id=$2 AND list_id=$3",
        [i, ids[i], id],
      );
  });
});

export default api;
