import { randomUUID } from "node:crypto";
import { pool, transaction } from "../../db.ts";
import { z } from "zod";
import { greetingAnswer } from "./greeting.ts";
import { advisorConfig, createAdvisorProvider } from "../advisor.ts";
import { defaultProfile, searchStateSchema } from "../../../shared/contracts.ts";
import { validatePlan } from "./dialogue-plan.ts";
import type { DialogueState, DialoguePlan } from "./dialogue-plan.ts";
export type MessageRoute = {kind:DialoguePlan["kind"];answer:string;query:string;state?:DialogueState;notice?:string};
export type RouteHistory = {role:"user"|"assistant";text:string}[];
export async function routeMessage(message: string, history: RouteHistory, signal?: AbortSignal, usage?: {userId:string;requestId:string}, previous?:DialogueState, profileUniversity=""): Promise<MessageRoute> {
  const config = await advisorConfig();
  if (config.configured) {
    try {
      if (usage) {
        const allowed = await transaction(async c => {
          await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",[usage.userId]);
          const used=await c.query("SELECT count(*)::int AS n FROM advisor_requests WHERE user_id=$1 AND created_at >= (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')",[usage.userId]);
          if(used.rows[0].n>=config.dailyLimit)return false;
          await c.query("INSERT INTO advisor_requests(id,user_id,request_key,state) VALUES($1,$2,$3,'pending')",[randomUUID(),usage.userId,usage.requestId]);
          return true;
        });
        if(!allowed)return {kind:"clarification",answer:"Günlük danışman kullanım sınırına ulaştın. Kaynak rehberini ve program kataloğunu doğrudan kullanabilirsin.",query:""};
      }
      const raw = await createAdvisorProvider({...config,model:config.routerModel}).generate({ task:"route", conversationState:previous, profileUniversity, signal, message, state:searchStateSchema.parse({}), profile:defaultProfile, programs:[], history });
      const route=validatePlan(raw,[...history.filter(h=>h.role==="user").map(h=>h.text),message],previous,profileUniversity);
      if(usage)await pool.query("UPDATE advisor_requests SET state='complete' WHERE user_id=$1 AND request_key=$2",[usage.userId,usage.requestId]);
      return route;
    } catch (error) {
      const failure=error as {code?:string;name?:string;providerStatus?:number};
      console.warn("advisor_route_failed", {code:failure.code || failure.name || "UNKNOWN",providerStatus:failure.providerStatus,invalidOutput:error instanceof z.ZodError});
      if(usage)await pool.query("UPDATE advisor_requests SET state='failed' WHERE user_id=$1 AND request_key=$2",[usage.userId,usage.requestId]);
      signal?.throwIfAborted();
      return {kind:"clarification",answer:failure.providerStatus === 429 ? "Yapay zekâ servisinin kullanım sınırına ulaşıldı. Biraz sonra tekrar deneyebilirsin; kaynak rehberi ve katalog kullanılabilir." : "Şu an konuşma servisi yanıt veremedi. Biraz sonra tekrar deneyebilirsin; kaynak rehberi ve katalog kullanılabilir.",query:"",notice:"Konuşma servisi yanıt veremedi veya geçerli bir yönlendirme üretmedi."};
    }
  }
  const greeting=greetingAnswer(message);
  if(greeting)return {kind:"conversation",answer:greeting,query:""};
  return {kind:"information",answer:"",query:message,notice:"Konuşma modeli etkin değil; doğrudan kaynak araması kullanılıyor."};
}
