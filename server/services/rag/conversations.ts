import { randomUUID } from "node:crypto";
import { pool, transaction } from "../../db.ts";
import { fail } from "../../errors.ts";
import { digest } from "./chunking.ts";
import type { LifeAnswer } from "../../../shared/life.ts";
import type { RagContext } from "./context.ts";
export type TurnInput = {
  requestId: string;
  conversationId: string | null;
  message: string;
};
export type TurnSession = {
  userId: string;
  id: string;
  requestId: string;
  token: string;
  history: { role: string; payload: any }[];
  context: Partial<RagContext>;
};
export async function beginTurn(
  userId: string,
  input: TurnInput,
): Promise<{ cached: LifeAnswer } | { session: TurnSession }> {
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    const hash = digest(JSON.stringify(input));
    const existing = await c.query(
      "SELECT * FROM rag_requests WHERE user_id=$1 AND request_key=$2",
      [userId, input.requestId],
    );
    if (existing.rowCount) {
      const row = existing.rows[0];
      if (row.payload_hash !== hash)
        fail(
          409,
          "REQUEST_MISMATCH",
          "Bu istek kimliği farklı bir mesaj için kullanılmış.",
        );
      if (row.state === "complete")
        return { cached: row.response as LifeAnswer };
      fail(
        409,
        row.state === "pending" ? "REQUEST_PENDING" : "REQUEST_FAILED",
        row.state === "pending"
          ? "Bu mesaj işleniyor."
          : "Bu mesaj tamamlanamadı. Yeniden gönderebilirsin.",
      );
    }
    const id = input.conversationId || randomUUID(),
      token = randomUUID();
    let context: Partial<RagContext> = {};
    if (input.conversationId) {
      const row = await c.query(
        "SELECT context,busy_until>now() AS busy FROM life_conversations WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [id, userId],
      );
      if (!row.rowCount) fail(404, "NOT_FOUND", "Konuşma bulunamadı.");
      if (row.rows[0].busy)
        fail(409, "BUSY", "Bu konuşmada bir yanıt hazırlanıyor.");
      context = row.rows[0].context;
      const count = await c.query(
        "SELECT count(*)::int AS n FROM life_messages WHERE conversation_id=$1",
        [id],
      );
      if (count.rows[0].n >= 100)
        fail(
          409,
          "CONVERSATION_FULL",
          "Bu konuşma doldu. Yeni bir konuşma başlatabilirsin.",
        );
    } else {
      const count = await c.query(
        "SELECT count(*)::int AS n FROM life_conversations WHERE user_id=$1",
        [userId],
      );
      if (count.rows[0].n >= 100)
        fail(
          409,
          "CONVERSATION_LIMIT",
          "Yeni bir konuşma için eski bir konuşmayı sil.",
        );
      await c.query(
        "INSERT INTO life_conversations(id,user_id,title) VALUES($1,$2,$3)",
        [id, userId, input.message.slice(0, 70)],
      );
    }
    await c.query(
      "UPDATE life_conversations SET busy_until=now()+interval '2 minutes',busy_token=$1 WHERE id=$2",
      [token, id],
    );
    await c.query(
      "INSERT INTO rag_requests(user_id,request_key,conversation_id,state,payload_hash) VALUES($1,$2,$3,'pending',$4)",
      [userId, input.requestId, id, hash],
    );
    const history = (
      await c.query(
        "SELECT role,payload FROM (SELECT id,role,payload FROM life_messages WHERE conversation_id=$1 ORDER BY id DESC LIMIT 8) t ORDER BY id",
        [id],
      )
    ).rows;
    return {
      session: {
        userId,
        id,
        requestId: input.requestId,
        token,
        history,
        context,
      },
    };
  });
}
export async function finishTurn(
  session: TurnSession,
  message: string,
  response: LifeAnswer,
  context: RagContext,
  diagnostics?: unknown,
  corpusVersion = "none",
) {
  await transaction(async (c) => {
    const owned = await c.query(
      "UPDATE life_conversations SET context=$1,updated_at=now(),busy_until=null,busy_token=null WHERE id=$2 AND user_id=$3 AND busy_token=$4 RETURNING id",
      [JSON.stringify(context), session.id, session.userId, session.token],
    );
    if (!owned.rowCount)
      fail(
        409,
        "LEASE_EXPIRED",
        "Konuşma isteğinin süresi doldu. Yeniden gönderebilirsin.",
      );
    await c.query(
      "INSERT INTO life_messages(conversation_id,role,payload) VALUES($1,'user',$2),($1,'assistant',$3)",
      [session.id, JSON.stringify({ message }), JSON.stringify(response)],
    );
    await c.query(
      "UPDATE rag_requests SET state='complete',response=$1 WHERE user_id=$2 AND request_key=$3",
      [JSON.stringify(response), session.userId, session.requestId],
    );
    if (diagnostics)
      await c.query(
        "INSERT INTO rag_retrieval_runs(id,user_id,conversation_id,request_key,corpus_version,query_hash,diagnostics) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          randomUUID(),
          session.userId,
          session.id,
          session.requestId,
          corpusVersion,
          digest(response.retrievalQuery || message),
          JSON.stringify(diagnostics),
        ],
      );
  });
}
export async function abandonTurn(session: TurnSession) {
  await transaction(async (c) => {
    await c.query(
      "UPDATE rag_requests SET state='failed' WHERE user_id=$1 AND request_key=$2 AND state='pending'",
      [session.userId, session.requestId],
    );
    await c.query(
      "UPDATE life_conversations SET busy_until=null,busy_token=null WHERE id=$1 AND busy_token=$2",
      [session.id, session.token],
    );
  });
}
