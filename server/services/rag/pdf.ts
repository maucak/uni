import { PDFParse } from "pdf-parse";
export type PdfSection = {
  title: string;
  text: string;
  page: number;
  pageEnd: number;
  section: string;
};
export async function extractPdf(
  data: Uint8Array,
): Promise<{ sections: PdfSection[]; pages: number }> {
  if (Buffer.from(data.subarray(0, 5)).toString() !== "%PDF-")
    throw new Error("Kaynak PDF değil.");
  const parser = new PDFParse({ data, verbosity: 0 });
  try {
    const result = await parser.getText();
    if (!result.pages.length || result.text.trim().length < 100)
      throw new Error("PDF metni okunamadı; OCR/insan kontrolü gerekiyor.");
    const offsets: { start: number; page: number }[] = [];
    let text = "";
    for (const page of result.pages) {
      offsets.push({ start: text.length, page: page.num });
      text += page.text.replace(/--\s*\d+\s+of\s+\d+\s*--/g, "") + "\n";
    }
    const pageAt = (at: number) =>
      offsets.filter((o) => o.start <= at).at(-1)?.page || 1;
    const headings = [...text.matchAll(/MADDE\s+(\d+)\s*[-–—]/g)];
    if (!headings.length)
      return {
        pages: result.pages.length,
        sections: result.pages
          .filter((p) => p.text.trim().length > 80)
          .map((p) => ({
            title: `Sayfa ${p.num}`,
            text: p.text.trim(),
            page: p.num,
            pageEnd: p.num,
            section: `Sayfa ${p.num}`,
          })),
      };
    const sections = headings.map((m, i) => {
      const start = m.index!,
        end = headings[i + 1]?.index ?? text.length;
      const before =
        text
          .slice(Math.max(0, start - 180), start)
          .trim()
          .split("\n")
          .at(-1) || "";
      return {
        title: `${before.length < 120 ? before + " · " : ""}Madde ${m[1]}`,
        text: text
          .slice(start, end)
          .replace(/[ \t]+/g, " ")
          .trim(),
        page: pageAt(start),
        pageEnd: pageAt(end - 1),
        section: `Madde ${m[1]}`,
      };
    });
    return { sections, pages: result.pages.length };
  } finally {
    await parser.destroy();
  }
}
