// Değerlendirme script'lerinin ortak yardımcıları (dosya, git, rapor biçimi).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export class EvalError extends Error {}

export function timestamp(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}
export function gitInfo() {
  const run = (...args: string[]) =>
    execFileSync("git", args, { encoding: "utf8" }).trim();
  try {
    return {
      commit: run("rev-parse", "HEAD"),
      dirty: run("status", "--porcelain").length > 0,
    };
  } catch {
    return { commit: "bilinmiyor", dirty: null as boolean | null };
  }
}
// Etiket/soru dosyasını okur; yoksa ekibe ne yapacağını söyleyen açık hata verir.
export async function readEvalFile(
  path: string,
  what: string,
  example: string,
) {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (e: any) {
    if (e?.code === "ENOENT")
      throw new EvalError(
        `${what} dosyası bulunamadı: ${path}\n` +
          `Bu dosyayı ekip yazar; script ajan tarafından üretilmiş veri kullanmaz.\n` +
          `Şablon için ${example} dosyasına bakın, docs/degerlendirme.md belgesini izleyin.`,
      );
    throw e;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e: any) {
    throw new EvalError(`${path} geçerli JSON değil: ${e.message}`);
  }
  return { data, sha256: createHash("sha256").update(raw).digest("hex") };
}
export async function writeReports(
  name: string,
  stamp: string,
  json: unknown,
  markdown: string,
) {
  await mkdir("var/reports", { recursive: true });
  const base = `var/reports/${name}-${stamp}`;
  await writeFile(`${base}.json`, JSON.stringify(json, null, 2) + "\n");
  await writeFile(`${base}.md`, markdown);
  return { json: `${base}.json`, markdown: `${base}.md` };
}
export const fmt = (v: number | null | undefined, digits = 3) =>
  v === null || v === undefined || Number.isNaN(v)
    ? "–"
    : v.toLocaleString("tr-TR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
export function mdTable(header: string[], rows: (string | number)[][]) {
  const line = (cells: (string | number)[]) =>
    `| ${cells.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join(
    "\n",
  );
}
