import test from "node:test";
import assert from "node:assert/strict";
import snapshot from "../data/life-knowledge.json" with { type: "json" };
import { defaultProfile, profileSchema } from "../shared/contracts.ts";
test("source snapshots contain unique IDs, readable Turkish and source locators", () => {
  const ids = snapshot.articles.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(
    snapshot.articles.every(
      (a) => a.url.startsWith("https://") && a.checkedAt && a.text,
    ),
  );
  assert.ok(
    snapshot.articles.every(
      (a) =>
        !/&(?:#x[0-9a-f]+|#\d+|uuml|ccedil|ouml);/i.test(
          a.title + " " + a.text,
        ),
    ),
  );
  assert.ok(snapshot.articles.some((a) => "page" in a && Number(a.page) > 0));
});
test("old profiles receive defaults and student fields survive validation", () => {
  const { studentCity, campus, studyStage, lifeSteps, ...old } = defaultProfile;
  const parsed = profileSchema.parse({ ...old, displayName: "Öğrenci" });
  assert.equal(parsed.studentCity, "");
  assert.deepEqual(parsed.lifeSteps, []);
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
