import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNotification,
  sanitizePayload,
} from "../server/services/notifications.ts";
import { notificationKinds } from "../shared/contracts.ts";

const qid = "11111111-1111-4111-8111-111111111111";
test("kendi eylemi için bildirim üretilmez", () => {
  assert.equal(
    buildNotification("u1", "answer_received", { questionId: qid }, "u1"),
    null,
  );
  const other = buildNotification(
    "u1",
    "answer_received",
    { questionId: qid },
    "u2",
  );
  assert.equal(other?.userId, "u1");
  assert.equal(other?.kind, "answer_received");
});
test("payload yalnızca beyaz listedeki alanları taşır", () => {
  const p = sanitizePayload({
    questionId: qid,
    title: "Kısa başlık",
    body: "özel mesaj içeriği",
    message: "gizli",
    documentName: "belge.pdf",
    fileUrl: "x",
  });
  assert.deepEqual(p, { questionId: qid, title: "Kısa başlık" });
});
test("başlık 80 karakterle sınırlıdır ve geçersiz kimlik reddedilir", () => {
  assert.throws(() => sanitizePayload({ title: "a".repeat(81) }));
  assert.throws(() => sanitizePayload({ questionId: "kimlik-degil" }));
});
test("bilinmeyen tür bildirim üretmez; sözleşmede altı tür tanımlı", () => {
  assert.equal(buildNotification("u1", "bilinmeyen", {}, "u2"), null);
  assert.equal(notificationKinds.length, 6);
  for (const k of notificationKinds)
    assert.ok(buildNotification("u1", k, {}, "u2"));
});
