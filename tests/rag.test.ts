import test from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../server/services/rag/chunking.ts";
import {
  contextFor,
  retrievalQuestion,
} from "../server/services/rag/context.ts";
import { validateGroundedAnswer } from "../server/services/rag/grounding.ts";
import { eligible, dot, levelCompatible } from "../server/services/rag/search.ts";
import { liveDataNotice } from "../server/services/rag/live-data.ts";
import type { KnowledgeChunk } from "../server/services/rag/knowledge.ts";
const source = {
  id: "proof",
  title: "Yurt kayıt",
  topic: "Barınma",
  text: "Kayıt belgesi ve taahhütname gerekir.",
  url: "https://example.org/official",
  sourceTitle: "Resmî bilgi",
  checkedAt: "2026-10-21",
  period: null,
  keywords: [],
};
test('only explicit education levels exclude a conflicting source; missing level remains unknown',()=>{
 assert.equal(levelCompatible('Lisans yatay geçiş şartları','Lisansüstü Programlara Yatay Geçiş'),false);
 assert.equal(levelCompatible('Yüksek lisans yatay geçiş','Lisansüstü Programlara Yatay Geçiş'),true);
 assert.equal(levelCompatible('Yatay geçiş şartları','Lisansüstü Programlara Yatay Geçiş'),true);
 assert.equal(levelCompatible('Lisans yatay geçiş','Yatay Geçiş Başvuru Tarihleri'),true);
});
test("live prices and availability cannot be inferred from indexed FAQ text", () => {
  assert.ok(liveDataNotice("Güncel yurt ücreti ne kadar?"));
  assert.ok(liveDataNotice("Aktif kupon veya indirim var mı?"));
  assert.equal(liveDataNotice("Yurt başvurusu nasıl yapılır?"), "");
});
test("claim citations reject made-up sources and unsupported numbers", () => {
  assert.equal(
    validateGroundedAnswer("Kayıt belgesi gerekir. [S1]", [source]),
    "Kayıt belgesi gerekir. [S1]",
  );
  assert.throws(() => validateGroundedAnswer("Ücret 900 TL. [S1]", [source]));
  assert.throws(()=>validateGroundedAnswer('Ücret 26 TL. [S1]',[{...source,text:'2026 yılı rehberidir.'}]));
  assert.throws(() =>
    validateGroundedAnswer("Kayıt belgesi gerekir. [S2]", [source]),
  );
  assert.throws(() =>
    validateGroundedAnswer("Kayıt belgesi gerekir.", [source]),
  );
  assert.throws(() =>
    validateGroundedAnswer("Bağlantı https://invented.invalid [S1]", [source]),
  );
});
test('a numeric validity period must preserve a condition stated by its source',()=>{
 const conditionalSource={...source,text:'Sonuç belgesi üzerinde bir geçerlilik tarihi belirtilmemiş ise sınav sonucunun açıklandığı tarihten itibaren beş (5) yıldır.'};
 assert.throws(()=>validateGroundedAnswer('Sınav sonuçları beş yıl geçerlidir. [S1]',[conditionalSource]),/conditional/);
 assert.doesNotThrow(()=>validateGroundedAnswer('Belgede geçerlilik tarihi belirtilmemiş ise sınav sonucu beş yıldır. [S1]',[conditionalSource]));
});
test("chunking preserves every word and keeps bounded retrieval units", () => {
  const text = Array.from(
    { length: 120 },
    (_, i) => `Madde${i} bu koşul ve istisnasını birlikte açıklar.`,
  ).join(" ");
  const chunks = chunkText(text, 250);
  for (let i = 0; i < 120; i++)
    assert.ok(chunks.some((c) => c.includes(`Madde${i} `)));
  assert.ok(chunks.every((c) => c.length < 500));
});
test("Turkish institution names do not cross scopes; explicit change resets university", () => {
  assert.equal(
    contextFor("SDÜ hazırlık koşulları").context.university,
    "sdu",
  );
  assert.equal(
    contextFor("İSUBÜ hazırlık koşulları", { university: "other" }).context
      .university,
    "isubu",
  );
  const first = contextFor("Bilgisayar Mühendisliğinde hazırlık muafiyet", {
    year: 2026,
  }).context;
  const next = contextFor("Benim bölümüm turizm", first).context;
  assert.equal(next.program, "tourism");
  assert.ok(
    !retrievalQuestion(
      "Benim bölümüm turizm",
      next,
      "Bilgisayar Mühendisliği",
    ).includes("Bilgisayar"),
  );
  assert.equal(
    contextFor("Yazılım Mühendisliği hazırlık").context.program,
    "software",
  );
  assert.ok(contextFor("Hazırlığı atlayabilir miyim?").clarification);
});
test("university, program and historical scope are enforced before ranking", () => {
  const chunk = {
    id: "chunk",
    documentId: "doc",
    hash: "a",
    body: source.text,
    article: {
      ...source,
      scope: "isubu",
      historical: true,
      period: "2026 geçmiş",
      program: "computer",
    },
    embedding: null,
  } as KnowledgeChunk;
  assert.equal(
    eligible(chunk, {
      university: "other",
      universityName: "SDÜ",
      program: "computer",
      year: 2026,
      subject: "preparation",
    }),
    false,
  );
  assert.equal(
    eligible(chunk, {
      university: "isubu",
      universityName: "İSUBÜ",
      program: "computer",
      year: null,
      subject: "preparation",
    }),
    false,
  );
  assert.equal(
    eligible(chunk, {
      university: "isubu",
      universityName: "İSUBÜ",
      program: "tourism",
      year: 2026,
      subject: "preparation",
    }),
    false,
  );
  assert.equal(
    eligible(chunk, {
      university: "isubu",
      universityName: "İSUBÜ",
      program: "computer",
      year: 2026,
      subject: "preparation",
    }),
    true,
  );
  assert.equal(dot([1, 0], [0, 1]), 0);
});

 test("KYK questions recognize housing and clarify broad local questions", () => {
  const broad = contextFor("ısparta kyk nasıl");
  assert.equal(broad.context.subject, "housing");
  assert.ok(broad.clarification.includes("başvuru"));
  const specific = contextFor("KYK başvurusu nasıl yapılır?");
  assert.equal(specific.clarification, "");
  assert.match(retrievalQuestion("KYK başvurusu nasıl yapılır?", specific.context), /GSB.*yurt/);
 });

test("scholarship kind and university must be established before institutional retrieval", () => {
  const broad=contextFor("burs konusunda sorum var");
  assert.equal(broad.context.university,"unknown");
  assert.match(broad.clarification,/Hangi bursu/);
  const meal=contextFor("yemek bursu",broad.context);
  assert.match(meal.clarification,/Hangi üniversite/);
  const school=contextFor("İSUBÜ",meal.context);
  assert.equal(school.context.scholarshipType,"meal");
  assert.equal(school.context.subject,"scholarship");
  assert.equal(school.context.university,"isubu");
  assert.match(school.clarification,/neyi öğrenmek/);
  assert.equal(contextFor("burs konusunda sorum var",{university:"isubu",universityName:"İSUBÜ"}).context.university,"unknown");
  const institutional={id:"test",documentId:"doc",hash:"hash",body:"",embedding:null,article:{...source,scope:"isubu"}} as KnowledgeChunk;
  assert.equal(eligible(institutional,broad.context),false);
  const national={...institutional,article:{...source,scope:"national"}} as KnowledgeChunk;
  assert.equal(eligible(national,broad.context),true);
  const kyk=contextFor("KYK burs başvurusu nasıl yapılır?");
  assert.equal(kyk.clarification,"");
  assert.equal(eligible({...institutional,article:{...source,title:"Yemek bursu başvurusu",scope:"isubu"}} as KnowledgeChunk,{...kyk.context,university:"isubu"}),false);
});

test("choosing a scholarship type does not invent a question and retains an earlier concrete question",()=>{
  const generic=contextFor("burs konusunda sorum var").context;
  assert.match(contextFor("kyk bursu",generic).clarification,/neyi öğrenmek/);
  const question=contextFor("Burs başvurusunu nasıl yaparım?").context;
  assert.equal(contextFor("KYK bursu",question).clarification,"");
  assert.equal(contextFor("başvuru şartları",contextFor("KYK bursu",generic).context).context.scholarshipType,"kyk");
});
