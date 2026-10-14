import { useLocalDatabase } from "./environment.ts";
await useLocalDatabase();
const { pool } = await import("../server/db.ts");
const origin = "http://127.0.0.1:5173";
let questionId: string | undefined;
async function request(path: string, init: RequestInit = {}) {
  const r = await fetch(`${origin}/api/v1${path}`, init);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r;
}
try {
  const communities = await (await request("/communities")).json();
  const programs = communities.filter((c: any) => c.programId);
  if (programs.length < 2) throw new Error("Program toplulukları eksik");
  const selected = await (
    await request(`/communities?programId=${programs[0].programId}`)
  ).json();
  if (selected.length !== 1 || selected[0].id !== programs[0].id)
    throw new Error("Program filtresi yanlış");
  const login = await request("/auth/dev-login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: "{}",
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const tag = `kontrol-${Date.now()}`;
  const q = await (
    await request("/questions", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        communityId: programs[0].id,
        title: `Program topluluğu ${tag}`,
        body: "Yalnızca geçici doğrulama kaydı; kontrol sonunda silinir.",
        tags: [tag],
      }),
    })
  ).json();
  questionId = q.id;
  const found = await (
    await request(
      `/questions?communityId=${programs[0].id}&search=${tag}&tag=${tag}`,
    )
  ).json();
  if (found.length !== 1 || found[0].id !== questionId)
    throw new Error("Arama/etiket filtresi yanlış");
  const other = await (
    await request(`/questions?communityId=${programs[1].id}&tag=${tag}`)
  ).json();
  if (other.length) throw new Error("Diğer programın içeriği karıştı");
  console.log(
    "PASS: program toplulukları, soru oluşturma, metin/etiket araması, program ayrımı.",
  );
} finally {
  if (questionId)
    await pool.query("DELETE FROM questions WHERE id=$1", [questionId]);
  await pool.end();
}
