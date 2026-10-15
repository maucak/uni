import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { requireUser } from "../auth.ts";
import { pool, transaction } from "../db.ts";
import { fail } from "../errors.ts";
import { defaultProfile, searchStateSchema } from "../../shared/contracts.ts";
import { lifeArticles, lifeCampus } from "../services/life-content.ts";
import { retrieveLife } from "../services/life-retrieval.ts";
import { advisorConfig, createAdvisorProvider } from "../services/advisor.ts";
import type { LifeAnswer } from "../../shared/life.ts";
const api = Router();
api.get("/life/guide", (req, res) => {
  const query = z
    .string()
    .trim()
    .max(500)
    .parse(req.query.q ?? "");
  res.json({
    campus: lifeCampus,
    items: query ? retrieveLife(query) : lifeArticles,
  });
});
api.post(
  "/life/ask",
  requireUser,
  rateLimit({
    windowMs: 60_000,
    limit: 6,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      message: "Biraz sonra yeniden sorabilirsin.",
      code: "RATE_LIMIT",
    },
  }),
  async (req, res) => {
    const data = z
      .object({
        message: z.string().trim().min(3).max(1000),
        requestId: z.uuid(),
      })
      .parse(req.body);
    const sources = retrieveLife(data.message);
    const result: LifeAnswer = {
      mode: sources.length ? "sources" : "no-evidence",
      answer: "",
      notice: sources.length
        ? "İlgili rehber bilgileri aşağıda. Bu bilgiler yalnızca İSUBÜ kapsamındadır."
        : "Bu küçük rehberde sorunu cevaplayan bir kaynak bulunamadı. Üniversitenin ilgili birimine danışabilirsin.",
      sources,
    };
    if (!sources.length) return res.json(result);
    const config = await advisorConfig();
    if (!config.configured)
      return res.json({
        ...result,
        notice:
          "Yapay zekâ bağlantısı etkin değil. Bulunan kaynaklı rehber bilgilerini inceleyebilirsin.",
      });
    const userId = res.locals.user.id;
    await transaction(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
      if (
        (
          await c.query(
            "SELECT id FROM advisor_requests WHERE user_id=$1 AND request_key=$2",
            [userId, data.requestId],
          )
        ).rowCount
      )
        fail(409, "AI_DUPLICATE_REQUEST", "Bu istek daha önce işlendi.");
      const used = await c.query(
        "SELECT count(*)::int AS n FROM advisor_requests WHERE user_id=$1 AND created_at >= (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')",
        [userId],
      );
      if (used.rows[0].n >= config.dailyLimit)
        fail(
          429,
          "AI_DAILY_LIMIT",
          "Günlük danışman sınırına ulaştın. Kaynak aramasını kullanabilirsin.",
        );
      await c.query(
        "INSERT INTO advisor_requests(id,user_id,request_key,state) VALUES($1,$2,$3,'pending')",
        [randomUUID(), userId, data.requestId],
      );
    });
    try {
      const raw = await createAdvisorProvider(config).generate({
        message: data.message,
        state: searchStateSchema.parse({}),
        profile: defaultProfile,
        programs: [],
        history: [],
        evidence: sources.map((s, i) => ({
          id: `S${i + 1}`,
          title: s.title,
          text: s.text,
          period: s.period,
        })),
      });
      const parsed = z
        .object({ summary: z.string().min(1).max(4500) })
        .parse(raw);
      const citations = [...parsed.summary.matchAll(/\[S(\d+)\]/g)].map((x) =>
        Number(x[1]),
      );
      if (
        !citations.length ||
        citations.some((n) => n < 1 || n > sources.length)
      )
        throw new Error("Invalid evidence references");
      result.mode = "generated";
      result.answer = parsed.summary;
      result.notice =
        "Yanıt bu rehberde bulunan kaynaklardan oluşturuldu. Önemli işlemlerde resmî sayfadaki güncel duyuruyu kontrol et.";
      await pool.query(
        "UPDATE advisor_requests SET state='complete' WHERE user_id=$1 AND request_key=$2",
        [userId, data.requestId],
      );
    } catch {
      await pool.query(
        "UPDATE advisor_requests SET state='failed' WHERE user_id=$1 AND request_key=$2",
        [userId, data.requestId],
      );
      result.notice =
        "Danışman yanıtı oluşturulamadı. Bulunan kaynaklı rehber bilgilerini aşağıdan inceleyebilirsin.";
    }
    res.json(result);
  },
);
export default api;
