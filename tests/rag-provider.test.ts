import test from "node:test";
import assert from "node:assert/strict";
import { GroqProvider, GeminiProvider } from "../server/services/advisor.ts";
import { defaultProfile, searchStateSchema } from "../shared/contracts.ts";
const context = {
  message: "Yurt başvurusu nasıl yapılır?",
  state: searchStateSchema.parse({}),
  profile: defaultProfile,
  programs: [],
  history: [],
  evidence: [
    {
      id: "S1",
      title: "Yurt kayıt rehberi",
      text: "Başvurular e-Devlet üzerinden yapılır.",
      period: null,
    },
  ],
  signal: new AbortController().signal,
};
const plan = {
  summary: "Başvurunu e-Devlet üzerinden yapabilirsin. [S1]",
  questions: [],
  changes: [],
  programIds: [],
};
test("Groq receives retrieved evidence and grounding instruction, not an AbortSignal payload", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.match(body.messages[0].content, /evidence/);
    const payload = JSON.parse(body.messages[1].content);
    assert.equal(payload.evidence[0].id, "S1");
    assert.equal(payload.signal, undefined);
    assert.ok(init?.signal);
    return new Response(
      JSON.stringify({
        choices: [
          { finish_reason: "stop", message: { content: JSON.stringify(plan) } },
        ],
      }),
      { status: 200 },
    );
  };
  try {
    assert.deepEqual(
      await new GroqProvider("test-key", "test-model").generate(context),
      plan,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("Gemini grounded evidence uses the same validated response contract", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.match(body.systemInstruction.parts[0].text, /evidence/);
    assert.equal(
      JSON.parse(body.contents[0].parts[0].text).evidence[0].title,
      "Yurt kayıt rehberi",
    );
    return new Response(
      JSON.stringify({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(plan) }] },
          },
        ],
      }),
      { status: 200 },
    );
  };
  try {
    assert.deepEqual(
      await new GeminiProvider("test-key", "gemini-2.5-flash").generate(
        context,
      ),
      plan,
    );
  } finally {
    globalThis.fetch = original;
  }
});
