import { contextFromPlan } from "../services/rag/dialogue-plan.ts";
import { routeMessage } from "../services/rag/message-router.ts";
import { Router } from "express";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { requireUser } from "../auth.ts";
import { pool } from "../db.ts";
import { fail } from "../errors.ts";
import { defaultProfile } from "../../shared/contracts.ts";
import { lifeArticles, lifeCampus } from "../services/life-content.ts";
import { loadKnowledge } from "../services/rag/knowledge.ts";
import { bm25, eligible } from "../services/rag/search.ts";
import { contextFor, retrievalQuestion } from "../services/rag/context.ts";
import { retrieve } from "../services/rag/retrieve.ts";
import {
  beginTurn,
  finishTurn,
  abandonTurn,
} from "../services/rag/conversations.ts";
import { generateAnswer } from "../services/rag/answer.ts";
import { catalogAction } from "../services/rag/catalog-action.ts";
import { liveDataNotice } from "../services/rag/live-data.ts";
import type { LifeAnswer } from "../../shared/life.ts";
const api = Router();
api.put("/me/life-progress", requireUser, async (req, res) => {
  const { steps } = z
    .object({
      steps: z
        .array(
          z.enum([
            "registration",
            "obs",
            "calendar",
            "prep",
            "housing",
            "campus",
          ]),
        )
        .max(6),
    })
    .parse(req.body);
  const result = await pool.query(
    "UPDATE users SET profile=jsonb_set(profile,'{lifeSteps}',$1::jsonb) WHERE id=$2 RETURNING *",
    [JSON.stringify([...new Set(steps)]), res.locals.user.id],
  );
  res.json({
    id: result.rows[0].id,
    email: result.rows[0].email,
    profile: { ...defaultProfile, ...result.rows[0].profile },
  });
});
api.get("/life/guide", async (req, res) => {
  const q = z
      .string()
      .trim()
      .max(500)
      .parse(req.query.q ?? ""),
    topic = z
      .string()
      .max(60)
      .parse(req.query.topic ?? "");
  const index = await loadKnowledge(),
    context = contextFor(q).context;
  const chunks = index.chunks.filter(
    (c) => eligible(c, context) && (!topic || c.article.topic === topic),
  );
  const seen = new Set<string>();
  const found = q ? bm25(q, chunks).map((r) => r.chunk) : chunks;
  const items =
    q || topic
      ? found
          .filter((c) => {
            if (seen.has(c.documentId)) return false;
            seen.add(c.documentId);
            return true;
          })
          .slice(0, q ? 12 : 25)
          .map((c) => c.article)
      : lifeArticles;
  res.json({
    campus: lifeCampus,
    items,
    knowledge: {
      version: index.version,
      chunks: index.chunks.length,
      sources: index.sources,
      embeddingCoverage: index.embeddingCoverage,
    },
  });
});
api.get("/life/sources", async (_req, res) => {
  const rows =
    await pool.query(`SELECT s.url,s.title,s.scope,s.checked_at,s.active_version_id,
   count(DISTINCT d.id)::int AS documents,count(c.id)::int AS chunks
   FROM rag_sources s LEFT JOIN rag_documents d ON d.source_id=s.id AND d.version_id=s.active_version_id
   LEFT JOIN rag_chunks c ON c.document_id=d.id WHERE s.enabled GROUP BY s.id ORDER BY s.title`);
  res.json({ items: rows.rows });
});
api.get("/life/conversations", requireUser, async (_req, res) =>
  res.json(
    (
      await pool.query(
        "SELECT id,title,updated_at FROM life_conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 30",
        [res.locals.user.id],
      )
    ).rows,
  ),
);
api.post("/life/feedback", requireUser, async (req, res) => {
  const data = z
    .object({
      requestId: z.uuid(),
      rating: z.union([z.literal(-1), z.literal(1)]),
    })
    .parse(req.body);
  const owned = await pool.query(
    "SELECT request_key FROM rag_requests WHERE user_id=$1 AND request_key=$2 AND state='complete'",
    [res.locals.user.id, data.requestId],
  );
  if (!owned.rowCount) fail(404, "NOT_FOUND", "Yanıt bulunamadı.");
  await pool.query(
    "INSERT INTO rag_feedback(user_id,request_key,rating) VALUES($1,$2,$3) ON CONFLICT(user_id,request_key) DO UPDATE SET rating=EXCLUDED.rating,updated_at=now()",
    [res.locals.user.id, data.requestId, data.rating],
  );
  res.json({ rating: data.rating });
});
api.get("/life/conversations/:id", requireUser, async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  if (
    !(
      await pool.query(
        "SELECT id FROM life_conversations WHERE id=$1 AND user_id=$2",
        [id, res.locals.user.id],
      )
    ).rowCount
  )
    fail(404, "NOT_FOUND", "Konuşma bulunamadı.");
  res.json(
    (
      await pool.query(
        "SELECT m.role,CASE WHEN f.rating IS NOT NULL THEN m.payload||jsonb_build_object('feedback',f.rating) ELSE m.payload END AS payload FROM life_messages m LEFT JOIN rag_feedback f ON m.role='assistant' AND f.user_id=$2 AND f.request_key::text=m.payload->>'requestId' WHERE m.conversation_id=$1 ORDER BY m.id LIMIT 100",
        [id, res.locals.user.id],
      )
    ).rows,
  );
});
api.delete("/life/conversations/:id", requireUser, async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const row = await pool.query(
    "DELETE FROM life_conversations WHERE id=$1 AND user_id=$2 AND (busy_until IS NULL OR busy_until<now()) RETURNING id",
    [id, res.locals.user.id],
  );
  if (!row.rowCount) {
    if (
      (
        await pool.query(
          "SELECT id FROM life_conversations WHERE id=$1 AND user_id=$2",
          [id, res.locals.user.id],
        )
      ).rowCount
    )
      fail(409, "BUSY", "Yanıt tamamlandığında konuşmayı silebilirsin.");
    fail(404, "NOT_FOUND", "Konuşma bulunamadı.");
  }
  res.status(204).end();
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
    const input = z
      .object({
        message: z.string().trim().min(3).max(1000),
        requestId: z.uuid(),
        conversationId: z.uuid().nullable().default(null),
      })
      .parse(req.body);
    const turn = await beginTurn(res.locals.user.id, input);
    const streaming = req.query.stream === "1";
    const event = (name: string, data: unknown) => {
      if (streaming && !res.destroyed)
        res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    if (streaming) {
      res.set({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
    }
    if ("cached" in turn) {
      if (streaming) {
        event("answer", turn.cached);
        res.end();
        return;
      }
      return res.json(turn.cached);
    }
    const { session } = turn;
    const abort = new AbortController();
    const disconnected = () => {
      if (!res.writableEnded) abort.abort();
    };
    res.once("close", disconnected);
    try {
      event("phase", { phase: "searching" });
      const routed = await routeMessage(
        input.message,
        session.history.map((h) => ({
          role: h.role === "user" ? ("user" as const) : ("assistant" as const),
          text:
            h.role === "user"
              ? h.payload.message
              : h.payload.answer || h.payload.notice || "",
        })),
        abort.signal,
        { userId: session.userId, requestId: session.requestId },
        session.context.dialogue,
        res.locals.user.profile.university || "",
      );
      const effectiveMessage = routed.query || input.message;
      const context = routed.state
        ? contextFromPlan(routed.state)
        : {
            ...session.context,
            university: "unknown" as const,
            universityName: "",
            program: null,
            year: null,
            subject: "",
          };
      let response: LifeAnswer;
      let diagnostics;
      let corpusVersion = "none";
      const action =
        routed.kind === "catalog"
          ? await catalogAction(effectiveMessage, true)
          : null;
      const liveNotice = liveDataNotice(effectiveMessage);
      if (routed.kind !== "information" && routed.kind !== "catalog") {
        response = {
          mode:
            routed.kind === "conversation" ? "conversation" : "clarification",
          answer: routed.answer || "Sorunu biraz açabilir misin?",
          notice: routed.notice || "",
          sources: [],
        };
      } else if (action) {
        response = action;
      } else if (liveNotice) {
        response = {
          mode: "no-evidence",
          answer: liveNotice,
          notice: "Güncel işlem bilgisi için doğrulanmış canlı kaynak gerekir.",
          sources: [],
        };
      } else if (
        context.university === "other" &&
        context.subject !== "housing" &&
        routed.state?.scope !== "national"
      ) {
        response = {
          mode: "clarification",
          answer:
            "Bu üniversiteye özel bir kaynak henüz bulunmuyor. Üniversiteye özel rehber şu an İSUBÜ kapsamındadır. GSB yurt başvurusu gibi Türkiye geneli konularda yardımcı olabilirim.",
          notice:
            "Başka bir üniversitenin kurallarını senin üniversitene uygulamam.",
          sources: [],
        };
      } else {
        const query = effectiveMessage;
        const found = await retrieve(query, context);
        diagnostics = found.diagnostics;
        corpusVersion = diagnostics.corpusVersion;
        response = {
          mode: found.sources.length ? "sources" : "no-evidence",
          answer: "",
          notice: found.sources.length
            ? "Sorunla ilgili kaynaklar bulundu."
            : context.subject === "scholarship" &&
                context.scholarshipType === "kyk"
              ? "Sorunu anladım, ancak KYK bursuyla ilgili bu soruyu doğrulayacak bir kaynak mevcut havuzda bulunamadı. KYK yurt bilgilerini burs koşulları yerine kullanamam. GSB’nin resmî burs ve öğrenim kredisi duyurularını kontrol etmelisin."
              : "Bu soruya yeterince ilgili bir kaynak bulamadım. Konuyu, üniversiteyi veya işlemi biraz daha açık yazabilirsin.",
          sources: found.sources,
          retrievalQuery: query,
          retrieval: {
            method: diagnostics.mode,
            elapsedMs: diagnostics.elapsedMs,
            corpusVersion,
          },
        };
        event("sources", { sources: found.sources });
        if (found.sources.length)
          await generateAnswer(
            session,
            input.message,
            response,
            () => event("phase", { phase: "answering" }),
            abort.signal,
          );
      }
      response.conversationId = session.id;
      response.requestId = input.requestId;
      await finishTurn(
        session,
        input.message,
        response,
        context,
        diagnostics,
        corpusVersion,
      );
      if (streaming) {
        event("answer", response);
        res.end();
        return;
      }
      return res.json(response);
    } catch (error) {
      await abandonTurn(session);
      if (streaming) {
        event("error", {
          message: (error as any).status
            ? (error as Error).message
            : "İstek tamamlanamadı. Yeniden deneyebilirsin.",
          code: (error as any).code || "RAG_ERROR",
        });
        res.end();
        return;
      }
      throw error;
    } finally {
      res.removeListener("close", disconnected);
    }
  },
);
export default api;
