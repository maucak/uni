import type { DialogueState } from "./dialogue-plan.ts";
export type RagContext = {
  dialogue?: DialogueState;
  university: "isubu" | "sdu" | "pau" | "akdeniz" | "other" | "unknown";
  universityVerified?: boolean;
  scholarshipQuestionKnown?: boolean;
  scholarshipType?: "meal" | "kyk" | "tuition" | "unspecified";
  universityName: string;
  program: "computer" | "software" | "tourism" | null;
  year: number | null;
  subject: string;
};
const normalize = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
export function contextFor(
  message: string,
  previous?: Partial<RagContext>,
  profileUniversity = "",
) {
  const text = normalize(message),
    profile = normalize(profileUniversity);
  const supported = /isubu|isparta uygulamali/.test(text);
  const outside =
    /\b(?:sdu|odtu|itu|bogazici)\b|suleyman demirel|baska universite|farkli universite/.test(
      text,
    ) ||
    (/universite(?:si|sinde|sinin|sine|sinden)/.test(text) && !supported);
  const profileOther =
    !!profileUniversity && !/isubu|isparta uygulamali/.test(profile);
  const university = /akdeniz universite/.test(text) ? "akdeniz" : /\bpau\b|pamukkale universite/.test(text) ? "pau" : /\bsdu\b|suleyman demirel/.test(text) ? "sdu" : outside
    ? "other"
    : supported
      ? "isubu"
      : previous?.universityVerified ? previous.university || "unknown" : profileUniversity ? (profileOther ? "other" : "isubu") : "unknown";
  const program = /bilgisayar muhendis/.test(text)
    ? "computer"
    : /yazilim muhendis/.test(text)
      ? "software"
      : /turizm/.test(text)
        ? "tourism"
        : previous?.program || null;
  const followup =
    /^(peki|ya |bunun|bunu|bunlar|orada|onun|o zaman|ne zaman|nereye|nasil|benim bolum|basvuru|ucreti|kosullari|sartlari|sonucu|tutari)/.test(
      text.trim(),
    ) ||
    (/^(turizm|bilgisayar|yazilim)/.test(text) && !!previous?.subject) ||
    ((supported || outside) && !!previous?.subject);
  const year = text.match(/\b(20[2-4]\d)\b/);
  const subject =
    /burs/.test(text) ? "scholarship" :
    /hazirli[kǧg]|muafiyet|yeterlilik|ingilizceyi|ingilizce yeter/.test(text)
      ? "preparation"
      : /\bkyk\b|yurt|barin|kalacak/.test(text)
        ? "housing"
        : /yemek|beslen|bakiye/.test(text)
          ? "dining"
          : /obs|sifre|ders kayit/.test(text)
            ? "student-services"
            : followup
              ? previous?.subject || ""
              : "";
  const scholarshipType = /yemek burs|beslenme burs/.test(text) ? "meal" : /kyk.*burs|burs.*kyk|gsb.*burs/.test(text) ? "kyk" : /ogrenim.*burs|burs.*ogrenim|tercih.*burs|yuzde.*burs/.test(text) ? "tuition" : /burs/.test(text) ? "unspecified" : followup ? previous?.scholarshipType : undefined;
  const context: RagContext = {
    university,
    universityVerified: supported || outside || !!profileUniversity || !!previous?.universityVerified,
    scholarshipType,
    scholarshipQuestionKnown: subject === "scholarship" && (/basvur|sart|kosul|tutar|ne kadar|kac|sonuc|ne zaman|kimler|nedir|nasil|kesil|iptal|geri ode|kredi|belge|odeme/.test(text) || (previous?.subject === "scholarship" && !!previous.scholarshipQuestionKnown)),
    universityName: supported
      ? "İSUBÜ"
      : outside
        ? message.slice(0, 100)
        : (previous?.universityVerified ? previous.universityName : "") || profileUniversity || "",
    program,
    year: year ? Number(year[1]) : followup ? previous?.year || null : null,
    subject,
  };
  const broadHousing = context.subject === "housing" &&
    /(?:nasil|hakkinda|bilgi|iyi mi|ne durumda)/.test(text) &&
    !/basvur|kayit|ucret|fiyat|belge|sonuc|nakil|izin|cikis|adres|ulasim|oda|yemek|internet|kosul|sart/.test(text);
  const missingScholarship = context.subject === "scholarship" && (!scholarshipType || scholarshipType === "unspecified");
  const needsUniversity = context.university === "unknown" &&
    (["preparation","dining","student-services"].includes(context.subject) || (context.subject === "scholarship" && scholarshipType === "meal"));
  const clarification = missingScholarship
    ? "Hangi bursu soruyorsun: KYK bursu, yemek bursu, öğrenim/tercih bursu veya başka bir kurumun bursu mu?"
    : needsUniversity
    ? "Hangi üniversite için soruyorsun? Koşullar üniversiteye göre değiştiği için okulunu bilmeden başka bir kurumun bilgisini uygulayamam."
    : context.subject === "scholarship" && !context.scholarshipQuestionKnown
    ? "Bu bursla ilgili neyi öğrenmek istiyorsun: başvuru sürecini, başvuru şartlarını, tutarını veya sonuçları mı?"
    : broadHousing
    ? "KYK yurtlarıyla ilgili neyi öğrenmek istiyorsun: başvuru ve kayıt sürecini mi, yoksa belirli bir şehirdeki veya yurttaki konumu ve yaşam koşullarını mı? Belirli bir yurdu soruyorsan adını yazabilirsin."
    :
    context.subject === "preparation" &&
    !program &&
    /muaf|gec|atla|girm|zorunlu|devam|yeterlilik/.test(text)
      ? "Hazırlık koşulları bölüme göre değişebilir. Hangi bölümde okuyorsun?"
      : "";
  return { context, clarification };
}
export function retrievalQuestion(
  message: string,
  context: RagContext,
  previousQuery = "",
) {
  const text = normalize(message);
  const followup =
    /^(peki|ya |bunun|bunu|bunlar|orada|onun|o zaman|ne zaman|nereye|nasil|benim bolum|basvuru|ucreti|kosullari|sartlari|sonucu|tutari)/.test(
      text.trim(),
    );
  const subject =
    context.subject === "housing"
      ? "yurt başvurusu"
      : context.subject === "preparation"
        ? "hazırlık yabancı dil muafiyet"
        : context.subject === "dining"
          ? "yemekhane yemek"
          : context.subject === "student-services"
            ? "OBS öğrenci işlemleri"
            : "";
  const changesProgram =
    /benim bolum|turizm|bilgisayar muhendis|yazilim muhendis/.test(text);
  const base = followup && !changesProgram ? previousQuery.slice(0, 500) : "";
  const expanded = /\bkyk\b/.test(text)
    ? (context.subject === "scholarship" ? "GSB burs öğrenim kredisi" : "KYK GSB öğrenci yurt barınma " + subject)
    :
    /notlar|derslerim|ogrenci bilgi/.test(text) && !text.includes("obs")
      ? "OBS öğrenci bilgi sistemi"
      : /ders.*(?:ekle|cikar)/.test(text)
        ? "ekle sil akademik takvim"
        : /kalacak yer/.test(text)
          ? "yurt barınma"
          : "";
  return [
    base,
    message,
    expanded,
    followup || changesProgram ? subject : "",
    context.subject === "preparation"
      ? context.program === "computer"
        ? "Bilgisayar Mühendisliği"
        : context.program === "tourism"
          ? "Turizm"
          : context.program === "software"
            ? "Yazılım Mühendisliği"
            : ""
      : "",
    context.year || "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1800);
}
