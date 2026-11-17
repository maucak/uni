import test from "node:test";
import assert from "node:assert/strict";
import { greetingAnswer } from "../server/services/rag/greeting.ts";
test("standalone greetings are answered without swallowing real questions", () => {
  for (const text of ["selam", "selamm", "selaaammm!!!", "merhabaaa", "hello", "Merhaba!", "İyi akşamlar", "selam nasılsın?"]) assert.ok(greetingAnswer(text));
  for (const text of ["Selam, KYK başvurusu nasıl yapılır?", "merhaba yurt", "selammm KYK başvurusu nasıl yapılır?", "KYK", ""]) assert.equal(greetingAnswer(text), "");
});
