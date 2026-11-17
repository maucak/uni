// Match only standalone greetings so substantive questions still reach retrieval.
export function greetingAnswer(message: string): string {
  const text = message.toLocaleLowerCase("tr-TR")
    .trim().replace(/[!?.,]+$/g, "").trim()
    .replace(/(.)\1+/gu, "$1")
    .replace(/\s+/g, " ");
  if (!/^(selam|selamlar|merhaba|merhabalar|hey|hi|helo|günaydın|iyi akşamlar|iyi günler|iyi geceler)(?:\s+(?:danışman|nasılsın))?$/.test(text)) return "";
  return "Merhaba! Üniversite tercihleri ve kampüs yaşamı hakkında yardımcı olabilirim. Yurt başvurusu, hazırlık, ders kaydı veya öğrenci toplulukları gibi bir konuda soru sorabilirsin. Neyi öğrenmek istiyorsun?";
}
