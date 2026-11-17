import { catalog } from "../../catalog.ts";
import { searchStateSchema } from "../../../shared/contracts.ts";
import { filterPrograms } from "../search.ts";
import type { LifeAnswer } from "../../../shared/life.ts";
export async function catalogAction(
  message: string,
  force = false,
): Promise<LifeAnswer | null> {
  if (/bana uygun|ilgi alanlarıma göre|tercih listem/i.test(message))
    return {
      mode: "action",
      answer:
        "İlgi alanların ve önceliklerinle program önerilerini kendi çalışma alanında inceleyebilirsin.",
      notice: "Program önerileri profilindeki bilgilerle hesaplanır.",
      sources: [],
      actions: [{ label: "Bana uygun programlar", url: "/oneriler" }],
    };
  if (
    !force &&
    (!/program|bölüm|mühendislik|mühendisliği/i.test(message) ||
      !/göster|listele|bulabilir|karşılaştır|araştırmak/i.test(message))
  )
    return null;
  const programs = await catalog(),
    cities = [...new Set(programs.map((p) => p.city))];
  const city =
    cities.find(
      (c) =>
        c.length > 2 &&
        message.toLocaleLowerCase("tr").includes(c.toLocaleLowerCase("tr")),
    ) || "";
  const language = /ingilizce/i.test(message)
    ? "İngilizce"
    : /türkçe/i.test(message)
      ? "Türkçe"
      : "";
  const subject =
    [
      "bilgisayar",
      "yazılım",
      "elektrik",
      "makine",
      "tıp",
      "hukuk",
      "psikoloji",
      "hemşirelik",
    ].find((s) => message.toLocaleLowerCase("tr").includes(s)) || "";
  const score =
    message
      .match(/(?:^|\s)(SAY|EA|SÖZ|DİL|TYT)(?:\s|$)/i)?.[1]
      ?.toLocaleUpperCase("tr") || "";
  const state = searchStateSchema.parse({
    city,
    language,
    search: subject,
    scoreType: score,
  });
  const count = filterPrograms(programs, state).length;
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (language) params.set("language", language);
  if (subject) params.set("search", subject);
  if (score) params.set("scoreType", score);
  return {
    mode: "action",
    answer: `Katalogda bu filtrelerle ${count} program kaydı bulundu. Sonuçlarda kaynak yılını, program koşullarını ve veri eksiklerini inceleyebilirsin.`,
    notice:
      "Bu sonuçlar doğrudan program veritabanından alınır; yerleşme garantisi değildir.",
    sources: [],
    actions: [
      { label: "Filtrelenmiş programları aç", url: `/programlar?${params}` },
    ],
  };
}
