import type { LifeArticle } from "../../../shared/life.ts";
const conditional =
  /(?:\bise\b|\beğer\b|\bolması\s+(?:halinde|durumunda)|\bolmadığı\s+(?:takdirde|durumda)|\bşartıyla\b)/i;
const numberWords: Record<string, string> = {
  bir: "1",
  iki: "2",
  üç: "3",
  dört: "4",
  beş: "5",
  altı: "6",
  yedi: "7",
  sekiz: "8",
  dokuz: "9",
  on: "10",
};
function numbersIn(text: string) {
  const normalized = text
    .toLocaleLowerCase("tr-TR")
    .replace(
      /(?<![\p{L}])(bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)(?![\p{L}])/giu,
      (word) => numberWords[word] || word,
    );
  return new Set(
    (normalized.match(/\b\d+(?:[.,]\d+)?\b/g) || []).map((n) =>
      String(Number(n.replace(",", "."))),
    ),
  );
}
export function validateGroundedAnswer(text: string, sources: LifeArticle[]) {
  if (!text.trim() || text.length > 4500)
    throw new Error("Invalid answer length");
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  for (const paragraph of paragraphs) {
    const refs = [...paragraph.matchAll(/\[S(\d+)\]/g)].map(
      (m) => Number(m[1]) - 1,
    );
    if (!refs.length || refs.some((i) => i < 0 || i >= sources.length))
      throw new Error("Unsupported citation");
    const evidence = refs
      .map(
        (i) =>
          sources[i].title +
          " " +
          sources[i].text +
          " " +
          (sources[i].period || ""),
      )
      .join(" ");
    // Reject new numerical claims. This is not a substitute for semantic entailment evaluation.
    const numbers =
      paragraph
        .replace(/\[S\d+\]/g, "")
        .replace(/^\s*\d+[.)]\s*/gm, "")
        .match(/\b\d+(?:[.,]\d+)?\b/g) || [];
    const numeric = (s: string) => String(Number(s.replace(",", ".")));
    const supported = new Set(
      (evidence.match(/\b\d+(?:[.,]\d+)?\b/g) || []).map(numeric),
    );
    for (const date of evidence.matchAll(
      /\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/g,
    ))
      for (const n of date.slice(1)) supported.add(numeric(n));
    for (const n of numbers)
      if (!supported.has(numeric(n)))
        throw new Error("Unsupported numeric claim");
    // Conservative guard for numeric rules that are conditional in the cited source.
    // It cannot establish semantic equivalence; the independent model review is also required.
    for (const sentence of evidence.split(/(?<=[.!?])\s+/)) {
      if (!conditional.test(sentence)) continue;
      const conditionalNumbers = numbersIn(sentence);
      for (const answerSentence of paragraph
        .replace(/\[S\d+\]/g, "")
        .split(/(?<=[.!?])\s+/)) {
        if (
          [...numbersIn(answerSentence)].some((n) =>
            conditionalNumbers.has(n),
          ) &&
          !conditional.test(answerSentence)
        )
          throw new Error("Unsupported conditional numeric claim");
      }
    }
    const urls = paragraph.match(/https?:\/\/[^\s)]+/g) || [];
    if (urls.some((url) => !sources.some((s) => s.url === url)))
      throw new Error("Unsupported URL");
  }
  return text;
}
