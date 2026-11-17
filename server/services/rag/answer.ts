import { institutions } from "../../../shared/institutions.ts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, transaction } from "../../db.ts";
import { fail } from "../../errors.ts";
import {
  defaultProfile,
  searchStateSchema,
} from "../../../shared/contracts.ts";
import { advisorConfig, createAdvisorProvider } from "../advisor.ts";
import { validateGroundedAnswer } from "./grounding.ts";
import type { LifeAnswer } from "../../../shared/life.ts";
import type { TurnSession } from "./conversations.ts";
export async function generateAnswer(
  session: TurnSession,
  message: string,
  result: LifeAnswer,
  onGenerate?: () => void,
  signal?: AbortSignal,
) {
  const config = await advisorConfig();
  if (!config.configured) {
    result.notice =
      "Bulunan kaynakları aşağıda inceleyebilirsin. Yapay zekâ ile yanıt oluşturma şu anda etkin değil.";
    return;
  }
  let reserved = false;
  try {
    signal?.throwIfAborted();
    await transaction(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        session.userId,
      ]);
      const existing = await c.query(
        "SELECT 1 FROM advisor_requests WHERE user_id=$1 AND request_key=$2",
        [session.userId, session.requestId],
      );
      if (existing.rowCount) return;
      const used = await c.query(
        "SELECT count(*)::int AS n FROM advisor_requests WHERE user_id=$1 AND created_at >= (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')",
        [session.userId],
      );
      if (used.rows[0].n >= config.dailyLimit)
        fail(
          429,
          "AI_DAILY_LIMIT",
          "Günlük danışman sınırına ulaştın. Kaynak araması kullanılabilir.",
        );
      await c.query(
        "INSERT INTO advisor_requests(id,user_id,request_key,state) VALUES($1,$2,$3,'pending')",
        [randomUUID(), session.userId, session.requestId],
      );
    });
    reserved = true;
    onGenerate?.();
    const raw = await createAdvisorProvider(config).generate({
      signal,
      message,
      state: searchStateSchema.parse({}),
      profile: defaultProfile,
      programs: [],
      history: session.history.map((h) => ({
        role: h.role,
        text:
          h.role === "user"
            ? h.payload.message
            : h.payload.answer || h.payload.notice,
      })),
      evidence: result.sources.map((s, i) => ({
        id: `S${i + 1}`,
        title: `${s.title} (${s.scope === "national" ? "Türkiye geneli" : institutions.find((i) => i.id === s.scope)?.name || "Kurum bilgisi bulunamadı"})`,
        text: s.text,
        period: s.period,
      })),
    });
    const parsed = z
      .object({ summary: z.string().min(1).max(4500) })
      .parse(raw);
    const draft = validateGroundedAnswer(parsed.summary, result.sources);
    const review = await createAdvisorProvider(config).generate({
      task: "verify",
      draftAnswer: draft,
      signal,
      message,
      state: searchStateSchema.parse({}),
      profile: defaultProfile,
      programs: [],
      history: [],
      evidence: result.sources.map((s, i) => ({
        id: `S${i + 1}`,
        title: s.title,
        text: s.text,
        period: s.period,
      })),
    });
    const checked = z
      .object({ supported: z.boolean(), reason: z.string().max(2000) })
      .parse(review);
    if (!checked.supported) throw new Error("Unsupported answer conditions");
    result.answer = draft;
    result.mode = "generated";
    result.notice =
      "Yanıt bulunan kaynaklara dayanır. İşlem yapmadan önce kaynaktaki birim ve dönem koşullarını kontrol et.";
    await pool.query(
      "UPDATE advisor_requests SET state='complete' WHERE user_id=$1 AND request_key=$2",
      [session.userId, session.requestId],
    );
  } catch (error) {
    const failure = error as {
      name?: string;
      code?: string;
      providerStatus?: number;
    };
    console.warn("advisor_answer_failed", {
      code: failure.code || failure.name || "UNKNOWN",
      providerStatus: failure.providerStatus,
      grounding:
        error instanceof Error &&
        /Unsupported|Invalid answer/.test(error.message),
    });
    if (reserved)
      await pool.query(
        "UPDATE advisor_requests SET state='failed' WHERE user_id=$1 AND request_key=$2",
        [session.userId, session.requestId],
      );
    result.notice =
      (error as any).code === "AI_DAILY_LIMIT"
        ? "Günlük yanıt sınırına ulaşıldı; bulunan kaynakları inceleyebilirsin."
        : "Model yanıtı oluşturulamadı veya kaynak denetimini geçmedi. Bulunan kaynakları inceleyebilirsin.";
  }
}
