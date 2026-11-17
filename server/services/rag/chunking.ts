import { createHash } from "node:crypto";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
// Parent text is retained in the document; a hit expands back to that parent.
// Sentence overlap is only for retrieval, never an excuse to lose original text.
export function chunkText(input: string, target = 1100): string[] {
  const text = input.replace(/\r/g, "").trim();
  if (!text) return [];
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9])/u);
  const units = sentences.flatMap((sentence) => {
    if (sentence.length <= target * 1.5) return [sentence];
    const words = sentence.split(/\s+/),
      parts: string[] = [];
    let part = "";
    for (const word of words) {
      if (part.length + word.length > target && part) {
        parts.push(part);
        part = "";
      }
      part += (part ? " " : "") + word;
    }
    if (part) parts.push(part);
    return parts;
  });
  const chunks: string[] = [];
  let current: string[] = [],
    size = 0;
  for (const unit of units) {
    if (size + unit.length > target && current.length) {
      chunks.push(current.join(" "));
      const tail = current.at(-1)!;
      current = tail.length < target * 0.35 ? [tail] : [];
      size = current.join(" ").length;
    }
    current.push(unit);
    size += unit.length + 1;
  }
  if (current.length) chunks.push(current.join(" "));
  return [...new Set(chunks)];
}
