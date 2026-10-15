import test from "node:test";
import assert from "node:assert/strict";
import { retrieveLife } from "../server/services/life-retrieval.ts";
import { defaultProfile, profileSchema } from "../shared/contracts.ts";
test("Turkish preparation question retrieves dated, department-specific evidence", () => {
  const results = retrieveLife("Hazırlık muafiyet sınavı");
  assert.equal(results[0].id, "prep");
  assert.match(results[0].period!, /geçmiş/);
  assert.match(results[0].text, /bütün bölümlere genellenemez/);
});
test("unknown topic does not silently return unrelated guide content", () => {
  assert.deepEqual(retrieveLife("Kuantum optiği laboratuvarları"), []);
  assert.equal(retrieveLife("OBS şifremi unuttum")[0].id, "obs");
});
test("old profiles receive defaults; new student fields survive validation", () => {
  const { studentCity, campus, studyStage, ...old } = defaultProfile;
  const parsed = profileSchema.parse({ ...old, displayName: "Öğrenci" });
  assert.equal(parsed.studentCity, "");
  const student = profileSchema.parse({
    ...parsed,
    role: "student",
    studentCity: "Isparta",
    campus: "Merkez",
    studyStage: "prep",
  });
  assert.equal(student.studyStage, "prep");
  assert.equal(student.campus, "Merkez");
});
