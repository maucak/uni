import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../db.ts";
import { requireUser } from "../auth.ts";
import { fail } from "../errors.ts";
import { catalog, catalogVersion } from "../catalog.ts";
import { searchStateSchema } from "../../shared/contracts.ts";
import {
  validateAdvisorPlan,
  type AdvisorReply,
} from "../../shared/advisor.ts";
import { advisorConfig, createAdvisorProvider } from "../services/advisor.ts";
import { filterPrograms, sortPrograms } from "../services/search.ts";
const api = Router();
api.get("/advisor/status", async (_req, res) => {
  const c = await advisorConfig();
  res.json({
    configured: c.configured,
    provider: c.provider,
    model: c.model || null,
    dailyLimit: c.dailyLimit,
  });
});
api.get("/advisor/conversations", requireUser, async (_req, res) => {
  const r = await pool.query(
    "SELECT id,created_at FROM advisor_conversations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20",
    [res.locals.user.id],
  );
  res.json(r.rows);
});
api.get("/advisor/conversations/:id", requireUser, async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  if (
    !(
      await pool.query(
        "SELECT id FROM advisor_conversations WHERE id=$1 AND user_id=$2",
        [id, res.locals.user.id],
      )
    ).rowCount
  )
    fail(404, "NOT_FOUND", "Konuşma bulunamadı.");
  const r = await pool.query(
    "SELECT role,payload,created_at FROM advisor_messages WHERE conversation_id=$1 ORDER BY sequence",
    [id],
  );
  res.json(r.rows);
});
api.delete("/advisor/conversations/:id", requireUser, async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  await transaction(async (c) => {
    await c.query(
      "DELETE FROM advisor_conversations WHERE id=$1 AND user_id=$2",
      [id, res.locals.user.id],
    );
    await c.query(
      "UPDATE advisor_requests SET response=null,state='failed' WHERE user_id=$1 AND response->>'conversationId'=$2",
      [res.locals.user.id, id],
    );
  });
  res.status(204).end();
});
api.post("/advisor/messages", requireUser, async (req, res) => {
  const data = z
    .object({
      requestId: z.uuid(),
      conversationId: z.uuid().nullable(),
      message: z.string().trim().min(2).max(1500),
      state: searchStateSchema,
      baseRevision: z.string().max(5000),
      comparedIds: z.array(z.uuid()).max(4).default([]),
    })
    .parse(req.body);
  const config = await advisorConfig();
  if (!config.configured)
    fail(
      503,
      "AI_NOT_CONFIGURED",
      "AI bağlantısı henüz etkin değil. Seçilen sağlayıcının anahtarını ve modelini sunucu ayarlarına ekle.",
    );
  const userId = res.locals.user.id;
  if (
    data.conversationId &&
    !(
      await pool.query(
        "SELECT id FROM advisor_conversations WHERE id=$1 AND user_id=$2",
        [data.conversationId, userId],
      )
    ).rowCount
  )
    fail(404, "NOT_FOUND", "Konuşma bulunamadı.");
  const cached = await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    const existing = await c.query(
      "SELECT state,response FROM advisor_requests WHERE user_id=$1 AND request_key=$2",
      [userId, data.requestId],
    );
    if (existing.rowCount) {
      if (existing.rows[0].state === "complete")
        return existing.rows[0].response as AdvisorReply;
      fail(
        409,
        "AI_DUPLICATE_REQUEST",
        "Bu istek daha önce işlendi veya devam ediyor.",
      );
    }
    const used = await c.query(
      "SELECT count(*)::int AS n FROM advisor_requests WHERE user_id=$1 AND created_at >= (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')",
      [userId],
    );
    if (used.rows[0].n >= config.dailyLimit)
      fail(429, "AI_DAILY_LIMIT", "Günlük danışman mesaj sınırına ulaştın.");
    await c.query(
      "INSERT INTO advisor_requests(id,user_id,request_key,state) VALUES($1,$2,$3,'pending')",
      [randomUUID(), userId, data.requestId],
    );
    return null;
  });
  if (cached) return res.json(cached);
  try {
    const programs = await catalog();
    const filtered = sortPrograms(
      filterPrograms(programs, data.state),
      data.state.sort,
    ).slice(0, 12);
    const compared = programs.filter((p) => data.comparedIds.includes(p.id));
    const contextPrograms = [
      ...new Map([...filtered, ...compared].map((p) => [p.id, p])).values(),
    ];
    const history = data.conversationId
      ? (
          await pool.query(
            "SELECT role,payload FROM advisor_messages WHERE conversation_id=$1 ORDER BY sequence DESC LIMIT 6",
            [data.conversationId],
          )
        ).rows
          .reverse()
          .map((row) => ({
            role: row.role,
            text:
              row.role === "user"
                ? row.payload.message
                : row.payload.plan.summary,
          }))
      : [];
    const p = res.locals.user.profile;
    const raw = await createAdvisorProvider(config).generate({
      message: data.message,
      state: data.state,
      profile: {
        scoreType: p.scoreType,
        rank: p.rank,
        interests: p.interests,
        cities: p.cities,
        language: p.language,
        maxAnnualTuition: p.maxAnnualTuition,
        minimumScholarship: p.minimumScholarship,
      },
      programs: contextPrograms,
      history,
    });
    let validated;
    try {
      validated = validateAdvisorPlan(raw, data.state, contextPrograms);
    } catch {
      fail(
        502,
        "AI_INVALID_RESPONSE",
        "Danışman yanıtı doğrulanamadı. Filtrelerin değiştirilmedi; tekrar deneyebilirsin.",
      );
    }
    const conversationId = data.conversationId || randomUUID();
    const result: AdvisorReply = {
      conversationId,
      baseRevision: data.baseRevision,
      baseState: data.state,
      ...validated,
      programs: contextPrograms.filter((p) =>
        validated.plan.programIds.includes(p.id),
      ),
      catalogVersion: programs[0]?.catalogVersion || (await catalogVersion()),
      provider: config.provider,
      model: config.model,
    };
    await transaction(async (c) => {
      if (!data.conversationId)
        await c.query(
          "INSERT INTO advisor_conversations(id,user_id) VALUES($1,$2)",
          [conversationId, userId],
        );
      await c.query(
        "INSERT INTO advisor_messages(id,conversation_id,role,payload) VALUES($1,$2,'user',$3),($4,$2,'assistant',$5)",
        [
          randomUUID(),
          conversationId,
          JSON.stringify({ message: data.message }),
          randomUUID(),
          JSON.stringify(result),
        ],
      );
      await c.query(
        "UPDATE advisor_requests SET state='complete',response=$1 WHERE user_id=$2 AND request_key=$3",
        [JSON.stringify(result), userId, data.requestId],
      );
    });
    res.json(result);
  } catch (error) {
    await pool.query(
      "UPDATE advisor_requests SET state='failed' WHERE user_id=$1 AND request_key=$2",
      [userId, data.requestId],
    );
    if ((error as any).name === "TimeoutError")
      fail(
        504,
        "AI_TIMEOUT",
        "Danışman yanıt süresi aşıldı. Filtrelerin korundu.",
      );
    throw error;
  }
});
export default api;
