import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type Mail = { to: string; subject: string; text: string };
export const mailDirectory = resolve("var/mail");
export function mailFileName(to: string, at = new Date()) {
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${to.toLowerCase().replace(/[^a-z0-9@._-]/g, "_")}.txt`;
}
/**
 * Gerçek gönderim yoktur. Geliştirmede (veya MAIL_TRANSPORT=file ile) e-posta
 * var/mail altına yazılır. Üretimde taşıyıcı tanımlı değilse hata verilir.
 */
export async function sendMail(mail: Mail) {
  const transport =
    process.env.MAIL_TRANSPORT ||
    (process.env.NODE_ENV === "production" ? "" : "file");
  if (transport !== "file")
    throw new Error(
      "E-posta taşıyıcısı tanımlı değil. Üretimde MAIL_TRANSPORT ayarlanmalı.",
    );
  await mkdir(mailDirectory, { recursive: true });
  const path = resolve(mailDirectory, mailFileName(mail.to));
  await writeFile(
    path,
    `Kime: ${mail.to}\nKonu: ${mail.subject}\n\n${mail.text}\n`,
    { mode: 0o600 },
  );
  // Belirteç içeren gövde loga yazılmaz; yalnızca dosya yolu.
  console.log(`e-posta yazıldı: ${path}`);
  return path;
}
