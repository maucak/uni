import "dotenv/config";
import { readFile } from "node:fs/promises";
// Reuse only this repository's already initialized development database.
export async function useLocalDatabase() {
  if (process.env.DATABASE_URL) return;
  try {
    const password = (await readFile("var/database-password", "utf8")).trim();
    process.env.DATABASE_URL = `postgresql://postgres:${password}@127.0.0.1:${process.env.LOCAL_PG_PORT || 55432}/kampuspusula`;
  } catch {
    throw new Error(
      "DATABASE_URL tanımlayın veya önce npm run dev ile yerel veritabanını başlatın.",
    );
  }
}
