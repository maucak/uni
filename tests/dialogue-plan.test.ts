import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePlan,
  contextFromPlan,
  type DialoguePlan,
} from "../server/services/rag/dialogue-plan.ts";
const plan = (): DialoguePlan => ({
  kind: "information",
  answer: "",
  query: "İSUBÜ yemek bursu şartları",
  state: {
    topic: "scholarship",
    intent: "başvuru koşulları",
    scope: "institution",
    known: {
      university: "İSUBÜ",
      city: "",
      program: "",
      scholarship: "yemek bursu",
    },
    scholarshipType: "meal",
    missing: [],
  },
});
test("assistant-invented institutions cannot establish user scope", () => {
  const result = validatePlan(plan(), [
    "burs konusunda sorum var",
    "yemek bursu",
  ]);
  assert.equal(result.kind, "clarification");
  assert.equal(result.state.known.university, "");
  assert.equal(result.query, "");
});
test("confirmed institution and resolved goal allow retrieval", () => {
  const result = validatePlan(plan(), [
    "yemek bursu başvuru şartları",
    "İSUBÜ",
  ]);
  assert.equal(result.kind, "information");
  assert.equal(contextFromPlan(result.state).university, "isubu");
});
test("national questions do not demand institution and unknown school stays unknown", () => {
  const p = plan();
  p.query = "KYK bursu başvuru şartları";
  p.state.scope = "national";
  p.state.scholarshipType = "kyk";
  p.state.known = { university: "", city: "", program: "", scholarship: "KYK" };
  const result = validatePlan(p, ["KYK bursu başvuru şartları"]);
  assert.equal(result.kind, "information");
  assert.equal(contextFromPlan(result.state).university, "unknown");
});
test("missing goal blocks an invented search and malformed planner output is rejected", () => {
  const p = plan();
  p.state.missing = ["question"];
  assert.equal(validatePlan(p, ["İSUBÜ yemek bursu"]).kind, "clarification");
  assert.throws(() => validatePlan({ kind: "information" }, []));
});

test("known institution abbreviations can map to canonical names without accepting another school", () => {
  const p = plan();
  p.state.known.university = "Isparta Uygulamalı Bilimler Üniversitesi";
  assert.equal(validatePlan(p, ["İSUBÜ", "yemek bursu"]).kind, "information");
  assert.equal(validatePlan(p, ["SDÜ", "yemek bursu"]).kind, "clarification");
});

test("Pamukkale abbreviation resolves to its own university scope", () => {
  const p = plan();
  p.state.known.university = "Pamukkale Üniversitesi";
  const r = validatePlan(p, ["PAÜ yemek bursu başvuru koşulları"]);
  assert.equal(contextFromPlan(r.state).university, "pau");
  assert.equal(
    contextFromPlan(r.state).universityName,
    "Pamukkale Üniversitesi",
  );
});

test("Akdeniz institution is resolved to its own source scope", () => {
  const p = plan();
  p.state.known.university = "Akdeniz Üniversitesi";
  const r = validatePlan(p, [
    "Akdeniz Üniversitesi yemek bursu başvuru koşulları",
  ]);
  assert.equal(contextFromPlan(r.state).university, "akdeniz");
});

test("a fabricated university name containing a real abbreviation is not accepted", () => {
  const p = plan();
  p.state.known.university = "İstanbul SDÜ Üniversitesi";
  const r = validatePlan(p, ["SDÜ yemek bursu başvuru şartları nelerdir?"]);
  assert.equal(r.state.known.university, "SDÜ");
  assert.ok(!r.query.includes("İstanbul"));
});

test("answering the final missing field resumes the existing search without confirmation loops", () => {
  const p = plan();
  p.kind = "clarification";
  p.query = "";
  p.answer = "İSUBÜ için mi?";
  const previous = {
    ...p.state,
    known: { ...p.state.known, university: "" },
    missing: ["university" as const],
  };
  const r = validatePlan(
    p,
    ["yemek bursu başvuru koşulları", "İSUBÜ"],
    previous,
  );
  assert.equal(r.kind, "information");
  assert.match(r.query, /İSUBÜ.*yemek bursu.*koşulları/);
});

test("institutional meal scholarship cannot be searched under an unspecified scope", () => {
  const p = plan();
  p.state.scope = "unspecified";
  p.state.known.university = "";
  const r = validatePlan(p, ["yemek bursu başvuru şartları"]);
  assert.equal(r.kind, "clarification");
  assert.ok(r.state.missing.includes("university"));
});

test("free-form search query cannot substitute an invented university", () => {
  const p = plan();
  p.query = "İstanbul Şehir Üniversitesi yemek bursu";
  const r = validatePlan(p, ["İSUBÜ yemek bursu başvuru koşulları"]);
  assert.match(r.query, /İSUBÜ/);
  assert.ok(!r.query.includes("İstanbul"));
});

test("an objection without new facts cannot complete a pending task", () => {
  const p = plan();
  p.kind = "clarification";
  p.answer = "Neyi kastettiğini biraz açar mısın?";
  p.query = "";
  p.state.known.university = "";
  p.state.scope = "national";
  const previous = {
    ...p.state,
    missing: ["city" as const, "question" as const],
  };
  assert.equal(
    validatePlan(p, ["onu demedim"], previous).kind,
    "clarification",
  );
});

test("a specific question with an explicitly named university can search general rules before asking for program", () => {
  const p = plan();
  p.kind = "clarification";
  p.answer = "İstanbul Şehir Üniversitesinde hangi bölüm?";
  p.query = "";
  p.state.topic = "preparation";
  p.state.known = {
    university: "İSUBÜ",
    city: "",
    program: "",
    scholarship: "",
  };
  p.state.missing = ["program"];
  const r = validatePlan(p, [
    "İSUBÜ İngilizce 101 dersinden nasıl muaf olurum?",
  ]);
  assert.equal(r.kind, "information");
  assert.match(r.query, /İSUBÜ İngilizce 101/);
  assert.doesNotMatch(r.query, /İstanbul/);
});

test("a broad scholarship request still asks for missing scholarship type", () => {
  const p = plan();
  p.kind = "clarification";
  p.state.known.scholarship = "";
  p.state.missing = ["scholarship"];
  const r = validatePlan(p, [
    "İSUBÜ burs olanakları hakkında ne öğrenebilirim?",
  ]);
  assert.equal(r.kind, "clarification");
  assert.match(r.answer, /burs türü/);
});
