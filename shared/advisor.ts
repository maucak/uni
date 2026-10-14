import { z } from "zod";
import {
  searchStateSchema,
  type SearchState,
  type Program,
} from "./contracts.ts";
export const changeFields = [
  "search",
  "city",
  "scoreType",
  "language",
  "type",
  "rankMin",
  "rankMax",
  "maxTuition",
  "minScholarship",
  "includeUnknown",
  "sort",
] as const;
export const advisorPlanSchema = z
  .object({
    summary: z.string().max(2000),
    questions: z.array(z.string().max(300)).max(3),
    changes: z
      .array(
        z
          .object({ field: z.enum(changeFields), value: z.string().max(100) })
          .strict(),
      )
      .max(11),
    programIds: z.array(z.uuid()).max(4),
  })
  .strict();
export type AdvisorPlan = z.infer<typeof advisorPlanSchema>;
export type AdvisorReply = {
  conversationId: string;
  baseRevision: string;
  baseState: SearchState;
  proposedState: SearchState | null;
  plan: AdvisorPlan;
  programs: Program[];
  catalogVersion: string;
  provider: string;
  model: string;
};
export function applyChanges(state: SearchState, plan: AdvisorPlan) {
  if (new Set(plan.changes.map((c) => c.field)).size !== plan.changes.length)
    throw new Error("Aynı alan için çelişkili değişiklikler var.");
  const next = { ...state };
  for (const { field, value } of plan.changes) {
    if (
      ["rankMin", "rankMax", "maxTuition", "minScholarship"].includes(field)
    ) {
      if (value !== "" && !/^\d+(\.\d+)?$/.test(value))
        throw new Error("Geçersiz sayısal filtre önerisi.");
      (next as any)[field] = value === "" ? null : Number(value);
    } else if (field === "includeUnknown") {
      if (!["true", "false"].includes(value))
        throw new Error("Geçersiz eksik veri seçimi.");
      next.includeUnknown = value === "true";
    } else (next as any)[field] = value;
  }
  return searchStateSchema.parse(next);
}
export function validateAdvisorPlan(
  raw: unknown,
  state: SearchState,
  allowedPrograms: Program[],
) {
  const plan = advisorPlanSchema.parse(raw);
  const ids = new Set(allowedPrograms.map((p) => p.id));
  if (plan.programIds.some((id) => !ids.has(id)))
    throw new Error("Danışman katalog bağlamı dışındaki bir programı önerdi.");
  // A city not present in the context is allowed as a user filter, but not invented program metadata.
  const proposedState = plan.changes.length ? applyChanges(state, plan) : null;
  return { plan, proposedState };
}
