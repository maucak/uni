import type {
  Program,
  Profile,
  Recommendation,
} from "../../shared/contracts.ts";
export const algorithmVersion = "content-v2-budget-tfidf";
const stopWords = new Set([
  "ve",
  "ile",
  "bir",
  "bu",
  "için",
  "olarak",
  "olan",
  "üzerine",
  "alanında",
  "eğitim",
  "gibi",
]);
export function tokenize(text: string) {
  return (
    text.toLocaleLowerCase("tr-TR").match(/[\p{L}\p{N}]+/gu) || []
  ).filter((t) => t.length > 1 && !stopWords.has(t));
}
export function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (const [t, v] of a) {
    dot += v * (b.get(t) || 0);
    na += v * v;
  }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
export function recommend(
  programs: Program[],
  profile: Profile,
  corpus: Program[] = programs,
): Recommendation[] {
  const documents = corpus.map((p) =>
    tokenize(`${p.name} ${p.description} ${p.subjects.join(" ")}`),
  );
  const frequencies = new Map<string, number>();
  for (const tokens of documents)
    for (const t of new Set(tokens))
      frequencies.set(t, (frequencies.get(t) || 0) + 1);
  function vector(tokens: string[]) {
    const counts = new Map<string, number>();
    for (const t of tokens)
      if (frequencies.has(t)) counts.set(t, (counts.get(t) || 0) + 1);
    return new Map(
      [...counts].map(([t, count]) => [
        t,
        (count / Math.max(tokens.length, 1)) *
          (Math.log((1 + documents.length) / (1 + frequencies.get(t)!)) + 1),
      ]),
    );
  }
  const userTokens = tokenize(profile.interests);
  const user = vector(userTokens);
  return programs
    .filter(
      (p) =>
        p.scoreType === profile.scoreType &&
        (profile.universityType === "any" ||
          p.universityType === profile.universityType),
    )
    .map((program) => {
      const i = corpus.findIndex((p) => p.id === program.id);
      const tokens =
        i >= 0
          ? documents[i]
          : tokenize(
              `${program.name} ${program.description} ${program.subjects.join(" ")}`,
            );
      const reasons: string[] = [];
      const missing: string[] = [];
      const components: {
        name: string;
        weight: number;
        available: boolean;
        value: number;
      }[] = [];
      const textScore = cosine(user, vector(tokens));
      components.push({
        name: "İlgi uyumu",
        weight: profile.weights.interest,
        available: userTokens.length > 0 && tokens.length > 0,
        value: textScore,
      });
      if (userTokens.length === 0)
        missing.push(
          "İlgi alanlarını eklediğinde metinsel uyum hesaplanabilir.",
        );
      else if (textScore > 0) {
        const overlap = [...new Set(tokens.filter((t) => user.has(t)))].slice(
          0,
          4,
        );
        reasons.push(`İlgi metninle örtüşen konular: ${overlap.join(", ")}.`);
      }
      if (profile.cities.length) {
        const match = profile.cities.some(
          (c) =>
            c.toLocaleLowerCase("tr-TR") ===
            program.city.toLocaleLowerCase("tr-TR"),
        );
        components.push({
          name: "Şehir önceliği",
          weight: profile.weights.city,
          available: true,
          value: match ? 1 : 0,
        });
        reasons.push(
          match
            ? `${program.city}, öncelik verdiğin şehirlerden biri.`
            : `${program.city}, seçtiğin şehirlerin dışında.`,
        );
      }
      if (profile.language !== "any") {
        const match = profile.language === program.language;
        components.push({
          name: "Eğitim dili",
          weight: profile.weights.language,
          available: true,
          value: match ? 1 : 0,
        });
        reasons.push(
          match
            ? `${program.language} eğitim önceliğinle eşleşiyor.`
            : `Eğitim dili ${program.language}; dil önceliğinle eşleşmiyor.`,
        );
      }
      if (
        profile.maxAnnualTuition !== null &&
        profile.maxAnnualTuition !== undefined
      ) {
        const available =
          program.tuition !== null && program.tuition !== undefined;
        const value = available
          ? program.tuition! <= profile.maxAnnualTuition
            ? 1
            : 0
          : 0;
        components.push({
          name: "Öğrenim ücreti",
          weight: profile.weights.budget ?? 2,
          available,
          value,
        });
        if (!available)
          missing.push(
            "Bu programın yıllık öğrenim ücreti doğrulanmadı; bütçe uyumu bilinmiyor.",
          );
        else
          reasons.push(
            `${program.feeYear ?? program.year} yılının öğrenim ücreti ${value ? "belirttiğin sınır içinde" : "belirttiğin sınırı aşıyor"}. Yaşam maliyetleri dahil değil.`,
          );
      }
      if (
        profile.minimumScholarship !== null &&
        profile.minimumScholarship !== undefined
      ) {
        const available =
          program.scholarshipPercent !== null &&
          program.scholarshipPercent !== undefined;
        const value = available
          ? program.scholarshipPercent! >= profile.minimumScholarship
            ? 1
            : 0
          : 0;
        components.push({
          name: "Burs önceliği",
          weight: profile.weights.budget ?? 2,
          available,
          value,
        });
        if (!available)
          missing.push(
            "Burs oranı doğrulanmadı. Üniversite türünden burs oranı çıkarılmaz.",
          );
        else
          reasons.push(
            value
              ? "Kayıtlı burs oranı önceliğini karşılıyor."
              : "Kayıtlı burs oranı önceliğinin altında.",
          );
      }
      const total = components.reduce((s, c) => s + c.weight, 0),
        observed = components.reduce(
          (s, c) => s + (c.available ? c.weight : 0),
          0,
        );
      const coverage = total ? observed / total : 0;
      const score = observed
        ? Math.round(
            ((100 *
              components.reduce(
                (s, c) => s + (c.available ? c.weight * c.value : 0),
                0,
              )) /
              observed) *
              coverage,
          )
        : null;
      if (!reasons.length)
        reasons.push(
          "Puan türünle eşleşiyor. Daha ayrıntılı öneriler için önceliklerini tamamla.",
        );
      missing.push(
        "Staj kalitesi ve istihdam oranı için doğrulanmış puan üretilmiyor.",
      );
      return {
        program,
        score,
        coverage,
        reasons,
        missing,
        components: components.map((c) => ({
          name: c.name,
          weight: c.weight,
          value: c.available ? c.value : null,
        })),
      };
    })
    .sort(
      (a, b) =>
        (b.score ?? -1) - (a.score ?? -1) ||
        a.program.id.localeCompare(b.program.id),
    );
}
