import { managedSources } from "../shared/source-registry.ts";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { mkdir, writeFile, rename, readFile } from "node:fs/promises";
import type { LifeArticle } from "../shared/life.ts";
import { extractPdf } from "../server/services/rag/pdf.ts";
async function fetchSource(
  url: string,
  limit = 3_000_000,
): Promise<Uint8Array> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok || new URL(response.url).host !== new URL(url).host)
        throw Object.assign(
          new Error(`Kaynak alınamadı (${response.status}): ${url}`),
          { permanent: true },
        );
      if (Number(response.headers.get("content-length") || 0) > limit)
        throw Object.assign(new Error("Kaynak boyut sınırı aşıldı."), {
          permanent: true,
        });
      if (!response.body) throw new Error("Kaynak boş.");
      const reader = response.body.getReader();
      let length = 0;
      const parts: Uint8Array[] = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > limit)
            throw Object.assign(new Error("Kaynak boyut sınırı aşıldı."), {
              permanent: true,
            });
          parts.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      return new Uint8Array(Buffer.concat(parts));
    } catch (error) {
      if (attempt === 1 || (error as any).permanent) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw new Error(`Kaynak alınamadı: ${url}`);
}

export async function syncSources(target?: string) {
  let previousSnapshot: any = null;
  try {
    previousSnapshot = JSON.parse(
      await readFile("data/life-knowledge.json", "utf8"),
    );
  } catch (error) {
    if ((error as any).code !== "ENOENT") throw error;
  }
  // Explicit official sources only. No user-supplied URLs or crawling.
  const sources = managedSources.filter((s) => s.format !== "pdf");
  function clean(html: string) {
    html = html.replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    );
    const named: Record<string, string> = {
      uuml: "ü",
      Uuml: "Ü",
      ouml: "ö",
      Ouml: "Ö",
      ccedil: "ç",
      Ccedil: "Ç",
      nbsp: " ",
      amp: "&",
      quot: '"',
      apos: "'",
      lt: "<",
      gt: ">",
      rsquo: "'",
      lsquo: "'",
      ldquo: "“",
      rdquo: "”",
      ndash: "–",
      mdash: "—",
      hellip: "…",
    };
    for (let i = 0; i < 3; i++)
      html = html.replace(/&([A-Za-z]+);/g, (all, name) => named[name] ?? all);
    return html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/\s+/g, " ")
      .trim();
  }
  if (
    target &&
    (!previousSnapshot || !managedSources.some((s) => s.id === target))
  )
    throw new Error(
      "Hedefli yenileme için geçerli kaynak kimliği ve önceki veri dosyası gerekir.",
    );
  const selected = sources.filter((s) => !target || s.id === target);
  const selectedUrls = new Set<string>(
    managedSources.filter((s) => !target || s.id === target).map((s) => s.url),
  );
  const articles: LifeArticle[] = target
    ? previousSnapshot.articles.filter(
        (a: LifeArticle) => !selectedUrls.has(a.url),
      )
    : [];
  const checks: { id: string; url: string; sha256: string; count: number }[] =
    target
      ? previousSnapshot.sources.filter((s: { id: string }) => s.id !== target)
      : [];
  // Some FAQ pages repeat the same question; one source cannot emit an ID twice.
  const seenIds = new Set(articles.map((a) => a.id));
  for (const source of selected) {
    const html = new TextDecoder().decode(await fetchSource(source.url));
    const pattern =
      source.format === "akdenizAccordion"
        ? /<button\b[^>]*data-target="#[^"]+"[^>]*>([\s\S]*?)<\/button>/gi
        : source.format === "sduAccordion"
        ? /<div\b[^>]*class="[^"]*soru-btn-link[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
        : source.format === "card"
        ? /<div\b[^>]*class="card-link"[^>]*>([\s\S]*?)<\/div>/gi
        : source.format === "h5"
        ? /<h5\b[^>]*>([\s\S]*?)<\/h5>/gi
        : /<strong\b[^>]*>([\s\S]*?)<\/strong>/gi;
    const headings = [...html.matchAll(pattern)].filter(
      (m) =>
        source.format === "h5" || source.format === "card" || source.format === "sduAccordion" || source.format === "akdenizAccordion" || (source.format === "pauQuestions" && /^S\s*:/i.test(clean(m[1])) && clean(m[1]).includes("?")) || (source.format === "strongQuestions" && clean(m[1]).includes("?")) ||
        (/^\d+[.)]/.test(clean(m[1])) && clean(m[1]).includes("?")),
    );
    let count = 0;
    for (let i = 0; i < headings.length && count < source.limit; i++) {
      const match = headings[i];
      const title = clean(match[1]).replace(/^S\s*:\s*/i, "").replace(/\s*\+\s*$/, "");
      if (!title || (!title.includes("?") && source.format !== "akdenizAccordion") || title.length > 250) continue;
      // Undated prices cannot safely answer current-cost questions.
      if ((source.id === "sdu-sks" || source.id.startsWith("sdu-oidb-")) && /ücret|fiyat/i.test(title)) continue;
      if (
        source.format !== "akdenizAccordion" && source.id !== "pau-oidb" && !source.id.startsWith("sdu-library-") && !source.id.startsWith("sdu-oidb-") && !(["isubu-ydyo", "isubu-guide", "sdu-ydyo"] as string[]).includes(source.id) && !/kayıt|ders|öğrenci|yurt|yemek|burs|barın|topluluk|belge|danışman|muaf|sınav|internet|kütüphane|başvuru/i.test(
          title,
        )
      )
        continue;
      const end =
        headings[i + 1]?.index ?? Math.min(html.length, match.index! + 5000);
      const text = clean(
        html
          .slice(match.index! + match[0].length, end)
          .split(/<footer|<h[1-4]\b|<section\b[^>]*class="ana-iletisim"/i)[0],
      ).replace(/\s*Eklenme tarihi\s*:.*/i, "");
      if (source.id.startsWith("sdu-library-") && /pandemi|covid|ücret|ceza/i.test(title + " " + text)) continue;
      // Keep the complete parent answer; the indexer splits it without losing the parent.
      if (
        text.length < 35 ||
        text.length > 16000 ||
        (source.scope !== "national" &&
          /T\.C\. Kimlik|son sekiz|son 8|varsayılan.*şifre/i.test(text))
      )
        continue;
      const id =
        source.id +
        "-" +
        createHash("sha256").update(title).digest("hex").slice(0, 12);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const topic =
        (source.id === "isubu-ydyo" || source.id === "sdu-ydyo")
          ? "Hazırlık"
          : source.id === "gsb-burs-kredi"
          ? "Burs ve kredi"
          : source.scope === "national"
            ? "Barınma"
            : /yemek|burs|beslen/i.test(title)
              ? "Yemek ve destek"
              : /topluluk|spor|kültür/i.test(title)
                ? "Kampüs yaşamı"
                : /muaf|hazırlık|yabancı/i.test(title)
                  ? "Hazırlık"
                  : "Öğrenci işlemleri";
      articles.push({
        id,
        title,
        topic,
        text,
        keywords:
          source.id === "gsb-burs-kredi"
            ? ["KYK", "GSB", "burs", "öğrenim kredisi"]
            : [],
        url: source.url,
        sourceTitle: source.title,
        checkedAt: new Date().toISOString().slice(0, 10),
        period: null,
        scope: source.scope as "isubu" | "sdu" | "pau" | "akdeniz" | "national",
        kind: "official-excerpt",
      });
      count++;
    }
    if (!count)
      throw new Error(
        `${source.id}: sayfa yapısı değişmiş olabilir, içerik bulunamadı.`,
      );
    const previousCount = previousSnapshot?.sources?.find(
      (s: any) => s.id === source.id,
    )?.count;
    if (previousCount && count < previousCount * 0.6)
      throw new Error(
        `${source.id}: kaynak parçası sayısı beklenmedik biçimde düştü; eski sürüm korunuyor.`,
      );
    const rawHash = createHash("sha256").update(html).digest("hex");
    await mkdir("var/source-archive", { recursive: true });
    await writeFile(`var/source-archive/${rawHash}.html`, html);
    checks.push({
      id: source.id,
      url: source.url,
      sha256: createHash("sha256").update(html).digest("hex"),
      count,
    });
    console.log(`${source.id}: ${count} kaynak parçası`);
  }
  if (!target || target === "isubu-clubs-pdf") {
    // A digital official guideline; section and page boundaries remain attached.
    const pdfSource = managedSources.find((s) => s.format === "pdf")!;
    const pdfBytes = await fetchSource(pdfSource.url, 15_000_000);
    if (pdfBytes.length > 15_000_000)
      throw new Error("PDF boyut sınırı aşıldı.");
    const pdfHash = createHash("sha256").update(pdfBytes).digest("hex");
    await mkdir("var/source-archive", { recursive: true });
    await writeFile(`var/source-archive/${pdfHash}.pdf`, pdfBytes);
    const parsedPdf = await extractPdf(pdfBytes);
    const priorPdfCount = previousSnapshot?.sources?.find(
      (s: any) => s.id === pdfSource.id,
    )?.count;
    if (
      !parsedPdf.sections.length ||
      (priorPdfCount && parsedPdf.sections.length < priorPdfCount * 0.6)
    )
      throw new Error(
        "PDF bölüm sayısı beklenmedik biçimde düştü; eski sürüm korunuyor.",
      );
    for (const section of parsedPdf.sections)
      articles.push({
        id: `${pdfSource.id}-${section.section.toLocaleLowerCase("tr").replace(/\s+/g, "-")}`,
        title: `Öğrenci toplulukları · ${section.title}`,
        topic: "Kampüs yaşamı",
        text: section.text,
        keywords: ["topluluk", "yönerge"],
        url: pdfSource.url,
        sourceTitle: pdfSource.title,
        checkedAt: new Date().toISOString().slice(0, 10),
        period: "2022 tarihli dosya; yürürlük sürümü ayrıca doğrulanmalı",
        scope: "isubu",
        kind: "official-excerpt",
        page: section.page,
        pageEnd: section.pageEnd,
        section: section.section,
      });
    checks.push({
      id: pdfSource.id,
      url: pdfSource.url,
      sha256: pdfHash,
      count: parsedPdf.sections.length,
    });
    console.log(
      `${pdfSource.id}: ${parsedPdf.pages} sayfa, ${parsedPdf.sections.length} madde/bölüm`,
    );
  }
  const duplicateIds = articles
    .map((a) => a.id)
    .filter((id, i, ids) => ids.indexOf(id) !== i);
  if (duplicateIds.length)
    throw new Error(
      `Yinelenen kaynak kimliği: ${[...new Set(duplicateIds)].join(", ")}; eski sürüm korunuyor.`,
    );
  const contentKey = (items: LifeArticle[]) =>
    createHash("sha256")
      .update(
        JSON.stringify(
          items
            .map(({ checkedAt, ...a }) => a)
            .sort((a, b) => a.id.localeCompare(b.id)),
        ),
      )
      .digest("hex");
  const changed =
    contentKey(articles) !== contentKey(previousSnapshot?.articles || []);
  const output = {
    version: createHash("sha256")
      .update(JSON.stringify(articles))
      .digest("hex")
      .slice(0, 16),
    retrievedAt: new Date().toISOString(),
    sources: checks,
    articles,
  };
  await mkdir("data", { recursive: true });
  await writeFile(
    "data/life-knowledge.json.tmp",
    JSON.stringify(output, null, 2) + "\n",
  );
  await rename("data/life-knowledge.json.tmp", "data/life-knowledge.json");
  console.log(
    `Toplam ${articles.length} parça. Kaynakta dönem belirtilmeyen metinler güncel dönem garantisi taşımaz.`,
  );

  return {
    changed,
    version: output.version,
    articles: articles.length,
    sources: checks.length,
  };
}
export async function runSync(target?: string) {
  await mkdir("var/reports", { recursive: true });
  let previousHealth: any = null;
  try {
    previousHealth = JSON.parse(
      await readFile("var/reports/source-sync.json", "utf8"),
    );
  } catch (error) {
    if ((error as any).code !== "ENOENT") throw error;
  }
  try {
    const result = await syncSources(target);
    await writeFile(
      "var/reports/source-sync.json",
      JSON.stringify(
        {
          status: "ok",
          lastAttemptAt: new Date().toISOString(),
          lastSuccessfulAt: new Date().toISOString(),
          ...result,
        },
        null,
        2,
      ),
    );
    return result;
  } catch (error) {
    await writeFile(
      "var/reports/source-sync.json",
      JSON.stringify(
        {
          status: "failed",
          lastAttemptAt: new Date().toISOString(),
          lastSuccessfulAt: previousHealth?.lastSuccessfulAt || null,
          error: (error as Error).message,
        },
        null,
        2,
      ),
    );
    throw error;
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  await runSync(process.argv.find((a) => a.startsWith("--source="))?.slice(9));
