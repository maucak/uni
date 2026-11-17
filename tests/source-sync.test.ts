import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { syncSources } from "../scripts/life-sync.ts";
import { createHash } from "node:crypto";

test("source sync detects unchanged content, preserves other sources, and keeps last snapshot on extraction failure", async () => {
  const cwd = process.cwd(),
    fetchBefore = globalThis.fetch;
  const directory = await mkdtemp(join(tmpdir(), "kampus-source-test-"));
  const title = "1. Burs başvurusu nasıl yapılır?";
  const text =
    "Başvurular resmî başvuru ekranından öğrencinin kendisi tarafından yapılır.";
  const url =
    "https://kygm.gsb.gov.tr/Sayfalar/2446/2388/sikca-sorulan-sorular.aspx";
  const id =
    "gsb-burs-kredi-" +
    createHash("sha256").update(title).digest("hex").slice(0, 12);
  let html = `<strong>${title}</strong><p>${text}</p>`;
  try {
    process.chdir(directory);
    await mkdir("data");
    const other = {
      id: "other",
      url: "https://example.org/guide",
      text: "Başka kaynak korunacak.",
      title: "Diğer kaynak",
      checkedAt: "2020-01-01",
    };
    const article = {
      id,
      title,
      topic: "Burs ve kredi",
      text,
      keywords: ["KYK", "GSB", "burs", "öğrenim kredisi"],
      url,
      sourceTitle: "GSB · Burs ve öğrenim kredisi sıkça sorulan sorular",
      checkedAt: "2020-01-01",
      period: null,
      scope: "national",
      kind: "official-excerpt",
    };
    await writeFile(
      "data/life-knowledge.json",
      JSON.stringify({
        articles: [other, article],
        sources: [
          { id: "other", count: 1 },
          { id: "gsb-burs-kredi", count: 1 },
        ],
      }),
    );
    globalThis.fetch = async () => {
      const response = new Response(html, { status: 200 });
      Object.defineProperty(response, "url", { value: url });
      return response;
    };
    assert.equal(
      (await syncSources("gsb-burs-kredi")).changed,
      false,
      "A new check date alone must not trigger embeddings",
    );
    let snapshot = JSON.parse(
      await readFile("data/life-knowledge.json", "utf8"),
    );
    assert.deepEqual(
      snapshot.articles.find((a: any) => a.id === "other"),
      other,
    );
    html = `<strong>${title}</strong><p>${text} Yeni başvuru koşulu eklendi.</p>`;
    assert.equal((await syncSources("gsb-burs-kredi")).changed, true);
    const preserved = await readFile("data/life-knowledge.json", "utf8");
    html = "<html><body>Giriş yapın</body></html>";
    await assert.rejects(
      () => syncSources("gsb-burs-kredi"),
      /içerik bulunamadı/,
    );
    assert.equal(
      await readFile("data/life-knowledge.json", "utf8"),
      preserved,
      "Failed extraction must not replace the last working snapshot",
    );
  } finally {
    globalThis.fetch = fetchBefore;
    process.chdir(cwd);
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
